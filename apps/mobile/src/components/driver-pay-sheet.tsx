import React, { useCallback, useMemo } from "react";
import { formatDeliveryCash } from "@direct/shared";
import { driverCommissionTotals, driverPayDueUsd, pendingApiWhishTx } from "@direct/core";

import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Row, Stack } from "./ui/layout";
import { Sheet } from "./ui/sheet";
import { Text } from "./ui/text";
import { useToast } from "./ui/toast";
import { useWhishCollect } from "@/hooks/use-whish-collect";
import { useAuth } from "@/lib/auth-context";
import { fmt, useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store-context";

/**
 * Pay Direct.
 *
 * Two paths, both from the shared contract:
 *   - Whish collect: create, open, poll, and unlock only after the status
 *     re-check says exactly "success".
 *   - Manual: log a pending transaction for an admin to confirm in
 *     Admin → Budget. Used when the web deployment has no channel/secret, and
 *     it never unlocks anything by itself.
 */
export function DriverPaySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { dict } = useI18n();
  const { user, driver } = useAuth();
  const { state, requestPay, confirmWhish } = useStore();
  const toast = useToast();

  const due = driver ? driverPayDueUsd(state, driver) : null;
  const commission = useMemo(
    () => (driver ? driverCommissionTotals(state, driver.id) : null),
    [state, driver],
  );

  const onCreated = useCallback(
    (externalId: string) => {
      if (!user || !due) return;
      // Log the attempt up front so an admin can see it even if the driver
      // never returns from the Whish page.
      requestPay(user.id, {
        source: "api",
        externalId,
        kind: due.kind,
        amount: due.amount,
      });
    },
    [user, due, requestPay],
  );

  const onPaid = useCallback(
    (externalId: string) => {
      // `confirmWhish` matches on external_id, so this settles the very row
      // `onCreated` logged.
      confirmWhish(externalId);
      toast.success(
        due?.kind === "commission"
          ? dict.driver.commissionPaymentConfirmed
          : dict.driver.paymentConfirmed,
      );
      onClose();
    },
    [confirmWhish, due?.kind, dict, toast, onClose],
  );

  const collect = useWhishCollect({ onCreated, onPaid });

  if (!driver || !due) return null;

  const busy = collect.phase === "creating" || collect.phase === "checking";
  const amountLabel = formatDeliveryCash(due.amount);

  const statusCopy =
    collect.phase === "unconfigured"
      ? dict.driver.whishNotConfigured
      : collect.reason === "unreachable"
        ? dict.driver.whishUnreachable
        : collect.reason === "create_failed"
          ? dict.driver.whishCreateFailed
          : collect.reason === "not_paid_yet"
            ? dict.driver.notPaidYet
            : collect.phase === "awaiting"
              ? dict.driver.waitingForPayment
              : null;

  function payManually() {
    if (!user) return;
    requestPay(user.id, { source: "manual", kind: due!.kind, amount: due!.amount });
    toast.info(dict.driver.paidLogged);
    onClose();
  }

  const pendingManual = user ? pendingApiWhishTx(state, user.id, due.kind) : null;

  return (
    <Sheet
      open={open}
      onClose={() => {
        collect.reset();
        onClose();
      }}
      title={
        due.kind === "commission" ? dict.driver.commissionDue : dict.driver.subscriptionNeeded
      }
      subtitle={fmt(dict.driver.amountDue, { amount: amountLabel })}
      footer={
        <Stack gap="sm">
          <Button
            title={dict.driver.payWithWhish}
            size="lg"
            loading={busy}
            disabled={due.amount <= 0}
            onPress={() => void collect.start(due.amount, due.kind)}
          />
          {collect.phase === "awaiting" ? (
            <Button
              title={dict.driver.checkPayment}
              variant="outline"
              size="md"
              full
              onPress={() => void collect.check()}
            />
          ) : (
            <Button
              title={dict.driver.iPaid}
              variant="ghost"
              size="md"
              full
              onPress={payManually}
            />
          )}
        </Stack>
      }
    >
      <Stack gap="md">
        <Card>
          <Stack gap="sm">
            <Row justify="space-between">
              <Text variant="callout" color="mutedForeground">
                {due.kind === "commission" ? dict.driver.dueNow : dict.driver.amountDue.split(":")[0]}
              </Text>
              <Text variant="subheading" weight="bold" numeric>
                {amountLabel}
              </Text>
            </Row>

            {commission && due.kind === "commission" ? (
              <Row justify="space-between">
                <Stack gap={2} flex={1}>
                  <Text variant="label" color="mutedForeground">
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
            ) : null}

            {due.kind === "subscription" &&
            driver.subscription_status === "frozen" &&
            state.settings.freeze_penalty_usd > 0 ? (
              <Text variant="caption" color="warning">
                {fmt(dict.driver.freezePenaltyNote, {
                  penalty: formatDeliveryCash(state.settings.freeze_penalty_usd),
                })}
              </Text>
            ) : null}
          </Stack>
        </Card>

        {statusCopy ? (
          <Text variant="callout" color="mutedForeground">
            {statusCopy}
          </Text>
        ) : null}

        {pendingManual ? (
          <Text variant="caption" color="warning">
            {dict.driver.paidLogged}
          </Text>
        ) : null}

        {/* The company number is support only. Sending to it proves nothing. */}
        <Text variant="caption" color="mutedForeground">
          {fmt(dict.driver.whishSupportNumber, { number: state.settings.whish_number })}
        </Text>
      </Stack>
    </Sheet>
  );
}
