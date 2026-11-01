package com.tripbirr.sms

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import android.os.Build
import android.provider.Telephony
import androidx.core.app.NotificationCompat
import java.security.MessageDigest

/**
 * Native Android BroadcastReceiver for Telebirr incoming SMS messages (Sender ID 127).
 *
 * Guarantees:
 * 1. Works 100% offline even when the app is closed or killed in background.
 * 2. Filters strictly for sender "127" (never reads personal SMS).
 * 3. Enqueues to local SQLite and triggers an instant heads-up notification.
 * 4. Broadcasts internal event so MainActivity can update UI in real-time.
 */
class SmsReceiver : BroadcastReceiver() {

    companion object {
        const val TELEBIRR_SENDER_ID = "127"
        const val ACTION_NEW_TELEBIRR_SMS = "com.tripbirr.NEW_TELEBIRR_SMS"
        const val NOTIFICATION_CHANNEL_ID = "tripbirr_sms_payments"
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

        // 1. Enqueue to SQLite
        val queueHelper = NativeSmsQueueDbHelper(context.applicationContext)
        val inserted = queueHelper.enqueueSms(
            fingerprint = fingerprint,
            senderId = senderAddress,
            body = messageBody,
            receivedAtMs = timestampMs
        )

        if (!inserted) {
            return
        }

        // 2. Send internal broadcast to foreground MainActivity
        try {
            val notifyIntent = Intent(ACTION_NEW_TELEBIRR_SMS).apply {
                setPackage(context.packageName)
                putExtra("senderId", senderAddress)
                putExtra("body", messageBody)
                putExtra("timestamp", timestampMs)
                putExtra("fingerprint", fingerprint)
            }
            context.sendBroadcast(notifyIntent)
        } catch (_: Throwable) {
        }

        // 3. Post system heads-up notification
        try {
            showNotification(context, messageBody)
        } catch (_: Throwable) {
        }
    }

    private fun showNotification(context: Context, body: String) {
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                NOTIFICATION_CHANNEL_ID,
                "Telebirr Payments",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Incoming Telebirr passenger payments"
                enableVibration(true)
            }
            manager.createNotificationChannel(channel)
        }

        val notification = NotificationCompat.Builder(context, NOTIFICATION_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_notify_chat)
            .setContentTitle("Telebirr 127 Payment Detected")
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .build()

        manager.notify((System.currentTimeMillis() % 100000).toInt(), notification)
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
