import React, { useMemo, useState } from "react";
import { Pressable } from "react-native";
import { useRouter } from "expo-router";
import { ArrowLeft, Bike, Building2, User } from "lucide-react-native";
import type { DriverType, UserRole } from "@direct/shared";

import { LocationField, LocationPicker, type PickedLocation } from "@/components/map/location-picker";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, OptionGroup } from "@/components/ui/field";
import { Row, Stack } from "@/components/ui/layout";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useToast } from "@/components/ui/toast";
import { fmt, useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store-context";
import { useTheme } from "@/theme/theme-context";
import { radius, space } from "@/theme/tokens";

type SignupRole = Extract<UserRole, "client" | "business" | "driver">;

/**
 * Two-step sign-up, same shape as the website: pick a role, then fill in only
 * what that role needs. Admins are never self-registered -- they are added by
 * another admin from the Drivers screen.
 */
export default function Register() {
  const { dict } = useI18n();
  const { colors } = useTheme();
  const { register } = useStore();
  const toast = useToast();
  const router = useRouter();

  const [role, setRole] = useState<SignupRole | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [shop, setShop] = useState<PickedLocation | null>(null);
  const [shopPickerOpen, setShopPickerOpen] = useState(false);
  const [driverType, setDriverType] = useState<DriverType>("fast");
  const [submitting, setSubmitting] = useState(false);

  const passwordMismatch = confirm.length > 0 && confirm !== password;

  const canSubmit = useMemo(() => {
    if (!role) return false;
    if (!fullName.trim() || !email.trim() || !phone.trim() || !password) return false;
    if (password !== confirm) return false;
    if (role === "business" && (!businessName.trim() || !shop)) return false;
    return true;
  }, [role, fullName, email, phone, password, confirm, businessName, shop]);

  function submit() {
    if (!role) return;
    setSubmitting(true);
    const error = register({
      full_name: fullName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      password,
      role,
      business_name: role === "business" ? businessName.trim() : undefined,
      shop_address: role === "business" ? shop?.label : undefined,
      shop_lat: role === "business" ? shop?.lat : undefined,
      shop_lng: role === "business" ? shop?.lng : undefined,
      driver_type: role === "driver" ? driverType : undefined,
    });
    setSubmitting(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success(dict.auth.accountCreated);
    router.replace("/home");
  }

  if (!role) {
    return (
      <Screen gap="lg">
        <Stack gap="xs">
          <Text variant="title" weight="extrabold">
            {dict.auth.chooseRoleTitle}
          </Text>
          <Text variant="callout" color="mutedForeground">
            {dict.auth.chooseRoleHint}
          </Text>
        </Stack>

        <Stack gap="sm">
          <RoleCard
            Icon={User}
            title={dict.auth.roleClient}
            body={dict.auth.roleClientDesc}
            onPress={() => setRole("client")}
          />
          <RoleCard
            Icon={Building2}
            title={dict.auth.roleBusiness}
            body={dict.auth.roleBusinessDesc}
            onPress={() => setRole("business")}
          />
          <RoleCard
            Icon={Bike}
            title={dict.auth.roleDriver}
            body={dict.auth.roleDriverDesc}
            onPress={() => setRole("driver")}
          />
        </Stack>

        <Row gap="xs" justify="center">
          <Text variant="callout" color="mutedForeground">
            {dict.auth.alreadyRegistered}
          </Text>
          <Pressable onPress={() => router.replace("/login")} hitSlop={8}>
            <Text variant="callout" weight="semibold" color="brand">
              {dict.common.logIn}
            </Text>
          </Pressable>
        </Row>
      </Screen>
    );
  }

  const detailsTitle =
    role === "business"
      ? dict.auth.detailsTitleBusiness
      : role === "driver"
        ? dict.auth.detailsTitleDriver
        : dict.auth.detailsTitle;

  return (
    <Screen
      gap="lg"
      footer={
        <Button
          title={dict.common.signUp}
          size="lg"
          disabled={!canSubmit}
          loading={submitting}
          onPress={submit}
        />
      }
    >
      <Stack gap="xs">
        <Text variant="label" color="mutedForeground">
          {fmt(dict.auth.registerStep, { step: 2 })}
        </Text>
        <Text variant="title" weight="extrabold">
          {detailsTitle}
        </Text>
        <Pressable onPress={() => setRole(null)} hitSlop={8} style={{ paddingTop: space.xs }}>
          <Row gap="xs">
            <ArrowLeft size={16} color={colors.brand} />
            <Text variant="callout" weight="semibold" color="brand">
              {dict.auth.changeRole}
            </Text>
          </Row>
        </Pressable>
      </Stack>

      <Stack gap="md">
        <Field
          label={dict.auth.fullName}
          value={fullName}
          onChangeText={setFullName}
          autoCapitalize="words"
          textContentType="name"
        />
        <Field
          label={dict.common.email}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
        />
        <Field
          label={dict.common.phone}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
        />

        {role === "business" ? (
          <>
            <Field
              label={dict.auth.businessName}
              value={businessName}
              onChangeText={setBusinessName}
              autoCapitalize="words"
            />
            <LocationField
              label={dict.auth.shopLocation}
              value={shop?.label}
              placeholder={dict.auth.pinRequired}
              onPress={() => setShopPickerOpen(true)}
            />
            <Text variant="caption" color="mutedForeground">
              {dict.auth.shopLocationHint}
            </Text>
          </>
        ) : null}

        {role === "driver" ? (
          <>
            <OptionGroup<DriverType>
              label={dict.auth.driverType}
              value={driverType}
              onChange={setDriverType}
              options={[
                {
                  value: "fast",
                  label: dict.auth.driverTypeFast,
                  hint: dict.auth.driverTypeFastDesc,
                },
                {
                  value: "long_distance",
                  label: dict.auth.driverTypeLong,
                  hint: dict.auth.driverTypeLongDesc,
                },
              ]}
            />
            <Text variant="caption" color="mutedForeground">
              {dict.auth.driverTypeHint}
            </Text>
          </>
        ) : null}

        <Field
          label={dict.common.password}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          textContentType="newPassword"
        />
        <Field
          label={dict.auth.confirmPassword}
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          autoCapitalize="none"
          error={passwordMismatch ? dict.auth.passwordsMustMatch : undefined}
        />
      </Stack>

      <Card>
        <Text variant="caption" color="mutedForeground">
          {dict.auth.registerSub}
        </Text>
      </Card>

      <LocationPicker
        open={shopPickerOpen}
        onClose={() => setShopPickerOpen(false)}
        onPick={setShop}
        title={dict.auth.shopLocation}
        initial={shop}
      />
    </Screen>
  );
}

function RoleCard({
  Icon,
  title,
  body,
  onPress,
}: {
  Icon: React.ComponentType<{ size?: number; color?: string }>;
  title: string;
  body: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Card onPress={onPress} accessibilityLabel={title}>
      <Row gap="md" align="flex-start">
        <Stack
          align="center"
          justify="center"
          style={{
            width: 44,
            height: 44,
            borderRadius: radius.full,
            backgroundColor: colors.secondary,
          }}
        >
          <Icon size={20} color={colors.foreground} />
        </Stack>
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
  );
}
