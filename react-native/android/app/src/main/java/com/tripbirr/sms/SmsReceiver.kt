package com.tripbirr.sms

import android.content.BroadcastReceiver
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import android.provider.Telephony
import com.facebook.react.ReactApplication
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.facebook.react.bridge.Arguments
import java.security.MessageDigest

/**
 * Native Android BroadcastReceiver for Telebirr incoming SMS messages (Sender ID 127).
 *
 * Reliability guarantees:
 * 1. Works even when the React Native JavaScript runtime is killed or device just restarted.
 * 2. Filters strictly for sender "127" (never reads or uploads unrelated personal inbox messages).
 * 3. Concatenates multi-part SMS PDUs arriving in a single broadcast.
 * 4. Computes a deterministic SHA-256 fingerprint and persists to an offline SQLite native queue
 *    with UNIQUE conflict resolution so duplicate broadcasts are never processed twice.
 * 5. Forwards to the React Native bridge immediately if the JS context is active.
 */
class SmsReceiver : BroadcastReceiver() {

    companion object {
        const val TELEBIRR_SENDER_ID = "127"
        const val EVENT_TELEBIRR_SMS_RECEIVED = "TripBirrSmsReceived"
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) {
            return
        }

        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent)
        if (messages.isNullOrEmpty()) return

        val senderAddress = messages[0].originatingAddress?.trim() ?: return
        if (!senderAddress.equals(TELEBIRR_SENDER_ID, ignoreCase = true) &&
            !senderAddress.equals("telebirr", ignoreCase = true)
        ) {
            // Privacy guardrail: immediately ignore any SMS not from Telebirr 127
            return
        }

        val fullBodyBuilder = StringBuilder()
        for (sms in messages) {
            sms.messageBody?.let { fullBodyBuilder.append(it) }
        }
        val messageBody = fullBodyBuilder.toString().trim()
        if (messageBody.isEmpty()) return

        val timestampMs = messages[0].timestampMillis
        val fingerprint = sha256("$senderAddress|$timestampMs|${messageBody.lowercase()}")

        // 1. Persist synchronously to native SQLite queue before JS bridge dispatch
        val queueHelper = NativeSmsQueueDbHelper(context.applicationContext)
        val inserted = queueHelper.enqueueSms(
            fingerprint = fingerprint,
            senderId = senderAddress,
            body = messageBody,
            receivedAtMs = timestampMs
        )

        if (!inserted) {
            // Already queued/processed (duplicate broadcast prevented)
            return
        }

        // 2. Attempt immediate dispatch to React Native if JS runtime is alive
        try {
            val reactApp = context.applicationContext as? ReactApplication
            val reactContext = reactApp
                ?.reactNativeHost
                ?.reactInstanceManager
                ?.currentReactContext

            if (reactContext != null) {
                val payload = Arguments.createMap().apply {
                    putString("fingerprint", fingerprint)
                    putString("senderId", senderAddress)
                    putString("body", messageBody)
                    putDouble("receivedAtMs", timestampMs.toDouble())
                }
                reactContext
                    .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                    ?.emit(EVENT_TELEBIRR_SMS_RECEIVED, payload)
            }
        } catch (_: Throwable) {
            // Safe fallback: message remains safely persisted in NativeSmsQueueDbHelper
            // and will be drained via SmsModule.drainPendingSmsQueue() when app opens.
        }
    }

    private fun sha256(input: String): String {
        val bytes = MessageDigest.getInstance("SHA-256").digest(input.toByteArray())
        return bytes.joinToString("") { "%02x".format(it) }
    }
}

class NativeSmsQueueDbHelper(context: Context) :
    SQLiteOpenHelper(context, "tripbirr_native_sms_queue.db", null, 1) {

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS native_sms_queue (
                fingerprint TEXT PRIMARY KEY NOT NULL,
                sender_id TEXT NOT NULL,
                body TEXT NOT NULL,
                received_at_ms INTEGER NOT NULL,
                acknowledged INTEGER NOT NULL DEFAULT 0
            )
            """.trimIndent()
        )
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {}

    fun enqueueSms(
        fingerprint: String,
        senderId: String,
        body: String,
        receivedAtMs: Long
    ): Boolean {
        val db = writableDatabase
        val values = ContentValues().apply {
            put("fingerprint", fingerprint)
            put("sender_id", senderId)
            put("body", body)
            put("received_at_ms", receivedAtMs)
            put("acknowledged", 0)
        }
        val rowId = db.insertWithOnConflict(
            "native_sms_queue",
            null,
            values,
            SQLiteDatabase.CONFLICT_IGNORE
        )
        return rowId != -1L
    }
}
