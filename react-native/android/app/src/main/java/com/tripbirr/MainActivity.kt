package com.tripbirr

import android.Manifest
import android.annotation.SuppressLint
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.content.pm.PackageManager
import android.location.Geocoder
import android.location.Location
import android.location.LocationManager
import android.os.Build
import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.webkit.*
import androidx.activity.OnBackPressedCallback
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import androidx.webkit.WebViewAssetLoader
import com.tripbirr.sms.NativeSmsQueueDbHelper
import com.tripbirr.sms.SmsReceiver
import org.json.JSONArray
import org.json.JSONObject
import java.util.Locale

class MainActivity : AppCompatActivity(), TextToSpeech.OnInitListener {

    private lateinit var webView: WebView
    private var tts: TextToSpeech? = null
    private var ttsReady = false

    private val smsInternalReceiver = object : BroadcastReceiver() {
        override fun onReceive(context: Context?, intent: Intent?) {
            drainAndForwardPendingSms()
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // 1. Initialize TextToSpeech engine
        try {
            tts = TextToSpeech(applicationContext, this)
        } catch (_: Throwable) {
        }

        // 2. Setup Android WebView with official Google WebViewAssetLoader
        // This maps local assets to https://appassets.androidplatform.net/assets/
        // providing a secure https origin for seamless ES modules, CORS, and IndexedDB
        val assetLoader = WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", WebViewAssetLoader.AssetsPathHandler(this))
            .build()

        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.databaseEnabled = true
            settings.allowFileAccess = true
            settings.allowFileAccessFromFileURLs = true
            settings.allowUniversalAccessFromFileURLs = true
            settings.mixedContentMode = WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
            settings.setGeolocationEnabled(true)
            settings.cacheMode = WebSettings.LOAD_DEFAULT

            webChromeClient = object : WebChromeClient() {
                override fun onGeolocationPermissionsShowPrompt(
                    origin: String?,
                    callback: GeolocationPermissions.Callback?
                ) {
                    // Auto-grant geolocation to local web app
                    callback?.invoke(origin, true, false)
                }
            }

            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(
                    view: WebView,
                    request: WebResourceRequest
                ): WebResourceResponse? {
                    return assetLoader.shouldInterceptRequest(request.url)
                }

                override fun onPageFinished(view: WebView?, url: String?) {
                    super.onPageFinished(view, url)
                    drainAndForwardPendingSms()
                }
            }

            addJavascriptInterface(TripBirrWebAppInterface(), "TripBirrNative")
        }

        setContentView(webView)
        webView.loadUrl("https://appassets.androidplatform.net/assets/web/index.html")

