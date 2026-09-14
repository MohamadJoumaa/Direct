import React, { useMemo, useState } from "react";
import { View } from "react-native";
import { AlertTriangle, Ban, Snowflake, Zap } from "lucide-react-native";
import { formatSubscriptionRemaining } from "@direct/shared";
import {
  availableOrdersForDriver,
  driverPayDueUsd,
  driverPaymentBlocked,
  offerForDriver,
  type Order,
} from "@direct/core";

import { AppHeader } from "@/components/app-header";
import { DriverPaySheet } from "@/components/driver-pay-sheet";
import { OrderCard } from "@/components/order-card";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, Section } from "@/components/ui/card";
import { SwitchField } from "@/components/ui/field";
import { Row, Stack } from "@/components/ui/layout";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useToast } from "@/components/ui/toast";
import { readCurrentPosition, useDriverLocation } from "@/hooks/use-driver-location";
import { useAuth } from "@/lib/auth-context";
import { fmt, useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store-context";
import { useTheme } from "@/theme/theme-context";
import { radius, space } from "@/theme/tokens";

const ACTIVE_STATUSES: Order["status"][] = [
  "accepted",
  "picked_up",
  "at_warehouse",
  "in_transit",
  "arrived",
  "awaiting_confirmation",
];

/**
 * Driver home: go online, see what was offered, take a job.
 *
 * Every gate here comes from the shared rules -- `driverPaymentBlocked` decides
 * whether work is allowed, and the offer list comes from
 * `availableOrdersForDriver`, so a driver only ever sees orders dispatch
 * actually sent them.
 */
export function DriverHome() {
  const { dict } = useI18n();
  const { colors } = useTheme();
  const { user, driver } = useAuth();
  const { state, setOnline, claimOrder, declineOffer, refreshFromStorage } = useStore();
  const toast = useToast();
  const { mode } = useDriverLocation();
  const [payOpen, setPayOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  const blocked = driver ? driverPaymentBlocked(state, driver) : false;
  const due = driver ? driverPayDueUsd(state, driver) : null;

  const active = useMemo(
    () =>
      user
        ? state.orders.filter(
            (o) =>
              (o.assigned_driver_id === user.id || o.long_distance_driver_id === user.id) &&
              ACTIVE_STATUSES.includes(o.status),
          )
        : [],
    [state.orders, user],
  );

  const offered = useMemo(
    () => (user ? availableOrdersForDriver(state, user.id) : []),
    [state, user],
  );

  async function toggleOnline(next: boolean) {
    if (!user) return;
    setSwitching(true);
    // Going online needs a fix first: dispatch rings are measured from the
    // driver's position, and an unknown position means no offers at all.
    const point = next ? await readCurrentPosition() : null;
    const error = setOnline(user.id, next, point?.lat, point?.lng);
    setSwitching(false);
    if (error) {
      toast.error(error);
      return;
    }
    if (next && !point) toast.info(dict.driver.locationDenied);
    else if (next) toast.success(dict.driver.youAreOnline);
  }

  if (!driver) {
    return (
      <>
        <AppHeader title={dict.driver.driverOrders} />
        <Screen>
          <EmptyState title={dict.driver.profileRequired} />
        </Screen>
      </>
    );
  }

  return (
    <>
      {/* No online/offline badge here on purpose: the toggle directly below
          says the same thing, and on a 375px screen an admin's "view as" chip
          plus a badge plus the bell squeezes the title down to an ellipsis. */}
      <AppHeader title={dict.driver.driverOrders} subtitle={user?.full_name} />
      <Screen onRefresh={refreshFromStorage}>
        <AccountBanner />

        <Card>
          <Stack gap="sm">
            <SwitchField
              label={driver.is_online ? dict.driver.goOffline : dict.driver.goOnlineLocation}
              hint={
                mode === "demo"
                  ? dict.driver.usingDemoLocation
                  : driver.is_online
                    ? dict.driver.youAreOnline
                    : undefined
              }
              value={driver.is_online}
              disabled={switching || blocked}
              onValueChange={(next) => void toggleOnline(next)}
            />
            <SubscriptionLine />
          </Stack>
        </Card>

        {blocked && due ? (
          <Card>
            <Stack gap="sm">
              <Row gap="sm">
                <AlertTriangle size={18} color={colors.destructive} />
                <Text variant="subheading" weight="semibold" color="destructive" style={{ flex: 1 }}>
                  {due.kind === "commission"
                    ? dict.driver.commissionDue
                    : dict.driver.subscriptionNeeded}
                </Text>
              </Row>
              <Text variant="callout" color="mutedForeground">
                {fmt(
                  due.kind === "commission"
                    ? dict.driver.commissionDueBody
                    : dict.driver.subscriptionNeededBody,
                  { amount: `$${due.amount.toFixed(2)}` },
                )}
              </Text>
              <Button
                title={dict.driver.payWithWhish}
                size="md"
                full
                onPress={() => setPayOpen(true)}
              />
            </Stack>
          </Card>
        ) : null}

        <Section title={dict.driver.activeJobs}>
          {active.length === 0 ? (
            <Card>
              <Text variant="callout" color="mutedForeground">
                {dict.driver.noActiveJobs}
              </Text>
            </Card>
          ) : (
            <Stack gap="sm">
              {active.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
            </Stack>
          )}
        </Section>

        <Section title={dict.driver.availableNearby}>
          {offered.length === 0 ? (
            <Card>
              <Text variant="callout" color="mutedForeground">
                {dict.driver.noMatching}
              </Text>
            </Card>
          ) : (
            <Stack gap="sm">
              {offered.map((order) => (
                <OfferCard
                  key={order.id}
                  order={order}
                  onAccept={() => {
                    if (!user) return;
                    const error = claimOrder(order.id, user.id);
                    if (error) toast.error(error);
                    else toast.success(dict.driver.youGotTheOrder);
                  }}
                  onDecline={() => {
                    if (!user) return;
                    const error = declineOffer(order.id, user.id);
                    if (error) toast.error(error);
                    else toast.info(dict.driver.declinedToast);
                  }}
                />
              ))}
            </Stack>
          )}
        </Section>
      </Screen>

      <DriverPaySheet open={payOpen} onClose={() => setPayOpen(false)} />
    </>
  );
}

/** Offer row: distance to the stops plus the two decisions. */
function OfferCard({
  order,
  onAccept,
  onDecline,
}: {
  order: Order;
  onAccept: () => void;
  onDecline: () => void;
}) {
  const { dict } = useI18n();
  const { user } = useAuth();
  const { state } = useStore();

  const offer = user ? offerForDriver(state, order.id, user.id) : null;
  const footnote = offer
    ? `${fmt(dict.driver.toPickup, { km: offer.to_pickup_km.toFixed(1) })} · ${fmt(
        dict.driver.toDropoff,
        { km: offer.to_dropoff_km.toFixed(1) },
      )}`
    : undefined;

  return (
    <OrderCard
      order={order}
      footnote={footnote}
      actions={
        <Row gap="sm">
          <Button
            title={dict.driver.decline}
            variant="outline"
            size="sm"
            style={{ flex: 1 }}
            onPress={onDecline}
          />
          <Button title={dict.driver.accept} size="sm" style={{ flex: 1 }} onPress={onAccept} />
        </Row>
      }
    />
  );
}

/** Countdown or status for whichever way this driver pays Direct. */
function SubscriptionLine() {
  const { dict } = useI18n();
  const { driver } = useAuth();
  const { state } = useStore();
  if (!driver) return null;

  if (driver.revenue_mode === "percentage") {
    return (
      <Row justify="space-between">
        <Text variant="label" color="mutedForeground">
          {dict.profile.payPlanPercentage}
        </Text>
        <Text variant="label" weight="semibold" numeric>
          {state.settings.company_percentage}%
        </Text>
      </Row>
    );
  }

  const statusLabel = {
    active: dict.driver.subStatusActive,
    grace: dict.driver.subStatusGrace,
    frozen: dict.driver.subStatusFrozen,
    pending_payment: dict.driver.subStatusPending,
  }[driver.subscription_status];

  return (
    <Row justify="space-between">
      <Text variant="label" color="mutedForeground">
        {dict.driver.subscription} · {statusLabel}
      </Text>
      <Text variant="label" weight="semibold" numeric>
        {driver.subscription_ends_at
          ? formatSubscriptionRemaining(
            new Date(driver.subscription_ends_at).getTime(),
            Date.now(),
          )
          : dict.driver.notStarted}
      </Text>
    </Row>
  );
}

/** Admin freeze / ban / waiver notices. These outrank the payment gate. */
function AccountBanner() {
  const { dict } = useI18n();
  const { colors } = useTheme();
  const { driver } = useAuth();
  if (!driver) return null;

  const notice = driver.banned
    ? {
        Icon: Ban,
        tone: colors.destructive,
        title: dict.driver.accountBanned,
        body: dict.driver.accountBannedBody,
      }
    : driver.admin_frozen
      ? {
          Icon: Snowflake,
          tone: colors.warning,
          title: dict.driver.accountFrozenAdmin,
          body: dict.driver.accountFrozenAdminBody,
        }
      : driver.payment_waived
        ? {
            Icon: Zap,
            tone: colors.success,
            title: dict.driver.paymentWaivedNotice,
            body: "",
          }
        : null;

  if (!notice) return null;

  return (
    <View
      style={{
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: notice.tone,
        backgroundColor: notice.tone + "14",
        padding: space.md,
        gap: space.xs,
      }}
    >
      <Row gap="sm">
        <notice.Icon size={18} color={notice.tone} />
        <Text variant="callout" weight="semibold" style={{ flex: 1, color: notice.tone }}>
          {notice.title}
        </Text>
      </Row>
      {notice.body ? (
        <Text variant="caption" color="mutedForeground">
          {notice.body}
        </Text>
      ) : null}
    </View>
  );
}

