import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Platform, Pressable, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Copy, ExternalLink, ShieldCheck } from "lucide-react-native";
import { formatDeliveryCash } from "@direct/shared";
import { driverCommissionTotals, driverPayDueUsd, pendingWhishTx } from "@direct/core";

import { Button, IconButton } from "./ui/button";
import { Card } from "./ui/card";
import { Field } from "./ui/field";
import { Divider, Row, Stack } from "./ui/layout";
import { Sheet } from "./ui/sheet";
import { Text } from "./ui/text";
import { useToast } from "./ui/toast";
import { useAuth } from "@/lib/auth-context";
import { fmt, useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store-context";
import { useTheme } from "@/theme/theme-context";
import {
  openWhishApp,
  openWhishStore,
  whishAmountLabel,
  whishAmountValue,
  whishDialNumber,
} from "@/lib/whish-transfer";
import { radius, space } from "@/theme/tokens";

/**
 * Pay Direct, from a phone.
 *
 * The driver sends a Whish → Whish transfer to the company number and then
 * tells us they did. That is the whole flow, and the shape of it is forced by
 * a fact rather than chosen: **a P2P Whish transfer cannot be verified from
 * software.** Whish exposes no API that reads one back, so there is no version
 * of this screen where tapping something unlocks an account honestly.
 *
 * So nothing here unlocks anything. "Open Whish" is a hand-off; "I sent it"
 * logs a pending transaction for an admin to confirm in Admin → Budget → Whish,
 * exactly like the web's manual path, and `confirmWhish` there is still the
 * only thing that extends a subscription. That keeps the rule in
 * `payment-rules.md` intact: opening a pay surface, returning from it, or
 * asserting payment are each worth nothing on their own.
 *
 * The merchant-collect client (`src/lib/whish.ts`, `hooks/use-whish-collect.ts`)
 * is parked, not deleted — it is the path to switch back to the moment the
 * company holds Whish channel/secret credentials, and it verifies properly.
 */
export function DriverPaySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { dict } = useI18n();
  const { colors } = useTheme();
  const { user, driver } = useAuth();
  const { state, requestPay } = useStore();
  const toast = useToast();

  const [opened, setOpened] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reference, setReference] = useState("");

  const due = driver ? driverPayDueUsd(state, driver) : null;
  const commission = useMemo(
    () => (driver ? driverCommissionTotals(state, driver.id) : null),
    [state, driver],
  );

  // An open request of this kind means the driver already said they sent the
  // money. Offering "Open Whish" again from that state is how a driver pays
  // twice, so the sheet switches to waiting instead.
  const pending = user && due ? pendingWhishTx(state, user.id, due.kind) : undefined;

  const whishNumber = whishDialNumber(state.settings.whish_number);
  const amountUsd = due?.amount ?? 0;

  // Every exit resets the sheet. A stale "opened" flag left over from a
  // previous visit would greet the next driver with a primary "I sent it"
  // before they have been anywhere near Whish.
  const close = useCallback(() => {
    setOpened(false);
    setReference("");
    onClose();
  }, [onClose]);

  const copy = useCallback(
    async (value: string, message: string) => {
      await Clipboard.setStringAsync(value);
      toast.info(message);
    },
    [toast],
  );

  const openWhish = useCallback(async () => {
    setBusy(true);
    // Whish cannot be pre-filled, so the clipboard carries the one value that
    // is painful to retype and easy to get wrong.
    await Clipboard.setStringAsync(whishNumber);
    const result = await openWhishApp();
    setBusy(false);

    if (result === "app") {
      // No toast: Whish is in front of us now and nobody would read it. Coming
      // back to a sheet whose primary action has become "I sent it" is the
      // signal, and it is there when the driver can actually see it.
      setOpened(true);
      return;
    }
    if (result === "web") {
      // Whish's https link. An installed app claims it; otherwise the driver
      // gets Whish's own page, which is still somewhere they can pay from.
      setOpened(true);
      toast.info(dict.driver.whishOpenedWeb);
      return;
    }
    // Nothing opened. On Android that means Whish really is not installed —
    // the launch goes by package name, so there is nothing left to guess — and
    // the driver stays here with the number and amount already copied. Being
    // thrown at a store listing for an app they already have is what this
    // whole path replaced.
    setOpened(true);
    toast.error(
      fmt(
        Platform.OS === "android" ? dict.driver.whishNotFound : dict.driver.whishOpenFailed,
        { amount: whishAmountLabel(amountUsd), number: whishNumber },
      ),
    );
  }, [amountUsd, dict, toast, whishNumber]);

  const confirmSent = useCallback(() => {
    if (!user || !due) return;
    requestPay(user.id, {
      source: "manual",
      kind: due.kind,
      amount: due.amount,
      reference: reference.trim() || undefined,
    });
    // Deliberately does NOT close: "waiting for confirmation" is the answer to
    // the tap, and a sheet that vanishes reads as "done". The pending row the
    // line below renders from is the same one the admin will confirm.
    setReference("");
  }, [user, due, reference, requestPay]);

  if (!driver || !due) return null;

  const amountLabel = formatDeliveryCash(due.amount);

  return (
    <Sheet
      open={open}
      onClose={close}
      title={due.kind === "commission" ? dict.driver.commissionDue : dict.driver.subscriptionNeeded}
      subtitle={fmt(dict.driver.amountDue, { amount: amountLabel })}
      footer={
        pending ? (
          <Button title={dict.common.done} size="lg" variant="outline" onPress={close} />
        ) : (
          <Stack gap="sm">
            <Button
              title={opened ? dict.driver.whishOpenAgain : dict.driver.whishOpenApp}
              size="lg"
              variant={opened ? "outline" : "primary"}
              loading={busy}
              disabled={due.amount <= 0}
              icon={
                <ExternalLink
                  size={16}
                  color={opened ? colors.foreground : colors.primaryForeground}
                />
              }
              onPress={() => void openWhish()}
            />
            <Button
              title={dict.driver.whishConfirmSent}
              size="md"
              full
              variant={opened ? "primary" : "ghost"}
              disabled={due.amount <= 0}
              onPress={confirmSent}
            />
            {/* The only way to a store listing, and only because the driver
                said so. Never a fallback. */}
            <Pressable accessibilityRole="link" onPress={() => void openWhishStore()}>
              <Text variant="caption" color="mutedForeground" center>
                {dict.driver.whishNoApp}
              </Text>
            </Pressable>
          </Stack>
        )
      }
    >
      <Stack gap="md">
        <Card>
          <Stack gap="sm">
            <Row justify="space-between">
              <Text variant="callout" color="mutedForeground">
                {due.kind === "commission" ? dict.driver.dueNow : dict.driver.subscription}
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

        {pending ? (
          <Card>
            <Stack gap="sm">
              <Row gap="sm" align="flex-start">
                <ActivityIndicator size="small" color={colors.warning} />
                <Stack gap={2} flex={1}>
                  <Text variant="callout" weight="semibold">
                    {dict.driver.whishAwaitingTitle}
                  </Text>
                  {/* The line the driver asked for: it is not stuck, an admin
                      has to look at the company account first. */}
                  <Text variant="caption" color="mutedForeground">
                    {dict.driver.whishAwaitingHint}
                  </Text>
                </Stack>
              </Row>
              <Divider />
              <Row gap="sm" align="flex-start">
                <ShieldCheck size={16} color={colors.mutedForeground} />
                <Text variant="caption" color="mutedForeground" style={{ flex: 1 }}>
                  {pending.note}
                </Text>
              </Row>
            </Stack>
          </Card>
        ) : (
          <>
            {/* The two values the driver has to get right, each one tap away
                from the clipboard — retyping a phone number into a payment
                field is where this flow goes wrong. */}
            <Card>
              <Stack gap="sm">
                <CopyRow
                  label={dict.driver.whishSendTo}
                  value={whishNumber}
                  onCopy={() => void copy(whishNumber, dict.driver.whishCopiedNumber)}
                />
                <Divider />
                <CopyRow
                  label={dict.common.total}
                  value={whishAmountLabel(due.amount)}
                  onCopy={() =>
                    void copy(whishAmountValue(due.amount), dict.driver.whishCopiedAmount)
                  }
                />
              </Stack>
            </Card>

            <Text variant="callout" color="mutedForeground">
              {fmt(dict.driver.whishTransferHow, {
                number: whishNumber,
                amount: whishAmountLabel(due.amount),
              })}
            </Text>

            <Field
              label={dict.driver.whishReference}
              hint={dict.driver.whishReferenceHint}
              value={reference}
              onChangeText={setReference}
              autoCapitalize="characters"
              autoCorrect={false}
            />

            {/* Said plainly, because the driver is about to assert something an
                admin will check against the company account. */}
            <View
              style={{
                borderRadius: radius.xl,
                borderWidth: 1,
                borderColor: colors.border,
                backgroundColor: colors.muted,
                padding: space.md,
              }}
            >
              <Text variant="caption" color="mutedForeground">
                {dict.driver.whishConfirmBody}
              </Text>
            </View>
          </>
        )}
      </Stack>
    </Sheet>
  );
}

/** A value the driver has to reproduce in another app, plus the one tap that
 *  makes that reliable. */
function CopyRow({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Row justify="space-between" gap="sm">
      <Stack gap={2} flex={1}>
        <Text variant="label" color="mutedForeground">
          {label}
        </Text>
        <Text variant="subheading" weight="bold" numeric>
          {value}
        </Text>
      </Stack>
      <IconButton accessibilityLabel={label} tone="filled" onPress={onCopy}>
        <Copy size={18} color={colors.foreground} />
      </IconButton>
    </Row>
  );
}
