package com.tripbirr.notifications

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import android.speech.tts.TextToSpeech
import androidx.core.app.NotificationCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.Locale

/**
 * Native Android offline payment notification & TextToSpeech voice announcement module.
 */
class NotificationModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), TextToSpeech.OnInitListener {

    companion object {
        const val CHANNEL_ID = "tripbirr_payments_channel"
    }

    private var tts: TextToSpeech? = null
    private var ttsReady = false

    init {
        tts = TextToSpeech(reactContext.applicationContext, this)
        createNotificationChannel()
    }

    override fun getName(): String = "TripBirrNotificationModule"

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            tts?.language = Locale.US
            ttsReady = true
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Telebirr Incoming Payments",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Alerts when a valid Telebirr 127 payment is received"
            }
            val manager = reactContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }

    @ReactMethod
    fun showPaymentNotification(
        amountFormatted: String,
        senderName: String,
        timeFormatted: String,
        speakVoice: Boolean,
        spokenText: String,
        promise: Promise
    ) {
        try {
            val manager =
                reactContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            val notification = NotificationCompat.Builder(reactContext, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle("Payment received · $amountFormatted")
                .setContentText("From: $senderName · Time: $timeFormatted")
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true)
                .build()

            manager.notify((System.currentTimeMillis() % 100000).toInt(), notification)

            if (speakVoice && ttsReady) {
                tts?.speak(spokenText, TextToSpeech.QUEUE_FLUSH, null, "tripbirr_tts")
            }
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERR_NOTIF", e.message, e)
        }
    }
}
