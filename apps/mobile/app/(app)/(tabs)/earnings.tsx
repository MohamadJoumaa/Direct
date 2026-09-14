import React, { useMemo, useState } from "react";
import { View } from "react-native";
import { formatDeliveryCash, formatSubscriptionRemaining } from "@direct/shared";
import {
  driverCommissionTotals,
  driverDailyProfit,
  driverPayDueUsd,
  driverRevenue,
} from "@direct/core";

import { AppHeader } from "@/components/app-header";
import { DriverPaySheet } from "@/components/driver-pay-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, Section, Stat } from "@/components/ui/card";
import { SegmentedControl } from "@/components/ui/field";
import { Divider, Row, Stack } from "@/components/ui/layout";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store-context";
import { useTheme } from "@/theme/theme-context";
import { radius, space } from "@/theme/tokens";

type Period = "today" | "yesterday" | "week" | "month";

/** What the driver earned, and what they owe Direct. */
export default function Earnings() {
  const { dict } = useI18n();
  const { user, driver } = useAuth();
  const { state, refreshFromStorage } = useStore();
  const [period, setPeriod] = useState<Period>("today");
  const [payOpen, setPayOpen] = useState(false);

  const revenue = useMemo(
    () => (user ? driverRevenue(state, user.id, period) : { profit: 0, orders: 0 }),
    [state, user, period],
  );
  const buckets = useMemo(
    () => (user ? driverDailyProfit(state, user.id, period) : []),
    [state, user, period],
  );
  const commission = useMemo(
    () => (user ? driverCommissionTotals(state, user.id) : null),
    [state, user],
  );

  if (!driver) {
    return (
      <>
        <AppHeader title={dict.driver.yourEarnings} />
        <Screen>
          <EmptyState title={dict.driver.profileRequired} />
        </Screen>
      </>
    );
  }

  const due = driverPayDueUsd(state, driver);
  const isPercentage = driver.revenue_mode === "percentage";

  return (
    <>
      <AppHeader title={dict.driver.yourEarnings} subtitle={user?.full_name} />
      <Screen onRefresh={refreshFromStorage}>
        <SegmentedControl<Period>
          value={period}
          onChange={setPeriod}
          options={[
            { value: "today", label: dict.driver.today },
            { value: "yesterday", label: dict.driver.yesterday },
            { value: "week", label: dict.driver.lastWeek },
            { value: "month", label: dict.driver.lastMonth },
          ]}
        />

        <Row gap="sm">
          <Stat
            label={dict.driver.yourPay}
            value={formatDeliveryCash(revenue.profit)}
            tone="success"
          />
          <Stat label={dict.driver.completedOrders} value={String(revenue.orders)} />
        </Row>

        <Section title={dict.driver.profitChart}>
          <Card>
            <ProfitBars buckets={buckets} />
          </Card>
        </Section>

        <Section title={isPercentage ? dict.profile.payPlanPercentage : dict.driver.subscription}>
          <Card>
            <Stack gap="md">
              {isPercentage && commission ? (
                <>
                  <Row justify="space-between">
                    <Stack gap={2} flex={1}>
                      <Text variant="callout" weight="semibold">
                        {dict.driver.dueNow}
                      </Text>
                      <Text variant="caption" color="mutedForeground">
                        {dict.driver.mustPayToTakeOrders}
                      </Text>
                    </Stack>
                    <Text
                      variant="subheading"
                      weight="bold"
                      numeric
                      color={commission.dueNow > 0 ? "destructive" : "success"}
                    >
                      {formatDeliveryCash(commission.dueNow)}
                    </Text>
                  </Row>
                  <Divider />
                  <Row justify="space-between">
                    <Stack gap={2} flex={1}>
                      <Text variant="callout">{dict.driver.accruingToday}</Text>
                      <Text variant="caption" color="mutedForeground">
                        {dict.driver.accruingTodayHint}
                      </Text>
                    </Stack>
                    <Text variant="callout" weight="semibold" numeric>
                      {formatDeliveryCash(commission.accruingToday)}
                    </Text>
                  </Row>
                </>
              ) : (
                <>
                  <Row justify="space-between">
                    <Text variant="callout" color="mutedForeground">
                      {dict.common.status}
                    </Text>
                    <Badge
                      label={
                        {
                          active: dict.driver.subStatusActive,
                          grace: dict.driver.subStatusGrace,
                          frozen: dict.driver.subStatusFrozen,
                          pending_payment: dict.driver.subStatusPending,
                        }[driver.subscription_status]
                      }
                      tone={
                        driver.subscription_status === "active"
                          ? "success"
                          : driver.subscription_status === "grace"
                            ? "warning"
                            : "destructive"
                      }
                    />
                  </Row>
                  <Row justify="space-between">
                    <Text variant="callout" color="mutedForeground">
                      {dict.driver.ends}
                    </Text>
                    <Text variant="callout" weight="semibold" numeric>
                      {driver.subscription_ends_at
                        ? formatSubscriptionRemaining(
                            new Date(driver.subscription_ends_at).getTime(),
                            Date.now(),
                          )
                        : dict.driver.notStarted}
                    </Text>
                  </Row>
                </>
              )}

              {due.amount > 0 ? (
                <Button
                  title={dict.driver.payWithWhish}
                  size="md"
                  full
                  onPress={() => setPayOpen(true)}
                />
              ) : null}
            </Stack>
          </Card>
        </Section>
      </Screen>

      <DriverPaySheet open={payOpen} onClose={() => setPayOpen(false)} />
    </>
  );
}

/**
 * Plain bars rather than a charting library: this is one series of small
 * numbers, and a native chart dependency would cost more than it explains.
 */
function ProfitBars({ buckets }: { buckets: { label: string; profit: number }[] }) {
  const { colors } = useTheme();
  const { dict } = useI18n();
  const max = Math.max(...buckets.map((b) => b.profit), 1);

  if (buckets.length === 0) {
    return (
      <Text variant="callout" color="mutedForeground">
        {dict.driver.noCompleted}
      </Text>
    );
  }

  return (
    <Stack gap="sm">
      {buckets.map((bucket) => (
        <Stack key={bucket.label} gap={4}>
          <Row justify="space-between">
            <Text variant="caption" color="mutedForeground">
              {bucket.label}
            </Text>
            <Text variant="caption" weight="semibold" numeric>
              {formatDeliveryCash(bucket.profit)}
            </Text>
          </Row>
          <View
            style={{
              height: 8,
              borderRadius: radius.full,
              backgroundColor: colors.secondary,
              overflow: "hidden",
            }}
          >
            <View
              style={{
                width: `${Math.max(2, (bucket.profit / max) * 100)}%`,
                height: "100%",
                borderRadius: radius.full,
                backgroundColor: colors.foreground,
              }}
            />
          </View>
        </Stack>
      ))}
      <View style={{ height: space.xs }} />
    </Stack>
  );
}
