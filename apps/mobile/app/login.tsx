import React, { useState } from "react";
import { Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Eye, EyeOff } from "lucide-react-native";

import { Button, IconButton } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Row, Stack } from "@/components/ui/layout";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store-context";
import { useTheme } from "@/theme/theme-context";

const DEMO_ACCOUNTS = [
  { email: "admin@direct.lb", password: "admin123" },
  { email: "client@direct.lb", password: "client123" },
  { email: "business@direct.lb", password: "biz123" },
  { email: "fast@direct.lb", password: "driver123" },
];

export default function Login() {
  const { dict } = useI18n();
  const { colors } = useTheme();
  const { login } = useStore();
  const toast = useToast();
  const router = useRouter();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  function submit() {
    setSubmitting(true);
    const error = login(identifier.trim(), password);
    setSubmitting(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success(dict.auth.welcomeBackToast);
    // replace, not push: the login screen must not sit under the app in the
    // back stack where a hardware back button could return to it signed in.
    router.replace("/home");
  }

  const canSubmit = identifier.trim().length > 0 && password.length > 0;

  return (
    <Screen
      gap="lg"
      footer={
        <Button
          title={dict.common.logIn}
          size="lg"
          disabled={!canSubmit}
          loading={submitting}
          onPress={submit}
        />
      }
    >
      <Stack gap="xs">
        <Text variant="title" weight="extrabold">
          {dict.auth.welcomeBack}
        </Text>
        <Text variant="callout" color="mutedForeground">
          {dict.auth.loginSub}
        </Text>
      </Stack>

      <Stack gap="md">
        <Field
          label={dict.auth.emailOrPhone}
          value={identifier}
          onChangeText={setIdentifier}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="username"
          returnKeyType="next"
        />
        <Field
          label={dict.common.password}
          value={password}
          onChangeText={setPassword}
          secureTextEntry={!reveal}
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={() => canSubmit && submit()}
          suffix={
            <IconButton
              accessibilityLabel={reveal ? "Hide password" : "Show password"}
              onPress={() => setReveal((v) => !v)}
            >
              {reveal ? (
                <EyeOff size={18} color={colors.mutedForeground} />
              ) : (
                <Eye size={18} color={colors.mutedForeground} />
              )}
            </IconButton>
          }
        />
      </Stack>

      <Row gap="xs" justify="center">
        <Text variant="callout" color="mutedForeground">
          {dict.auth.newToDirect}
        </Text>
        <Pressable onPress={() => router.push("/register")} hitSlop={8}>
          <Text variant="callout" weight="semibold" color="brand">
            {dict.auth.createAccount}
          </Text>
        </Pressable>
      </Row>

      {/* Demo credentials, exactly as the website lists them. These go away
          with the Supabase cutover. */}
      <Card>
        <Stack gap="sm">
          <Text variant="label" weight="semibold" color="mutedForeground">
            {dict.auth.demoAccounts}
          </Text>
          {DEMO_ACCOUNTS.map((account) => (
            <Pressable
              key={account.email}
              accessibilityRole="button"
              accessibilityLabel={`Fill ${account.email}`}
              onPress={() => {
                setIdentifier(account.email);
                setPassword(account.password);
              }}
              hitSlop={6}
            >
              <Row justify="space-between" style={{ minHeight: 32 }}>
                <Text variant="label" numeric color="mutedForeground">
                  {account.email}
                </Text>
                <Text variant="label" numeric color="brand">
                  {account.password}
                </Text>
              </Row>
            </Pressable>
          ))}
        </Stack>
      </Card>
    </Screen>
  );
}
