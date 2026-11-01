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

export default function TripBirrReactNativeApp() {
  const webViewRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    // 1. Request SMS permission & drain any background SMS queued by SmsReceiver.kt
    requestAndroidReceiveSmsPermission()
      .then(async (granted) => {
        if (granted) {
          try {
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
          } catch (drainErr) {
            console.warn('Error draining SMS queue:', drainErr);
          }
        }
      })
      .catch((err) => {
        console.warn('SMS permission request error:', err);
      });

    // 2. Real-time native Telebirr 127 SMS listener
    let unsubscribe = () => {};
    try {
      unsubscribe = subscribeToNativeTelebirrSms(async (event) => {
        try {
          const payload = JSON.stringify(event);
          webViewRef.current?.injectJavaScript(`
            if (window.onNativeSmsReceived) {
              window.onNativeSmsReceived(${payload});
            }
            window.dispatchEvent(new CustomEvent('TripBirrSmsReceived', { detail: ${payload} }));
            true;
          `);
          await acknowledgeNativeSms(event.fingerprint);
        } catch (smsErr) {
          console.warn('Error forwarding SMS to WebView:', smsErr);
        }
      });
    } catch (subErr) {
      console.warn('subscribeToNativeTelebirrSms error:', subErr);
    }

    // 3. Android Hardware Back Button navigation
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
        mixedContentMode="always"
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
