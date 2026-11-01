package com.tripbirr

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.load
import com.facebook.react.defaults.DefaultReactNativeHost
import com.facebook.soloader.SoLoader
import com.tripbirr.sms.SmsPackage

class MainApplication : Application(), ReactApplication {

    override val reactNativeHost: ReactNativeHost =
        object : DefaultReactNativeHost(this) {
            override fun getPackages(): List<ReactPackage> {
                val packages = try {
                    PackageList(this).packages.toMutableList()
                } catch (_: Throwable) {
                    mutableListOf()
                }
                packages.add(SmsPackage())
                return packages
            }

            override fun getJSMainModuleName(): String = "index"

            override fun getUseDeveloperSupport(): Boolean = false

            override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
            override val isHermesEnabled: Boolean = BuildConfig.IS_HERMES_ENABLED
        }

    override fun onCreate() {
        super.onCreate()
        try {
            SoLoader.init(this, false)
        } catch (_: Throwable) {
        }
        if (BuildConfig.IS_NEW_ARCHITECTURE_ENABLED) {
            try {
                load()
            } catch (_: Throwable) {
            }
        }
    }
}
