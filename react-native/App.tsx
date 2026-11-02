import React, { useEffect, useRef, useState } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  BackHandler,
  ToastAndroid,
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
  const lastBackPressTime = useRef<number>(0);

  const requestPermissionsManually = async () => {
    try {
      const granted = await requestAndroidReceiveSmsPermission();
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
    } catch (err) {
      console.warn('Manual permission request error:', err);
    }
  };

  useEffect(() => {
    // 1. Real-time native Telebirr 127 SMS listener
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

    // 2. Android Hardware Back Button navigation
    const backAction = () => {
      webViewRef.current?.injectJavaScript(`
        (function() {
          var handled = (typeof window.handleHardwareBackPress === 'function') ? window.handleHardwareBackPress() : false;
          window.ReactNativeWebView?.postMessage(JSON.stringify({ type: 'BACK_ACTION_RESULT', handled: Boolean(handled) }));
        })();
        true;
      `);
      return true; // prevent immediate exit
    };
    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);

    return () => {
      unsubscribe();
      backHandler.remove();
    };
  }, []);

  // Handle messages dispatched from Web Application -> React Native Native Bridge
  const handleMessage = async (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'REQUEST_PERMISSIONS') {
        await requestPermissionsManually();
      } else if (data.type === 'BACK_ACTION_RESULT') {
        if (!data.handled) {
          if (canGoBack && webViewRef.current) {
            webViewRef.current.goBack();
          } else {
            const now = Date.now();
            if (now - lastBackPressTime.current < 2000) {
              BackHandler.exitApp();
            } else {
              lastBackPressTime.current = now;
              ToastAndroid.show('Press back again to exit', ToastAndroid.SHORT);
            }
          }
        }
      } else if (data.type === 'CAPTURE_GPS') {
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
