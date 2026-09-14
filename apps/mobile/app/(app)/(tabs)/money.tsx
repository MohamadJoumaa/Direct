import React, { useMemo, useState } from "react";
import { formatDeliveryCash } from "@direct/shared";
import { companyProfitOnDay, percentageAccrued, subscriptionBudget } from "@direct/core";

import { AppHeader } from "@/components/app-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, Section, Stat } from "@/components/ui/card";
import { SegmentedControl } from "@/components/ui/field";
import { Divider, Row, Stack } from "@/components/ui/layout";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store-context";

/**
 * Admin budget.
 *
 * Also where manual Whish payments get confirmed — the fallback path when the
 * web deployment has no channel/secret. Confirming here is the *only* thing
 * that settles a manual transaction.
 */
export default function AdminMoney() {
  const { dict } = useI18n();
  const { state, confirmWhish, refreshFromStorage } = useStore();
  const toast = useToast();
  const [dayOffset, setDayOffset] = useState(0);

  const day = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - dayOffset);
    return d;
  }, [dayOffset]);

  const profit = useMemo(() => companyProfitOnDay(state, day), [state, day]);
  const pending = state.whish.filter((tx) => tx.status === "pending");
  const confirmed = state.whish.filter((tx) => tx.status === "confirmed").slice(0, 12);

  return (
    <>
      <AppHeader title={dict.nav.budget} />
      <Screen onRefresh={refreshFromStorage}>
        <Row gap="sm">
          <Stat
            label={dict.admin.daySubscriptions}
            value={formatDeliveryCash(subscriptionBudget(state))}
            tone="success"
          />
          <Stat
            label={dict.admin.dayOrderCuts}
            value={formatDeliveryCash(percentageAccrued(state))}
          />
        </Row>

        <Section title={dict.admin.budgetByDay} subtitle={dict.admin.budgetByDayHint}>
          <Card>
            <Stack gap="md">
              <SegmentedControl<string>
                value={String(dayOffset)}
                onChange={(next) => setDayOffset(Number(next))}
                options={[
                  { value: "0", label: dict.driver.today },
                  { value: "1", label: dict.driver.yesterday },
                  { value: "7", label: dict.driver.lastWeek },
                ]}
              />
              <Row justify="space-between">
                <Text variant="callout" color="mutedForeground">
                  {dict.admin.daySubscriptions}
                </Text>
                <Text variant="callout" weight="semibold" numeric>
                  {formatDeliveryCash(profit.subscription)}
                </Text>
              </Row>
              <Row justify="space-between">
                <Text variant="callout" color="mutedForeground">
                  {dict.admin.dayOrderCuts}
                </Text>
                <Text variant="callout" weight="semibold" numeric>
                  {formatDeliveryCash(profit.percentage)}
                </Text>
              </Row>
              <Row justify="space-between">
                <Text variant="callout" color="mutedForeground">
                  {dict.admin.dayDeliveries}
                </Text>
                <Text variant="callout" weight="semibold" numeric>
                  {profit.orders}
                </Text>
              </Row>
              <Divider />
              <Row justify="space-between">
                <Text variant="subheading" weight="semibold">
                  {dict.common.total}
                </Text>
                <Text variant="heading" weight="bold" numeric color="success">
                  {formatDeliveryCash(profit.total)}
                </Text>
              </Row>
            </Stack>
          </Card>
        </Section>

        <Section title="Whish">
          {pending.length === 0 ? (
            <EmptyState title={dict.admin.payNone} />
          ) : (
            <Stack gap="sm">
              {pending.map((tx) => {
                const profile = state.profiles.find((p) => p.id === tx.driver_id);
                return (
                  <Card key={tx.id}>
                    <Stack gap="sm">
                      <Row justify="space-between">
                        <Stack gap={2} flex={1}>
                          <Text variant="callout" weight="semibold" numberOfLines={1}>
                            {profile?.full_name ?? tx.driver_id}
                          </Text>
                          <Text variant="caption" color="mutedForeground" numberOfLines={1}>
                            {tx.note}
                          </Text>
                        </Stack>
                        <Stack gap={4} align="flex-end">
                          <Text variant="callout" weight="bold" numeric>
                            {formatDeliveryCash(tx.amount_usd)}
                          </Text>
                          <Badge
                            label={
                              tx.source === "api" ? dict.admin.payWhish : dict.admin.payWhishManual
                            }
                            tone={tx.source === "api" ? "brand" : "warning"}
                          />
                        </Stack>
                      </Row>
                      <Button
                        title={dict.admin.approve}
                        size="sm"
                        full
                        onPress={() => {
                          confirmWhish(tx.id);
                          toast.success(dict.driver.paymentConfirmed);
                        }}
                      />
                    </Stack>
                  </Card>
                );
              })}
            </Stack>
          )}
        </Section>

        {confirmed.length > 0 ? (
          <Section title={dict.admin.historyOrders}>
            <Card padded={false}>
              <Stack>
                {confirmed.map((tx, index) => {
                  const profile = state.profiles.find((p) => p.id === tx.driver_id);
                  return (
                    <Stack key={tx.id}>
                      <Row justify="space-between" style={{ padding: 14 }}>
                        <Text variant="callout" style={{ flex: 1 }} numberOfLines={1}>
                          {profile?.full_name ?? tx.driver_id}
                        </Text>
                        <Text variant="callout" weight="semibold" numeric color="success">
                          {formatDeliveryCash(tx.amount_usd)}
                        </Text>
                      </Row>
                      {index < confirmed.length - 1 ? <Divider /> : null}
                    </Stack>
                  );
                })}
              </Stack>
            </Card>
          </Section>
        ) : null}
      </Screen>
    </>
  );
}
