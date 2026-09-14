import React from "react";
import type { ColorValue } from "react-native";
import { Tabs } from "expo-router";
import {
  Banknote,
  ClipboardList,
  Home,
  LayoutGrid,
  type LucideIcon,
  Package,
  PlusCircle,
  Route,
  User,
  Users,
  Wallet,
} from "lucide-react-native";

import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/theme/theme-context";

/**
 * One tab bar whose contents are chosen by the effective role.
 *
 * The website gives each role its own nav row in a shared header. A phone has
 * room for four or five destinations, so each role gets only the ones it
 * actually uses and everything else is pushed from one of them — admins reach
 * the long tail through More. `href: null` hides a screen without unmounting the
 * navigator, which is what lets the bar change the instant an admin switches
 * who they are viewing as.
 */
export default function TabsLayout() {
  const { colors } = useTheme();
  const { dict } = useI18n();
  const { effectiveRole } = useAuth();

  const isDriver = effectiveRole === "driver";
  const isAdmin = effectiveRole === "admin";
  const isCustomer = effectiveRole === "client" || effectiveRole === "business";

  // React Navigation hands the icon a `ColorValue`, which Lucide will not take;
  // the tab tints here are always plain hex strings from the palette.
  const icon =
    (Icon: LucideIcon) =>
    ({ color, size }: { color: ColorValue; size: number }) => (
      <Icon color={String(color)} size={size} />
    );

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.foreground,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
        },
        tabBarLabelStyle: {
          fontFamily: "PlusJakartaSans_500Medium",
          fontSize: 11,
        },
        // Keeps the whole label + icon block at a comfortable thumb size.
        tabBarItemStyle: { paddingVertical: 4 },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: isAdmin ? dict.nav.ordersTab : dict.nav.home,
          tabBarIcon: icon(isAdmin ? ClipboardList : Home),
        }}
      />

      {/* Client / business */}
      <Tabs.Screen
        name="new"
        options={{
          title: dict.nav.newOrder,
          tabBarIcon: icon(PlusCircle),
          href: isCustomer ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: dict.nav.history,
          tabBarIcon: icon(Package),
          href: isCustomer || isDriver ? undefined : null,
        }}
      />

      {/* Driver */}
      <Tabs.Screen
        name="route"
        options={{
          title: dict.driver.yourRoute,
          tabBarIcon: icon(Route),
          href: isDriver ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="earnings"
        options={{
          title: dict.nav.money,
          tabBarIcon: icon(Wallet),
          href: isDriver ? undefined : null,
        }}
      />

      {/* Admin */}
      <Tabs.Screen
        name="drivers"
        options={{
          title: dict.nav.drivers,
          tabBarIcon: icon(Users),
          href: isAdmin ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="money"
        options={{
          title: dict.nav.budget,
          tabBarIcon: icon(Banknote),
          href: isAdmin ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{
          title: dict.common.more,
          tabBarIcon: icon(LayoutGrid),
          href: isAdmin ? undefined : null,
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: dict.nav.profile,
          tabBarIcon: icon(User),
          // Admins reach Profile from the More tab; four items is the limit
          // before labels start truncating on a small phone.
          href: isAdmin ? null : undefined,
        }}
      />
    </Tabs>
  );
}
