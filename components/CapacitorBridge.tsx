'use client';

import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

// Wires up native shell behavior (status bar, splash screen, Android back
// button) when this page is running inside the Capacitor app. No-ops on the
// regular web deployment since Capacitor.isNativePlatform() is false there.
export default function CapacitorBridge() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let backListener: { remove: () => void } | undefined;

    (async () => {
      const [{ StatusBar, Style }, { SplashScreen }, { App }] = await Promise.all([
        import('@capacitor/status-bar'),
        import('@capacitor/splash-screen'),
        import('@capacitor/app'),
      ]);

      await StatusBar.setStyle({ style: Style.Light }).catch(() => {});
      await SplashScreen.hide().catch(() => {});

      backListener = await App.addListener('backButton', ({ canGoBack }) => {
        if (canGoBack) {
          window.history.back();
        } else {
          App.exitApp();
        }
      });
    })();

    return () => backListener?.remove();
  }, []);

  return null;
}
