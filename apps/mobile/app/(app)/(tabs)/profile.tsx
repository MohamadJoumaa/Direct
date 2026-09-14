import React, { useState } from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { FileCheck2, LogOut, ShieldCheck, Star } from "lucide-react-native";
import {
  formatDeliveryCash,
  SUBSCRIPTION_PLANS,
  subscriptionPriceUsd,
  withBusinessOrderCosts,
  type RevenueMode,
  type SubscriptionPlan,
} from "@direct/shared";
import { profilePhotoUrl } from "@direct/core";

import { AppControls } from "@/components/app-controls";
import { AppHeader } from "@/components/app-header";
import { LocationField, LocationPicker, type PickedLocation } from "@/components/map/location-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, ListCard, ListRow, Section } from "@/components/ui/card";
import { Field, OptionGroup } from "@/components/ui/field";
import { Row, Stack } from "@/components/ui/layout";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth-context";
import { fmt, useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store-context";
import { useTheme } from "@/theme/theme-context";
import { radius } from "@/theme/tokens";

export default function Profile() {
  const { dict, lang } = useI18n();
  const { colors } = useTheme();
  const { user, driver, effectiveRole } = useAuth();
  const {
    state,
    updateProfile,
    setDriverRevenueMode,
    setDriverSubscriptionPlan,
    logout,
  } = useStore();
  const toast = useToast();
  const router = useRouter();

  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [shopPickerOpen, setShopPickerOpen] = useState(false);

  if (!user) return null;

  const photo = profilePhotoUrl(state, user.id);
  const isBusiness = effectiveRole === "business";
  const isDriver = effectiveRole === "driver";
  const costs = withBusinessOrderCosts(user);

  function save() {
    const error = updateProfile(user!.id, {
      full_name: fullName.trim(),
      phone: phone.trim(),
      email: email.trim(),
    });
    if (error) toast.error(error);
    else toast.success(dict.profile.saved);
  }

  function saveShop(picked: PickedLocation) {
    const error = updateProfile(user!.id, {
      business_address: picked.label,
      business_lat: picked.lat,
      business_lng: picked.lng,
    });
    if (error) toast.error(error);
    else toast.success(dict.admin.locationSaved);
  }

  return (
    <>
      <AppHeader title={dict.nav.profile} />
      <Screen footer={<Button title={dict.common.save} size="lg" onPress={save} />}>
        <Card>
          <Row gap="md">
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: radius.full,
                overflow: "hidden",
                backgroundColor: colors.secondary,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {photo ? (
                <Image source={{ uri: photo }} style={{ width: 64, height: 64 }} contentFit="cover" />
              ) : (
                <Text variant="title" weight="bold" color="mutedForeground">
                  {user.full_name.slice(0, 1).toUpperCase()}
                </Text>
              )}
            </View>
            <Stack gap={4} flex={1}>
              <Row gap="xs">
                <Text variant="subheading" weight="bold" numberOfLines={1}>
                  {user.full_name}
                </Text>
                {driver?.is_trusted ? <ShieldCheck size={16} color={colors.brand} /> : null}
              </Row>
              <Text variant="caption" color="mutedForeground">
                {dict.roles[user.role]}
              </Text>
              {isDriver && driver ? (
                <Row gap="xs">
                  <Star size={13} color={colors.gold} fill={colors.gold} />
                  <Text variant="caption" numeric color="mutedForeground">
                    {driver.rating_avg.toFixed(1)} · {driver.rating_count} {dict.profile.reviews}
                  </Text>
                </Row>
              ) : null}
            </Stack>
          </Row>
        </Card>

        <Section title={dict.profile.editProfile}>
          <Stack gap="md">
            <Field label={dict.auth.fullName} value={fullName} onChangeText={setFullName} />
            <Field
              label={dict.common.phone}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
            <Field
              label={dict.common.email}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </Stack>
        </Section>

        {isBusiness ? (
          <Section title={dict.profile.shopLocation} subtitle={dict.profile.shopLocationReadonly}>
            <Stack gap="md">
              <LocationField
                label={dict.auth.shopLocation}
                value={user.business_address}
                placeholder={dict.auth.pinRequired}
                onPress={() => setShopPickerOpen(true)}
              />
              <Card>
                <Stack gap="sm">
                  <Text variant="label" weight="semibold" color="mutedForeground">
                    {dict.profile.orderCosts}
                  </Text>
                  <Text variant="caption" color="mutedForeground">
                    {dict.profile.orderCostsReadonly}
                  </Text>
                  <Row justify="space-between">
                    <Text variant="callout" color="mutedForeground">
                      {dict.admin.minUsd}
                    </Text>
                    <Text variant="callout" weight="semibold" numeric>
                      {formatDeliveryCash(costs.order_min_usd, costs.order_min_lbp)}
                    </Text>
                  </Row>
                  <Row justify="space-between">
                    <Text variant="callout" color="mutedForeground">
                      {dict.admin.maxUsd}
                    </Text>
                    <Text variant="callout" weight="semibold" numeric>
                      {formatDeliveryCash(costs.order_max_usd, costs.order_max_lbp)}
                    </Text>
                  </Row>
                </Stack>
              </Card>
            </Stack>
          </Section>
        ) : null}

        {isDriver && driver ? (
          <>
            <Section title={dict.profile.companyPayTitle} subtitle={dict.profile.companyPayHint}>
              <OptionGroup<RevenueMode>
                value={driver.revenue_mode}
                onChange={(mode) => {
                  const error = setDriverRevenueMode(driver.id, mode);
                  if (error) toast.error(error);
                  else toast.success(dict.profile.payPlanSaved);
                }}
                options={[
                  {
                    value: "subscription",
                    label: dict.profile.payPlanSubscription,
                    hint: fmt(dict.profile.payPlanSubscriptionDesc, {
                      daily: formatDeliveryCash(state.settings.subscription_daily_price_usd),
                      monthly: formatDeliveryCash(state.settings.subscription_price_usd),
                    }),
                  },
                  {
                    value: "percentage",
                    label: dict.profile.payPlanPercentage,
                    hint: fmt(dict.profile.payPlanPercentageDesc, {
                      pct: state.settings.company_percentage,
                    }),
                  },
                ]}
              />
            </Section>

            {driver.revenue_mode === "subscription" ? (
              <Section title={dict.driver.subscriptionPlan}>
                <Stack gap="sm">
                  <OptionGroup<SubscriptionPlan>
                    value={driver.subscription_plan}
                    onChange={(plan) => {
                      const error = setDriverSubscriptionPlan(driver.id, plan);
                      if (error) toast.error(error);
                      else toast.success(dict.driver.planSaved);
                    }}
                    options={SUBSCRIPTION_PLANS.map((plan) => ({
                      value: plan,
                      label: plan === "daily" ? dict.driver.planDaily : dict.driver.planMonthly,
                      hint: fmt(
                        plan === "daily"
                          ? dict.driver.planDailyDesc
                          : dict.driver.planMonthlyDesc,
                        { price: formatDeliveryCash(subscriptionPriceUsd(plan, state.settings)) },
                      ),
                    }))}
                  />
                  <Text variant="caption" color="mutedForeground">
                    {driver.subscription_plan === "daily"
                      ? dict.driver.planDailyNote
                      : fmt(dict.driver.planMonthlyNote, { days: state.settings.grace_days })}
                  </Text>
                </Stack>
              </Section>
            ) : null}
          </>
        ) : null}

        <Section title={dict.profile.legalDocuments}>
          <ListCard>
            <ListRow
              icon={<FileCheck2 size={18} color={colors.mutedForeground} />}
              label={dict.profile.identityDocuments}
              value={
                driver?.is_trusted || user.role !== "driver"
                  ? undefined
                  : dict.docStatus.pending
              }
              onPress={() => router.push("/documents")}
              last
            />
          </ListCard>
        </Section>

        <Card>
          <Row justify="space-between">
            <Text variant="callout" color="mutedForeground">
              {dict.common.tagline}
            </Text>
            <AppControls />
          </Row>
        </Card>

        <ListCard>
          <ListRow
            icon={<LogOut size={18} color={colors.destructive} />}
            label={dict.common.logOut}
            destructive
            onPress={() => {
              logout();
              router.replace("/");
            }}
            last
          />
        </ListCard>

        {driver?.is_trusted ? (
          <Badge label={dict.profile.verified} tone="brand" />
        ) : null}
      </Screen>

      <LocationPicker
        open={shopPickerOpen}
        onClose={() => setShopPickerOpen(false)}
        onPick={saveShop}
        title={dict.auth.shopLocation}
        initial={
          user.business_lat != null && user.business_lng != null
            ? { lat: user.business_lat, lng: user.business_lng }
            : null
        }
      />
    </>
  );
}
