import React from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import { Redirect, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Bike, PackageCheck, ShieldCheck, Zap } from "lucide-react-native";

import { AppControls } from "@/components/app-controls";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Row, Stack } from "@/components/ui/layout";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { useTheme } from "@/theme/theme-context";
import { radius, space } from "@/theme/tokens";

// The icon + wordmark lockup the website puts in its header. The full
// `logo-lockup.png` is a hero asset and reads as a smudge at header size.
const LOGO_ICON = require("../assets/logo-icon.png");

/**
 * Public landing.
 *
 * The website's landing page sells the product across a long scroll; a phone
 * gets the same promise in one screen with the two decisions that matter --
 * send something, or drive -- above the fold.
 */
export default function Landing() {
  const { ready, user } = useAuth();
  const { dict } = useI18n();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();

  // Already signed in: never show the pitch again.
  if (ready && user) return <Redirect href="/home" />;

  const points = [
    { Icon: Zap, title: dict.home.fast, body: dict.home.fastBody },
    { Icon: ShieldCheck, title: dict.home.safe, body: dict.home.safeBody },
    { Icon: PackageCheck, title: dict.home.reliable, body: dict.home.reliableBody },
  ];

  const steps = [dict.home.how1, dict.home.how2, dict.home.how3, dict.home.how4];

  return (
    <Screen gap="lg" style={{ paddingTop: insets.top }}>
      <Row justify="space-between">
        <Row gap="sm">
          <Image
            source={LOGO_ICON}
            style={{ width: 40, height: 31 }}
            contentFit="contain"
            accessibilityLabel="Direct"
          />
          <Text variant="heading" weight="extrabold">
            Direct
          </Text>
        </Row>
        <AppControls />
      </Row>

      <Stack gap="sm" style={{ paddingTop: space.md }}>
        <Text variant="display" weight="extrabold">
          {dict.home.heroTitle1}
        </Text>
        <Text variant="display" weight="extrabold" color="mutedForeground">
          {dict.home.heroTitle2}
        </Text>
        <Text variant="body" color="mutedForeground" style={{ paddingTop: space.xs }}>
          {dict.common.tagline}
        </Text>
      </Stack>

      <Stack gap="sm">
        <Button
          title={dict.home.sendPackage}
          size="lg"
          onPress={() => router.push("/register")}
        />
        <Button
          title={dict.home.becomeDriver}
          variant="outline"
          size="lg"
          icon={<Bike size={18} color={colors.foreground} />}
          onPress={() => router.push("/register")}
        />
        <Button
          title={dict.common.logIn}
          variant="ghost"
          size="md"
          full
          onPress={() => router.push("/login")}
        />
      </Stack>

      <Stack gap="sm">
        {points.map(({ Icon, title, body }) => (
          <Card key={title}>
            <Row gap="md" align="flex-start">
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: radius.full,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: colors.secondary,
                }}
              >
                <Icon size={20} color={colors.foreground} />
              </View>
              <Stack gap={2} flex={1}>
                <Text variant="subheading" weight="semibold">
                  {title}
                </Text>
                <Text variant="callout" color="mutedForeground">
                  {body}
                </Text>
              </Stack>
            </Row>
          </Card>
        ))}
      </Stack>

      <Stack gap="sm">
        <Text variant="heading" weight="bold">
          {dict.home.howTitle}
        </Text>
        <Card>
          <Stack gap="md">
            {steps.map((step, i) => (
              <Row key={step} gap="md" align="flex-start">
                <View
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: radius.full,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: colors.primary,
                  }}
                >
                  <Text
                    variant="caption"
                    weight="bold"
                    numeric
                    style={{ color: colors.primaryForeground }}
                  >
                    {i + 1}
                  </Text>
                </View>
                <Text variant="callout" style={{ flex: 1 }}>
                  {step}
                </Text>
              </Row>
            ))}
          </Stack>
        </Card>
      </Stack>

      {/* Gold is decorative only: a hairline above the footer, never a fill. */}
      <View style={{ height: 1, backgroundColor: colors.gold, opacity: 0.5 }} />
      <Text variant="caption" color="mutedForeground" center>
        {dict.home.copyright}
      </Text>
    </Screen>
  );
}
