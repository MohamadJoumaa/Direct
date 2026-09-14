// Must come first: installs the Array methods Hermes lacks.
import "@/lib/polyfills";

import React, { useCallback, useEffect } from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/plus-jakarta-sans";
import {
  IBMPlexSansArabic_400Regular,
  IBMPlexSansArabic_500Medium,
  IBMPlexSansArabic_600SemiBold,
  IBMPlexSansArabic_700Bold,
} from "@expo-google-fonts/ibm-plex-sans-arabic";

import { AuthProvider } from "@/lib/auth-context";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { StoreProvider } from "@/lib/store-context";
import { ToastProvider } from "@/components/ui/toast";
import { ThemeProvider, useTheme } from "@/theme/theme-context";

// Hold the native splash until fonts are decoded, so the first frame is already
// in Plus Jakarta / IBM Plex rather than flashing the system face.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    IBMPlexSansArabic_400Regular,
    IBMPlexSansArabic_500Medium,
    IBMPlexSansArabic_600SemiBold,
    IBMPlexSansArabic_700Bold,
  });

  const onReady = useCallback(() => {
    void SplashScreen.hideAsync();
  }, []);

  // A missing font must not brick the app; falling through renders on the
  // system face instead of holding the splash forever.
  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <I18nProvider>
            <StoreProvider>
              <AuthProvider>
                <ToastProvider>
                  <AppFrame onReady={onReady} />
                </ToastProvider>
              </AuthProvider>
            </StoreProvider>
          </I18nProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Navigation chrome. Lives under the providers because the header has to read
 * the active palette and the active language, and because hiding the splash is
 * only correct once both have resolved.
 */
function AppFrame({ onReady }: { onReady: () => void }) {
  const { colors, scheme } = useTheme();
  const { dict, langReady } = useI18n();

  useEffect(() => {
    if (langReady) onReady();
  }, [langReady, onReady]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }} onLayout={onReady}>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.foreground,
          headerTitleStyle: { fontFamily: "PlusJakartaSans_600SemiBold", fontSize: 17 },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.background },
          headerBackButtonDisplayMode: "minimal",
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ title: dict.common.logIn }} />
        <Stack.Screen name="register" options={{ title: dict.auth.createYourAccount }} />
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
      </Stack>
    </View>
  );
}
