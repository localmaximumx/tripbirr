import React, { useEffect, useRef, useState } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  BackHandler,
} from 'react-native';
import { WebView } from 'react-native-webview';
import {
  requestAndroidReceiveSmsPermission,
  drainPendingNativeSmsQueue,
  subscribeToNativeTelebirrSms,
  getCurrentDeviceLocation,
  triggerNativePaymentNotification,
  acknowledgeNativeSms,
} from './src/native/TripBirrNativeBridge';
import { initializeNativeSqliteDatabase } from './src/database/sqliteNative';

export default function TripBirrReactNativeApp() {
  const webViewRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    // 1. Initialize native SQLite tables
    initializeNativeSqliteDatabase();

    // 2. Request SMS permission & drain any background SMS queued by SmsReceiver.kt
    requestAndroidReceiveSmsPermission().then(async (granted) => {
      if (granted) {
        const queued = await drainPendingNativeSmsQueue();
        if (queued && queued.length > 0) {
          const payload = JSON.stringify(queued);
          webViewRef.current?.injectJavaScript(`
            if (window.onNativeQueuedSmsDrained) {
              window.onNativeQueuedSmsDrained(${payload});
            }
            true;
          `);
          for (const item of queued) {
            await acknowledgeNativeSms(item.fingerprint);
          }
        }
      }
    });

    // 3. Real-time native Telebirr 127 SMS listener
    const unsubscribe = subscribeToNativeTelebirrSms(async (event) => {
      const payload = JSON.stringify(event);
      webViewRef.current?.injectJavaScript(`
        if (window.onNativeSmsReceived) {
          window.onNativeSmsReceived(${payload});
        }
        window.dispatchEvent(new CustomEvent('TripBirrSmsReceived', { detail: ${payload} }));
        true;
      `);
      await acknowledgeNativeSms(event.fingerprint);
    });

    // 4. Android Hardware Back Button navigation
    const backAction = () => {
      if (canGoBack && webViewRef.current) {
        webViewRef.current.goBack();
        return true;
      }
      return false;
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);

    return () => {
      unsubscribe();
      backHandler.remove();
    };
  }, [canGoBack]);

  // Handle messages dispatched from Web Application -> React Native Native Bridge
  const handleMessage = async (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'CAPTURE_GPS') {
        try {
          const fix = await getCurrentDeviceLocation();
          webViewRef.current?.injectJavaScript(`
            if (window.onNativeGpsCaptured) {
              window.onNativeGpsCaptured(${JSON.stringify(fix)});
            }
            true;
          `);
        } catch (err: any) {
          webViewRef.current?.injectJavaScript(`
            if (window.onNativeGpsError) {
              window.onNativeGpsError(${JSON.stringify(err.message || 'GPS fix failed')});
            }
            true;
          `);
        }
      } else if (data.type === 'SPEAK_PAYMENT') {
        await triggerNativePaymentNotification({
          amountFormatted: data.amountFormatted || '',
          senderName: data.senderName || 'Telebirr Passenger',
          timeFormatted: data.timeFormatted || '',
          speakVoice: true,
          spokenText: data.spokenText || '',
        });
      }
    } catch {
      // Ignore non-json messages
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#123C35" />
      <WebView
        ref={webViewRef}
        source={{ uri: 'file:///android_asset/web/index.html' }}
        style={styles.webview}
        originWhitelist={['*']}
        allowFileAccess={true}
        allowFileAccessFromFileURLs={true}
        allowUniversalAccessFromFileURLs={true}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        geolocationEnabled={true}
        onNavigationStateChange={(navState) => setCanGoBack(navState.canGoBack)}
        onMessage={handleMessage}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#123C35',
  },
  webview: {
    flex: 1,
    backgroundColor: '#101A17',
  },
});
