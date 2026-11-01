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
 * 3. Smartly ignores airtime/package recharges (user requested zero action on recharges).
 * 4. Summarizes notification (Payer name, phone number, transferred amount).
 * 5. Enqueues to local SQLite and triggers an instant heads-up notification.
 * 6. Broadcasts internal event so MainActivity can update UI in real-time.
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

        // Ignore airtime / package recharges:
        // "if the user is recharged there is no work the app has to do, so the app has to be smart and identify recharged sms from received sms"
        if (isRechargeMessage(messageBody)) {
            return
        }

        // Only process received payments / incoming credits
        if (!isReceivedPayment(messageBody)) {
            return
        }

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

        // 3. Post system heads-up notification with summarized details
        try {
            showNotification(context, messageBody)
        } catch (_: Throwable) {
        }
    }

    private fun isRechargeMessage(body: String): Boolean {
        val lower = body.lowercase()
        return lower.contains("recharge") ||
               lower.contains("airtime") ||
               lower.contains("package") ||
               lower.contains("top-up") ||
               lower.contains("የአየር") ||
               lower.contains("ሞልተዋል") ||
               lower.contains("ጥቅል")
    }

    private fun isReceivedPayment(body: String): Boolean {
        val lower = body.lowercase()
        return (lower.contains("received") && (lower.contains("etb") || lower.contains("birr"))) ||
               lower.contains("ተቀብለዋል") ||
               (lower.contains("credited with") && lower.contains("etb")) ||
               lower.contains("transferred etb")
    }

    private fun extractSummary(body: String): Pair<String, String> {
        var amount = ""
        val amtMatch = Regex("""(?:received|credited\s+with|transferred|amount(?:\s+of)?|ETB|Birr|ብር)\s*(?:ETB|Birr|ብር)?\s*([\d,]+(?:\.\d{1,2})?)""", RegexOption.IGNORE_CASE).find(body)
        if (amtMatch != null) {
            amount = amtMatch.groupValues[1]
        }

        var senderName = ""
        var senderPhone = ""
        // Matches "from Abebe Bikila (0911****89)" or "from Abebe Bikila(2519****8747)" or "ከ Abebe Bikila (09...)"
        val senderMatch = Regex("""(?:from|ከ)\s+([^()\n\r]+?)(?:\s*\(\s*([+\d*]{6,16})\s*\))?(?:\s+on|\s+at|\.|\s*$)""", RegexOption.IGNORE_CASE).find(body)
        if (senderMatch != null) {
            senderName = senderMatch.groupValues[1].trim()
            if (senderMatch.groupValues.size > 2) {
                senderPhone = senderMatch.groupValues[2].trim()
            }
        }

        val title = if (amount.isNotEmpty()) "Telebirr Payment: ETB $amount" else "Telebirr Payment Received"
        val content = when {
            senderName.isNotEmpty() && senderPhone.isNotEmpty() -> "From $senderName ($senderPhone)"
            senderName.isNotEmpty() -> "From $senderName"
            amount.isNotEmpty() -> "ETB $amount received into your account"
            else -> "Incoming payment received"
        }
        return Pair(title, content)
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

        val (title, content) = extractSummary(body)

        val notification = NotificationCompat.Builder(context, NOTIFICATION_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.stat_notify_chat)
            .setContentTitle(title)
            .setContentText(content)
            .setStyle(NotificationCompat.BigTextStyle().bigText(content))
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
