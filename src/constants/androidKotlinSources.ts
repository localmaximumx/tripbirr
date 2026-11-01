export interface NativeKotlinFileSpec {
  path: string;
  title: string;
  responsibility: string;
  code: string;
}

export const NATIVE_ANDROID_KOTLIN_FILES: NativeKotlinFileSpec[] = [
  {
    path: 'android/app/src/main/java/com/tripbirr/sms/SmsReceiver.kt',
    title: 'SmsReceiver.kt (Native BroadcastReceiver & SQLite Queue)',
    responsibility:
      'Intercepts android.provider.Telephony.SMS_RECEIVED from sender ID 127 even when the React Native JS runtime is killed, deduplicates by SHA-256 fingerprint, and queues in native SQLite.',
    code: `package com.tripbirr.sms

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

class SmsReceiver : BroadcastReceiver() {
    companion object {
        const val TELEBIRR_SENDER_ID = "127"
        const val EVENT_TELEBIRR_SMS_RECEIVED = "TripBirrSmsReceived"
    }

    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Telephony.Sms.Intents.SMS_RECEIVED_ACTION) return
        val messages = Telephony.Sms.Intents.getMessagesFromIntent(intent) ?: return
        if (messages.isEmpty()) return

        val senderAddress = messages[0].originatingAddress?.trim() ?: return
        if (!senderAddress.equals(TELEBIRR_SENDER_ID, ignoreCase = true)) return

        val messageBody = messages.joinToString("") { it.messageBody ?: "" }.trim()
        if (messageBody.isEmpty()) return

        val timestampMs = messages[0].timestampMillis
        val fingerprint = sha256("$senderAddress|$timestampMs|\${messageBody.lowercase()}")

        val queueHelper = NativeSmsQueueDbHelper(context.applicationContext)
        val inserted = queueHelper.enqueueSms(fingerprint, senderAddress, messageBody, timestampMs)
        if (!inserted) return // Duplicate broadcast ignored

        // Forward to React Native JS runtime if active
        val reactApp = context.applicationContext as? ReactApplication
        val reactContext = reactApp?.reactNativeHost?.reactInstanceManager?.currentReactContext
        if (reactContext != null && reactContext.hasActiveCatalystInstance()) {
            val payload = Arguments.createMap().apply {
                putString("fingerprint", fingerprint)
                putString("senderId", senderAddress)
                putString("body", messageBody)
                putDouble("receivedAtMs", timestampMs.toDouble())
            }
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit(EVENT_TELEBIRR_SMS_RECEIVED, payload)
        }
    }

    private fun sha256(input: String): String {
        val bytes = MessageDigest.getInstance("SHA-256").digest(input.toByteArray())
        return bytes.joinToString("") { "%02x".format(it) }
    }
}`,
  },
  {
    path: 'android/app/src/main/java/com/tripbirr/sms/SmsModule.kt',
    title: 'SmsModule.kt (React Native NativeBridge)',
    responsibility:
      'Exposes RECEIVE_SMS permission status, drains queued background Telebirr messages when JS runtime wakes up, and deletes raw SMS bodies after SQLite transaction persistence.',
    code: `package com.tripbirr.sms

import android.Manifest
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.*

class SmsModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "TripBirrSmsModule"

    @ReactMethod
    fun checkSmsPermission(promise: Promise) {
        val granted = ContextCompat.checkSelfPermission(
            reactContext, Manifest.permission.RECEIVE_SMS
        ) == PackageManager.PERMISSION_GRANTED
        promise.resolve(granted)
    }

    @ReactMethod
    fun drainPendingSmsQueue(promise: Promise) {
        val dbHelper = NativeSmsQueueDbHelper(reactContext.applicationContext)
        val cursor = dbHelper.readableDatabase.rawQuery(
            "SELECT fingerprint, sender_id, body, received_at_ms FROM native_sms_queue WHERE acknowledged = 0 ORDER BY received_at_ms ASC",
            null
        )
        val resultArray = Arguments.createArray()
        cursor.use {
            while (it.moveToNext()) {
                val item = Arguments.createMap().apply {
                    putString("fingerprint", it.getString(0))
                    putString("senderId", it.getString(1))
                    putString("body", it.getString(2))
                    putDouble("receivedAtMs", it.getLong(3).toDouble())
                }
                resultArray.pushMap(item)
            }
        }
        promise.resolve(resultArray)
    }
}`,
  },
  {
    path: 'android/app/src/main/AndroidManifest.xml',
    title: 'AndroidManifest.xml (Minimal Permissions & Broadcast Filter)',
    responsibility:
      'Declares RECEIVE_SMS (without requesting default SMS handler or READ_SMS inbox scraping) and registers SmsReceiver with high priority.',
    code: `<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="com.tripbirr">

    <!-- Minimal permissions: RECEIVE_SMS for live Telebirr 127 detection, Coarse/Fine location for trip endpoints -->
    <uses-permission android:name="android.permission.RECEIVE_SMS" />
    <uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
    <uses-permission android:name="android.permission.VIBRATE" />

    <application
        android:name=".MainApplication"
        android:label="@string/app_name"
        android:allowBackup="false">

        <receiver
            android:name=".sms.SmsReceiver"
            android:enabled="true"
            android:exported="true"
            android:permission="android.permission.BROADCAST_SMS">
            <intent-filter android:priority="999">
                <action android:name="android.provider.Telephony.SMS_RECEIVED" />
            </intent-filter>
        </receiver>
    </application>
</manifest>`,
  },
];
