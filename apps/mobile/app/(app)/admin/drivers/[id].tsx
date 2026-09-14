import React, { useMemo } from "react";
import { useLocalSearchParams } from "expo-router";
import { Linking } from "react-native";
import { Phone, ShieldCheck, Star } from "lucide-react-native";
import {
  DRIVER_TYPE_LABELS,
  formatDeliveryCash,
  type RevenueMode,
  type SubscriptionPlan,
  SUBSCRIPTION_PLANS,
} from "@direct/shared";
import {
  driverCommissionTotals,
  driverPayMethod,
  driverReviewStatus,
  type DriverAccountAction,
} from "@direct/core";

import { OrderCard } from "@/components/order-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, Section, Stat } from "@/components/ui/card";
import { OptionGroup, SwitchField } from "@/components/ui/field";
import { Divider, Row, Stack } from "@/components/ui/layout";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store-context";
import { useTheme } from "@/theme/theme-context";

/** Admin view of one driver: standing, how they pay, and what they can do. */
export default function AdminDriverDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { dict } = useI18n();
  const { colors } = useTheme();
  const {
    state,
    setDriverAccountAction,
    setDriverPaymentWaived,
    setDriverRevenueMode,
    setDriverSubscriptionPlan,
  } = useStore();
  const toast = useToast();

  const driver = state.drivers.find((d) => d.id === id) ?? null;
  const profile = state.profiles.find((p) => p.id === id) ?? null;

  const recent = useMemo(
    () =>
      state.orders
        .filter((o) => o.assigned_driver_id === id || o.long_distance_driver_id === id)
        .toSorted((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 8),
    [state.orders, id],
  );

  if (!driver || !profile) {
    return (
      <Screen>
        <EmptyState title={dict.admin.noDriversMatch} />
      </Screen>
    );
  }

  const status = driverReviewStatus(driver, state);
  const commission = driverCommissionTotals(state, driver.id);

  function act(action: DriverAccountAction, toastText: string) {
    const error = setDriverAccountAction(driver!.id, action);
    if (error) toast.error(error);
    else toast.success(toastText);
  }

  return (
    <Screen>
      <Card>
        <Stack gap="sm">
          <Row gap="sm" justify="space-between">
            <Stack gap={2} flex={1}>
              <Row gap="xs">
                <Text variant="title" weight="bold" numberOfLines={1}>
                  {profile.full_name}
                </Text>
                {driver.is_trusted ? <ShieldCheck size={17} color={colors.brand} /> : null}
              </Row>
              <Text variant="caption" color="mutedForeground">
                {DRIVER_TYPE_LABELS[driver.driver_type]}
              </Text>
            </Stack>
            <Button
              title={dict.common.phone}
              variant="outline"
              size="sm"
              icon={<Phone size={15} color={colors.foreground} />}
              onPress={() => void Linking.openURL(`tel:${profile.phone}`)}
            />
          </Row>

          <Divider />

          <Row justify="space-between">
            <Row gap="xs">
              <Star size={14} color={colors.gold} fill={colors.gold} />
              <Text variant="callout" numeric>
                {driver.rating_avg.toFixed(1)} · {driver.rating_count} {dict.profile.reviews}
              </Text>
            </Row>
            <Badge
              label={
                {
                  paid: dict.admin.statusPaid,
                  grace: dict.admin.statusGrace,
                  frozen: dict.admin.statusFrozen,
                  banned: dict.admin.statusBanned,
                  unpaid: dict.admin.statusUnpaid,
                  waived: dict.admin.statusWaived,
                }[status]
              }
              tone={status === "paid" ? "success" : status === "banned" ? "destructive" : "warning"}
            />
          </Row>

          <Row justify="space-between">
            <Text variant="caption" color="mutedForeground">
              {dict.admin.paymentMethod}
            </Text>
            <Text variant="caption" weight="semibold">
              {
                {
                  whish: dict.admin.payWhish,
                  whish_manual: dict.admin.payWhishManual,
                  none: dict.admin.payNone,
                }[driverPayMethod(state, driver.id)]
              }
            </Text>
          </Row>
        </Stack>
      </Card>

      <Row gap="sm">
        <Stat
          label={dict.driver.dueNow}
          value={formatDeliveryCash(commission.dueNow)}
          tone={commission.dueNow > 0 ? "destructive" : "success"}
        />
        <Stat
          label={dict.driver.accruingToday}
          value={formatDeliveryCash(commission.accruingToday)}
          hint={dict.driver.accruingTodayHint}
        />
      </Row>

      <Section title={dict.admin.accountStatus} subtitle={dict.admin.restrictionHint}>
        <Card>
          <Stack gap="md">
            <Row gap="sm">
              <Button
                title={driver.admin_frozen ? dict.admin.unfreezeDriver : dict.admin.freezeDriver}
                variant="outline"
                size="sm"
                style={{ flex: 1 }}
                onPress={() =>
                  act(
                    driver.admin_frozen ? "unfreeze" : "freeze",
                    driver.admin_frozen
                      ? dict.admin.driverUnfrozenToast
                      : dict.admin.driverFrozenToast,
                  )
                }
              />
              <Button
                title={driver.banned ? dict.admin.unbanDriver : dict.admin.banDriver}
                variant={driver.banned ? "outline" : "destructive"}
                size="sm"
                style={{ flex: 1 }}
                onPress={() =>
                  act(
                    driver.banned ? "unban" : "ban",
                    driver.banned
                      ? dict.admin.driverUnbannedToast
                      : dict.admin.driverBannedToast,
                  )
                }
              />
            </Row>

            <Divider />

            <SwitchField
              label={
                driver.payment_waived
                  ? dict.admin.revokeUnpaidAccess
                  : dict.admin.allowUnpaidAccess
              }
              hint={dict.admin.unpaidAccessHint}
              value={driver.payment_waived}
              onValueChange={(next) => {
                const error = setDriverPaymentWaived(driver.id, next);
                if (error) toast.error(error);
                else
                  toast.success(
                    next ? dict.admin.paymentWaivedToast : dict.admin.paymentRequiredToast,
                  );
              }}
            />
          </Stack>
        </Card>
      </Section>

      <Section title={dict.admin.companyPlan}>
        <OptionGroup<RevenueMode>
          value={driver.revenue_mode}
          onChange={(mode) => {
            const error = setDriverRevenueMode(driver.id, mode);
            if (error) toast.error(error);
            else toast.success(dict.profile.payPlanSaved);
          }}
          options={[
            { value: "subscription", label: dict.admin.planSubscription },
            { value: "percentage", label: dict.admin.planPercentage },
          ]}
          columns
        />
      </Section>

      {driver.revenue_mode === "subscription" ? (
        <Section title={dict.admin.subscriptionPlan}>
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
            }))}
            columns
          />
        </Section>
      ) : null}

      <Section title={dict.admin.recentDeliveries}>
        {recent.length === 0 ? (
          <Card>
            <Text variant="callout" color="mutedForeground">
              {dict.admin.noDriverHistory}
            </Text>
          </Card>
        ) : (
          <Stack gap="sm">
            {recent.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </Stack>
        )}
      </Section>
    </Screen>
  );
}
