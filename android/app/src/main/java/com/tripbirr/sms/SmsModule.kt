package com.tripbirr.sms

import android.Manifest
import android.content.pm.PackageManager
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class SmsModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "TripBirrSmsModule"

    @ReactMethod
    fun checkSmsPermission(promise: Promise) {
        val granted = ContextCompat.checkSelfPermission(
            reactContext,
            Manifest.permission.RECEIVE_SMS
        ) == PackageManager.PERMISSION_GRANTED
        promise.resolve(granted)
    }

    @ReactMethod
    fun drainPendingSmsQueue(promise: Promise) {
        try {
            val dbHelper = NativeSmsQueueDbHelper(reactContext.applicationContext)
            val db = dbHelper.readableDatabase
            val cursor = db.rawQuery(
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
        } catch (e: Exception) {
            promise.reject("ERR_SMS_QUEUE_DRAIN", e.message, e)
        }
    }

    @ReactMethod
    fun acknowledgeProcessedSms(fingerprint: String, promise: Promise) {
        try {
            val dbHelper = NativeSmsQueueDbHelper(reactContext.applicationContext)
            val db = dbHelper.writableDatabase
            // Redact raw SMS body once processed into transactions table to protect driver privacy
            db.execSQL(
                "DELETE FROM native_sms_queue WHERE fingerprint = ?",
                arrayOf(fingerprint)
            )
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("ERR_SMS_ACK", e.message, e)
        }
    }
}
