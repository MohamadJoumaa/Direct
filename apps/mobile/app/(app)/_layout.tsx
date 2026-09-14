import React from "react";
import { ActivityIndicator, View } from "react-native";
import { Redirect, Stack } from "expo-router";

import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/theme/theme-context";

/**
 * Auth gate for everything signed in.
 *
 * Mirrors the website's `src/app/app/layout.tsx`. Detail screens live here
 * rather than inside the tab layout so they push *over* the tab bar instead of
 * becoming tabs of their own.
 */
export default function AppLayout() {
  const { ready, user } = useAuth();
  const { colors } = useTheme();
  const { dict } = useI18n();

  // Never bounce to /login before the persisted session has loaded, or a cold
  // start would sign the user out on every launch.
  if (!ready) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator color={colors.mutedForeground} />
      </View>
    );
  }

  if (!user) return <Redirect href="/login" />;

  return (
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
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="orders/[id]" options={{ title: dict.common.orderNumber }} />
      <Stack.Screen name="notifications" options={{ title: dict.common.notifications }} />
      <Stack.Screen name="documents" options={{ title: dict.profile.legalDocuments }} />
      <Stack.Screen name="admin/drivers/[id]" options={{ title: dict.common.driver }} />
      <Stack.Screen name="admin/warehouses" options={{ title: dict.nav.warehouses }} />
      <Stack.Screen name="admin/businesses" options={{ title: dict.nav.businesses }} />
      <Stack.Screen name="admin/documents" options={{ title: dict.nav.documents }} />
      <Stack.Screen name="admin/settings" options={{ title: dict.nav.settings }} />
      <Stack.Screen name="admin/reports" options={{ title: dict.nav.reports }} />
    </Stack>
  );
}
