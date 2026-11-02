---
name: offline-hybrid-webview
description: >-
  Architect, build, package, and troubleshoot offline-first hybrid mobile apps using
  a React/Vite SPA bundled locally inside a React Native Android/iOS WebView with
  a bidirectional native bridge. Use when building hybrid web-in-app mobile applications,
  setting up native hardware bridges (TTS, GPS, SMS, back button), or automating
  web-to-native asset synchronization.
---

# Offline-First Hybrid WebView Mobile Architecture

This skill provides the architectural blueprint, packaging workflow, and bidirectional communication bridge for bundling modern web applications (React + Vite + Tailwind CSS) inside a native shell (React Native WebView) with zero cloud hosting dependency for the UI bundle.

---

## 1. Core Architecture

The web app is compiled into a single static distribution (`dist/`) and bundled directly into the mobile application's native asset directory (`android/app/src/main/assets/web/`).

```
┌────────────────────────────────────────────────────────┐
│  React Native Host Container (Android / iOS)           │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Native Services & Listeners                      │  │
│  │ • Android Telephony BroadcastReceiver            │  │
│  │ • Hardware BackHandler                           │  │
│  │ • Native Text-to-Speech (TTS Engine)             │  │
│  │ • GPS Geolocation Service                        │  │
│  └──────────────────────────────────────────────────┘  │
│                           ▲                            │
│           postMessage     │     injectJavaScript       │
│           (JSON events)   │     (window.dispatchEvent) │
│                           ▼                            │
│  ┌──────────────────────────────────────────────────┐  │
│  │ React Native WebView                             │  │
│  │ source: file:///android_asset/web/index.html     │  │
│  │                                                  │  │
│  │  ┌────────────────────────────────────────────┐  │  │
│  │  │ React + Vite Client Application            │  │  │
│  │  │ • Zustand / Redux Offline Store            │  │  │
│  │  │ • Local Database / Storage                 │  │  │
│  │  │ • Bilingual UI & Touch Gesture Engine      │  │  │
│  │  └────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

---

## 2. Vite Configuration for Asset-Bundled WebView

In `vite.config.ts`, configure relative base paths so assets resolve correctly from `file:///android_asset/web/`:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: './', // CRITICAL: Ensures relative paths for file:/// asset protocol
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    emptyOutDir: true,
  },
});
```

---

## 3. Bidirectional Native Bridge Protocol

### A. Web to Native Communication (`postMessage`)

In the web application, wrap native calls with graceful browser fallbacks:

```typescript
// src/services/nativeBridge.ts

interface BridgeMessage {
  type: 'REQUEST_LOCATION' | 'SPEAK_PAYMENT' | 'REQUEST_SMS_PERMISSION' | 'EXIT_APP';
  [key: string]: any;
}

export function sendToNative(message: BridgeMessage): void {
  const win = window as any;
  if (win.ReactNativeWebView?.postMessage) {
    win.ReactNativeWebView.postMessage(JSON.stringify(message));
  } else {
    // Development browser fallback
    console.debug('[NativeBridge (Browser Fallback)]:', message);
    if (message.type === 'SPEAK_PAYMENT' && 'speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(message.spokenText);
      window.speechSynthesis.speak(utterance);
    }
  }
}
```

### B. Native to Web Communication (`injectJavaScript` + Custom Events)

In React Native (`App.tsx`), handle incoming messages from web and dispatch events back into the WebView:

```typescript
// react-native/App.tsx
import React, { useRef } from 'react';
import { BackHandler, SafeAreaView, StatusBar, ToastAndroid } from 'react-native';
import { WebView } from 'react-native-webview';

export default function App() {
  const webViewRef = useRef<WebView>(null);
  const lastBackPressTime = useRef<number>(0);

  const handleMessage = async (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === 'SPEAK_PAYMENT') {
        // Native Text-to-Speech audio announcement
        NativeSpeechModule.speak(data.spokenText);
      } else if (data.type === 'REQUEST_LOCATION') {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const payload = JSON.stringify(pos.coords);
            webViewRef.current?.injectJavaScript(`
              window.dispatchEvent(new CustomEvent('NativeLocationReceived', { detail: ${payload} }));
              true;
            `);
          },
          (err) => {
            webViewRef.current?.injectJavaScript(`
              window.dispatchEvent(new CustomEvent('NativeLocationError', { detail: ${JSON.stringify(err.message)} }));
              true;
            `);
          },
          { enableHighAccuracy: true, timeout: 10000 }
        );
      }
    } catch (err) {
      console.warn('Bridge parse error:', err);
    }
  };

  // Hardware Android Back Button Handler
  useEffect(() => {
    const onBackPress = () => {
      const now = Date.now();
      if (now - lastBackPressTime.current < 2000) {
        BackHandler.exitApp();
        return true;
      }
      lastBackPressTime.current = now;
      ToastAndroid.show('Press back again to exit', ToastAndroid.SHORT);
      return true;
    };

    const sub = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => sub.remove();
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#0B0F1A' }}>
      <StatusBar barStyle="light-content" backgroundColor="#0B0F1A" />
      <WebView
        ref={webViewRef}
        source={{ uri: 'file:///android_asset/web/index.html' }}
        style={{ flex: 1, backgroundColor: '#0B0F1A' }}
        originWhitelist={['*']}
        allowFileAccess={true}
        allowFileAccessFromFileURLs={true}
        allowUniversalAccessFromFileURLs={true}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        geolocationEnabled={true}
        mixedContentMode="always"
        onMessage={handleMessage}
      />
    </SafeAreaView>
  );
}
```

---

## 4. Automated Build & Asset Synchronization

To keep the native Android bundle in sync with web application code changes, execute this packaging sequence:

```powershell
# 1. Typecheck and build the Vite production distribution
npm run build

# 2. Clear previous hashed bundles in Android assets to avoid orphaned files
Remove-Item -Path "react-native\android\app\src\main\assets\web\assets\index-*.js", "react-native\android\app\src\main\assets\web\assets\index-*.css" -Force -ErrorAction SilentlyContinue

# 3. Synchronize new build output
Copy-Item -Path "dist\*" -Destination "react-native\android\app\src\main\assets\web" -Recurse -Force
```

---

## 5. Critical Troubleshooting Checklist

| Issue | Cause | Fix |
| :--- | :--- | :--- |
| **Blank white screen on app launch** | Absolute asset paths (e.g. `/assets/app.js` instead of `./assets/app.js`) | Set `base: './'` in `vite.config.ts`. |
| **CORS errors when reading local files or DB** | WebView sandbox restrictions | Enable `allowFileAccessFromFileURLs={true}` and `allowUniversalAccessFromFileURLs={true}` on the `<WebView>`. |
| **Stale JavaScript loaded on device** | Cached hashed bundles in assets directory | Remove stale `index-*.js` and `index-*.css` files before copying new `dist/*`. |
| **Hardware back button closes app abruptly** | Default Android activity lifecycle | Register a `BackHandler` listener with double-tap exit threshold (2000ms). |