        // 3. Hardware back button handling
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (webView.canGoBack()) {
                    webView.goBack()
                } else {
                    finish()
                }
            }
        })

        // 4. Request runtime permissions (SMS and Fine Location)
        requestAppPermissions()

        // 5. Register internal broadcast receiver for incoming Telebirr SMS
        val filter = IntentFilter(SmsReceiver.ACTION_NEW_TELEBIRR_SMS)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(smsInternalReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
        } else {
            @Suppress("DEPRECATION")
            registerReceiver(smsInternalReceiver, filter)
        }
    }

    override fun onDestroy() {
        try {
            unregisterReceiver(smsInternalReceiver)
        } catch (_: Throwable) {
        }
        try {
            tts?.stop()
            tts?.shutdown()
        } catch (_: Throwable) {
        }
        super.onDestroy()
    }

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            try {
                tts?.language = Locale.US
                ttsReady = true
            } catch (_: Throwable) {
            }
        }
    }

    private fun requestAppPermissions() {
        val permissions = mutableListOf<String>()
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECEIVE_SMS) != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.RECEIVE_SMS)
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.ACCESS_FINE_LOCATION)
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            permissions.add(Manifest.permission.ACCESS_COARSE_LOCATION)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                permissions.add(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
        if (permissions.isNotEmpty()) {
            ActivityCompat.requestPermissions(this, permissions.toTypedArray(), 101)
        }
    }

    fun drainAndForwardPendingSms() {
        try {
            val dbHelper = NativeSmsQueueDbHelper(applicationContext)
            val db = dbHelper.readableDatabase
            val cursor = db.rawQuery(
                "SELECT fingerprint, sender_id, body, received_at_ms FROM native_sms_queue WHERE acknowledged = 0 ORDER BY received_at_ms ASC",
                null
            )
            val jsonArray = JSONArray()
            cursor.use {
                while (it.moveToNext()) {
                    val item = JSONObject().apply {
                        put("fingerprint", it.getString(0))
                        put("senderId", it.getString(1))
                        put("body", it.getString(2))
                        put("timestamp", it.getLong(3))
                    }
                    jsonArray.put(item)
                }
            }
            if (jsonArray.length() > 0) {
                val payloadStr = jsonArray.toString()
                webView.post {
                    val script = """
                        if (window.onNativeQueuedSmsDrained) {
                            window.onNativeQueuedSmsDrained($payloadStr);
                        }
                        try {
                            var queue = $payloadStr;
                            for (var i = 0; i < queue.length; i++) {
                                window.dispatchEvent(new CustomEvent('TripBirrSmsReceived', { detail: queue[i] }));
                            }
                        } catch(e) {}
                        true;
                    """.trimIndent()
                    webView.evaluateJavascript(script, null)
                }
            }
        } catch (_: Throwable) {
        }
    }

    /**
     * Native JavascriptInterface exposed to window.TripBirrNative in the Web Application.
     */
    inner class TripBirrWebAppInterface {

        @JavascriptInterface
        fun getAppVersion(): String = "1.0.0"

        @JavascriptInterface
        fun isNativeBridgeReady(): Boolean = true

        @JavascriptInterface
        fun requestPermissions() {
            runOnUiThread {
                requestAppPermissions()
            }
        }

        @JavascriptInterface
        fun speakPayment(amountFormatted: String, senderName: String, timeFormatted: String, spokenText: String) {
            if (ttsReady && tts != null) {
                val text = spokenText.ifEmpty { "Payment received $amountFormatted" }
                tts?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "tripbirr_tts")
            }
        }

        @JavascriptInterface
        fun acknowledgeSms(fingerprint: String) {
            try {
                val dbHelper = NativeSmsQueueDbHelper(applicationContext)
                val db = dbHelper.writableDatabase
                db.execSQL("UPDATE native_sms_queue SET acknowledged = 1 WHERE fingerprint = ?", arrayOf(fingerprint))
            } catch (_: Throwable) {
            }
        }

        @JavascriptInterface
        fun captureGps(): String {
            val result = JSONObject()
            try {
                val locationManager = getSystemService(Context.LOCATION_SERVICE) as? LocationManager
                if (locationManager != null) {
                    val providers = listOf(
                        LocationManager.GPS_PROVIDER,
                        LocationManager.NETWORK_PROVIDER,
                        LocationManager.PASSIVE_PROVIDER
                    )
                    var bestLocation: Location? = null
                    for (provider in providers) {
                        if (locationManager.isProviderEnabled(provider)) {
                            @Suppress("MissingPermission")
                            val candidate = locationManager.getLastKnownLocation(provider) ?: continue
                            if (bestLocation == null || candidate.time > bestLocation.time) {
                                bestLocation = candidate
                            }
                        }
                    }
                    if (bestLocation != null) {
                        result.put("latitude", bestLocation.latitude)
                        result.put("longitude", bestLocation.longitude)
                        result.put("accuracy", bestLocation.accuracy.toDouble())
                        result.put("source", "GPS")
                        result.put("timestamp", System.currentTimeMillis())

                        var resolved = resolveAddisAbabaLandmark(bestLocation.latitude, bestLocation.longitude)
                        if (resolved.isEmpty() && Geocoder.isPresent()) {
                            try {
                                val geocoder = Geocoder(this@MainActivity, Locale.ENGLISH)
                                @Suppress("DEPRECATION")
                                val addresses = geocoder.getFromLocation(bestLocation.latitude, bestLocation.longitude, 1)
                                if (!addresses.isNullOrEmpty()) {
                                    val addr = addresses[0]
                                    resolved = listOfNotNull(addr.featureName, addr.subLocality, addr.locality).distinct().joinToString(", ")
                                }
                            } catch (_: Throwable) {}
                        }
                        if (resolved.isNotEmpty()) {
                            result.put("placeName", resolved)
                        }
                    }
                }
            } catch (_: Throwable) {
            }
            return result.toString()
        }

        private fun resolveAddisAbabaLandmark(lat: Double, lng: Double): String {
            val landmarks = listOf(
                Landmark("Ayat 49 Chefie Condominium, Addis Ababa", "Bole", 9.0315, 38.8965),
                Landmark("Ayat Zone 2 / 3, Addis Ababa", "Bole", 9.0268, 38.8892),
                Landmark("Ayat Square, Addis Ababa", "Bole", 9.0185, 38.8812),
                Landmark("Yeka Abado Condominium, Addis Ababa", "Yeka", 9.0412, 38.8895),
                Landmark("Tafo / Meri Lukie, Addis Ababa", "Yeka", 9.0495, 38.8785),
                Landmark("CMC Michael, Addis Ababa", "Bole", 9.0229, 38.8467),
                Landmark("Summit Condominium, Addis Ababa", "Bole", 9.0052, 38.8542),
                Landmark("Megenagna, Addis Ababa", "Yeka", 9.0205, 38.8024),
                Landmark("Bole Medhanialem, Addis Ababa", "Bole", 8.9974, 38.7868),
                Landmark("4 Kilo, Addis Ababa", "Arada", 9.0331, 38.7636),
                Landmark("Piassa, Addis Ababa", "Arada", 9.0358, 38.7524),
                Landmark("Mexico Square, Addis Ababa", "Kirkos", 9.0104, 38.7445),
                Landmark("Kazanchis, Addis Ababa", "Kirkos", 9.0168, 38.7675),
                Landmark("Merkato, Addis Ababa", "Addis Ketema", 9.0308, 38.7369),
                Landmark("Meskel Square, Addis Ababa", "Kirkos", 9.0108, 38.7612),
                Landmark("Sarbet, Addis Ababa", "Nifas Silk-Lafto", 8.9942, 38.7378),
                Landmark("Gotera, Addis Ababa", "Kirkos", 8.9854, 38.7601),
                Landmark("Autobus Tera, Addis Ababa", "Addis Ketema", 9.0352, 38.7321)
            )
            var closest: Landmark? = null
            var minDist = Double.MAX_VALUE
            for (lm in landmarks) {
                val d = haversineMeters(lat.toDouble(), lng.toDouble(), lm.lat, lm.lng)
                if (d < minDist) {
                    minDist = d
                    closest = lm
                }
            }
            return when {
                closest != null && minDist <= 500 -> closest.name
                closest != null && minDist <= 2500 -> "Near ${closest.name.replace(", Addis Ababa", "")}, ${closest.subCity}, Addis Ababa"
                else -> ""
            }
        }

        private fun haversineMeters(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Double {
            val r = 6371000.0
            val dLat = Math.toRadians(lat2 - lat1)
            val dLon = Math.toRadians(lon2 - lon1)
            val a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                    Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2)) *
                    Math.sin(dLon / 2) * Math.sin(dLon / 2)
            val c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
            return r * c
        }
    }

    private data class Landmark(val name: String, val subCity: String, val lat: Double, val lng: Double)
}
