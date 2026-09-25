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
import {
  PAY_MODE_UNDO_WINDOW_MS,
  driverCommissionTotals,
  driverCompanyPayMode,
  payModeSwitchBlock,
  payModeUndoMsLeft,
  profilePhotoUrl,
  type Driver,
} from "@direct/core";

import { AppControls } from "@/components/app-controls";
import { AppHeader } from "@/components/app-header";
import { LocationField, LocationPicker, type PickedLocation } from "@/components/map/location-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SubscriptionCountdown } from "@/components/subscription-countdown";
import { Card, ListCard, ListRow, Section } from "@/components/ui/card";
import { Field, OptionGroup, SegmentedControl } from "@/components/ui/field";
import { Divider, Row, Stack } from "@/components/ui/layout";
import { Screen } from "@/components/ui/screen";
import { Sheet } from "@/components/ui/sheet";
import { Text } from "@/components/ui/text";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth-context";
import { useLocationInput } from "@/hooks/use-location-input";
import { fmt, useI18n, type Dictionary } from "@/lib/i18n";
import { useStore } from "@/lib/store-context";
import { useTheme } from "@/theme/theme-context";
import { radius } from "@/theme/tokens";

export default function Profile() {
  const { dict } = useI18n();
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
  // Seeded from the saved shop so the field shows what is on file, and a typed
  // change only takes effect when the person saves it.
  const shopInput = useLocationInput({
    text: user?.business_address ?? "",
    point:
      user?.business_lat != null && user?.business_lng != null
        ? { lat: user.business_lat, lng: user.business_lng }
        : null,
  });

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
      <AppHeader title={dict.nav.profile} back />
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
                value={shopInput.text}
                placeholder={dict.auth.pinRequired}
                note={shopInput.note}
                notePlaceholder={dict.client.locationNotePlaceholder}
                hint={dict.client.locationTypeHint}
                resolving={shopInput.resolving}
                onChangeText={shopInput.setText}
                onChangeNote={shopInput.setNote}
                onPressMap={() => setShopPickerOpen(true)}
              />
              {shopInput.point && shopInput.label !== user.business_address ? (
                <Button
                  title={dict.common.save}
                  variant="outline"
                  size="sm"
                  full
                  onPress={() => saveShop({ ...shopInput.point!, label: shopInput.label })}
                />
              ) : null}
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

        {isDriver && driver ? <PayDirectSection driver={driver} /> : null}

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
        onPick={(picked) => {
          shopInput.applyPin(picked);
          saveShop(picked);
        }}
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

/**
 * Everything a driver pays Direct, in one block.
 *
 * It used to be two sibling Sections — "Pay Direct" and "Subscription plan" —
 * each a stack of identical bordered radio boxes. Read top to bottom that is
 * four equal-looking choices with no hierarchy, when really there is one
 * decision (how you pay) and, only if the answer is "subscription", a detail
 * under it (which plan). So the plan now sits inside a card belonging to the
 * mode above it, and drops to a segmented control: two short labels do not
 * deserve the same weight as the decision that reveals them.
 *
 * The block also answers the questions the old one left out — what state the
 * subscription is in, when it ends, what is owed on percentage — because a
 * driver opening this screen is almost always asking one of those, not
 * changing plans.
 */
function PayDirectSection({ driver }: { driver: Driver }) {
  const { dict } = useI18n();
  const { state, setDriverRevenueMode, setDriverSubscriptionPlan } = useStore();
  const toast = useToast();

  // The resolved mode, not the raw column: `driverCompanyPayMode` falls back to
  // the company default when a driver has none of their own, and the web reads
  // it the same way. Showing the raw field here would leave the group with
  // nothing selected for such a driver.
  const mode = driverCompanyPayMode(driver, state.settings);
  const blocked = payModeSwitchBlock(state, driver);
  const commission = driverCommissionTotals(state, driver.id);
  /** The mode the confirm sheet is asking about, if it is open. */
  const [pendingMode, setPendingMode] = useState<RevenueMode | null>(null);
  const undoMsLeft = payModeUndoMsLeft(driver);

  const lockNote =
    blocked === "commission_due"
      ? fmt(dict.profile.payPlanLockedCommission, {
          amount: formatDeliveryCash(commission.dueNow),
        })
      : blocked === "subscription_frozen"
        ? dict.profile.payPlanLockedFrozen
        : null;

  // Grace belongs to the monthly plan alone, so moving to daily while inside it
  // freezes the account on the next pass. Better said before the tap.
  const dailyWouldFreeze =
    driver.subscription_status === "grace" && driver.subscription_plan === "monthly";

  return (
    <Section title={dict.profile.companyPayTitle} subtitle={dict.profile.companyPayHint}>
      <Stack gap="sm">
        <OptionGroup<RevenueMode>
          value={mode}
          disabled={blocked !== null}
          // Ask first. Changing how you get paid is not a thing to do by
          // brushing a radio button, and the window that makes it reversible
          // is only reassuring if you are told about it beforehand.
          onChange={setPendingMode}
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

        {lockNote ? (
          <Text variant="caption" color="warning">
            {lockNote}
          </Text>
        ) : null}

        {/* While the window is open, say so — it is the difference between
            "I have broken something" and "I can undo this". */}
        {undoMsLeft > 0 ? (
          <Text variant="caption" color="mutedForeground">
            {fmt(dict.profile.payPlanUndoLeft, {
              minutes: Math.max(1, Math.ceil(undoMsLeft / 60_000)),
            })}
          </Text>
        ) : null}

        {mode === "subscription" ? (
          <Card>
            <Stack gap="md">
              <Row justify="space-between" gap="sm">
                <Text variant="callout" weight="semibold" style={{ flex: 1 }}>
                  {dict.driver.subscriptionPlan}
                </Text>
                <Badge
                  label={SUB_STATUS_LABEL(dict)[driver.subscription_status]}
                  tone={
                    driver.subscription_status === "active"
                      ? "success"
                      : driver.subscription_status === "grace"
                        ? "warning"
                        : "destructive"
                  }
                />
              </Row>

              <SegmentedControl<SubscriptionPlan>
                value={driver.subscription_plan}
                onChange={(plan) => {
                  if (plan === driver.subscription_plan) return;
                  const error = setDriverSubscriptionPlan(driver.id, plan);
                  if (error) toast.error(error);
                  else toast.success(dict.driver.planSaved);
                }}
                options={SUBSCRIPTION_PLANS.map((plan) => ({
                  value: plan,
                  label: plan === "daily" ? dict.driver.planDaily : dict.driver.planMonthly,
                }))}
              />

              <Row justify="space-between" gap="sm">
                <Text variant="caption" color="mutedForeground" style={{ flex: 1 }}>
                  {fmt(
                    driver.subscription_plan === "daily"
                      ? dict.driver.planDailyDesc
                      : dict.driver.planMonthlyDesc,
                    {
                      price: formatDeliveryCash(
                        subscriptionPriceUsd(driver.subscription_plan, state.settings),
                      ),
                    },
                  )}
                </Text>
                <Row gap="xs">
                  <Text variant="caption" color="mutedForeground">
                    {dict.driver.ends}
                  </Text>
                  <SubscriptionCountdown
                    endsAt={driver.subscription_ends_at}
                    fallback={dict.driver.notStarted}
                    variant="caption"
                  />
                </Row>
              </Row>

              <Text variant="caption" color="mutedForeground">
                {driver.subscription_plan === "daily"
                  ? dict.driver.planDailyNote
                  : fmt(dict.driver.planMonthlyNote, { days: state.settings.grace_days })}
              </Text>

              {dailyWouldFreeze ? (
                <Text variant="caption" color="warning">
                  {dict.driver.planDailyEndsGrace}
                </Text>
              ) : null}
            </Stack>
          </Card>
        ) : (
          <Card>
            <Stack gap="sm">
              <Row justify="space-between" gap="sm">
                <Text variant="callout" weight="semibold" style={{ flex: 1 }}>
                  {dict.profile.payPlanPercentage}
                </Text>
                <Text variant="callout" weight="bold" numeric>
                  {state.settings.company_percentage}%
                </Text>
              </Row>
              <Divider />
              <Row justify="space-between" gap="sm">
                <Text variant="caption" color="mutedForeground" style={{ flex: 1 }}>
                  {dict.driver.dueNow}
                </Text>
                <Text
                  variant="callout"
                  weight="semibold"
                  numeric
                  color={commission.dueNow > 0 ? "destructive" : "success"}
                >
                  {formatDeliveryCash(commission.dueNow)}
                </Text>
              </Row>
              <Row justify="space-between" gap="sm">
                <Stack gap={2} flex={1}>
                  <Text variant="caption" color="mutedForeground">
                    {dict.driver.accruingToday}
                  </Text>
                  <Text variant="caption" color="mutedForeground">
                    {dict.driver.accruingTodayHint}
                  </Text>
                </Stack>
                <Text variant="callout" weight="semibold" numeric>
                  {formatDeliveryCash(commission.accruingToday)}
                </Text>
              </Row>
            </Stack>
          </Card>
        )}
      </Stack>

      <Sheet
        open={pendingMode !== null}
        onClose={() => setPendingMode(null)}
        title={dict.profile.payPlanConfirmTitle}
        subtitle={
          pendingMode === "percentage"
            ? fmt(dict.profile.payPlanConfirmToPercentage, {
                pct: state.settings.company_percentage,
              })
            : dict.profile.payPlanConfirmToSubscription
        }
        footer={
          <Stack gap="sm">
            <Button
              title={dict.profile.payPlanConfirmAction}
              size="lg"
              onPress={() => {
                if (!pendingMode) return;
                const error = setDriverRevenueMode(driver.id, pendingMode);
                setPendingMode(null);
                if (error) toast.error(error);
                else toast.success(dict.profile.payPlanSaved);
              }}
            />
            <Button
              title={dict.common.cancel}
              variant="ghost"
              size="md"
              full
              onPress={() => setPendingMode(null)}
            />
          </Stack>
        }
      >
        <Text variant="callout" color="mutedForeground">
          {fmt(dict.profile.payPlanUndoWindow, {
            minutes: Math.round(PAY_MODE_UNDO_WINDOW_MS / 60_000),
          })}
        </Text>
      </Sheet>
    </Section>
  );
}

/** The four subscription states, in the active language. */
const SUB_STATUS_LABEL = (dict: Dictionary): Record<Driver["subscription_status"], string> => ({
  active: dict.driver.subStatusActive,
  grace: dict.driver.subStatusGrace,
  frozen: dict.driver.subStatusFrozen,
  pending_payment: dict.driver.subStatusPending,
});
