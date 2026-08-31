"use client";

import { useState } from "react";
import { toast } from "sonner";
import { DRIVER_TYPE_LABELS, WHISH_NUMBER } from "@direct/shared";
import { availableOrdersForDriver, driverCommissionTotals } from "@/lib/demo-store";
import { AppShell } from "@/components/app-shell";
import { LinkButton } from "@/components/link-button";
import { DeliveryMap } from "@/components/delivery-map";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { useStore } from "@/lib/store-context";
import { orderTypeLabel, useI18n, fmt } from "@/lib/i18n";
import { nextNavStop, openDrivingDirections } from "@/lib/maps-nav";

export default function DriverHomePage() {
  const { user, driver: realDriver, isAdmin } = useAuth();
  const { state, claimOrder, setOnline, requestPay } = useStore();
  const { dict } = useI18n();
  const [locError, setLocError] = useState<string | null>(null);
  const driver =
    realDriver ??
    (isAdmin && user
      ? {
          id: user.id,
          driver_type: "owner" as const,
          is_online: true,
          is_busy: false,
          is_trusted: true,
          rating_avg: 5,
          rating_count: 0,
          subscription_status: "active" as const,
          subscription_ends_at: null,
        }
      : null);

  if (!user || !driver) {
    return (
      <AppShell>
        <p className="text-easy">{dict.driver.profileRequired}</p>
      </AppShell>
    );
  }

  const available = availableOrdersForDriver(state, user.id);
  const active = state.orders.filter(
    (o) =>
      (o.assigned_driver_id === user.id || o.long_distance_driver_id === user.id) &&
      !["completed", "cancelled", "disputed"].includes(o.status),
  );
  const percentageMode = state.settings.revenue_mode === "percentage";
  const commissionDue = percentageMode
    ? driverCommissionTotals(state, user.id).dueNow
    : 0;

  function goOnline() {
    if (!navigator.geolocation) {
      setLocError("Location is required. Enable GPS in your browser.");
      // Demo fallback: Beirut
      const err = setOnline(user!.id, true, 33.8938, 35.5018);
      if (err) toast.error(err);
      else toast.message(dict.driver.usingDemoLocation);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const err = setOnline(user!.id, true, pos.coords.latitude, pos.coords.longitude);
        if (err) toast.error(err);
        else {
          setLocError(null);
          toast.success(dict.driver.youAreOnline);
        }
      },
      () => {
        setLocError(dict.driver.locationDenied);
        const err = setOnline(user!.id, true, 33.8938, 35.5018);
        if (err) toast.error(err);
      },
    );
  }

  return (
    <AppShell title={dict.nav.ordersTab}>
      <div className="flex flex-col gap-6">
        {!isAdmin && percentageMode && commissionDue > 0 ? (
          <Alert className="border-2 border-destructive">
            <AlertTitle className="text-xl">{dict.driver.commissionDue}</AlertTitle>
            <AlertDescription className="text-lg">
              {fmt(dict.driver.commissionDueBody, {
                amount: commissionDue.toFixed(2),
                number: WHISH_NUMBER,
              })}
              <div className="mt-3">
                <Button
                  size="lg"
                  className="touch-target"
                  onClick={() => {
                    requestPay(user.id, { kind: "commission", amount: commissionDue });
                    toast.success(dict.driver.paidLogged);
                  }}
                >
                  {dict.driver.iPaid}
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        ) : null}

        {!isAdmin &&
        !percentageMode &&
        (driver.subscription_status === "frozen" ||
          driver.subscription_status === "pending_payment") ? (
          <Alert className="border-2 border-destructive">
            <AlertTitle className="text-xl">{dict.driver.subscriptionNeeded}</AlertTitle>
            <AlertDescription className="text-lg">
              Pay via Whish to <strong>{WHISH_NUMBER}</strong>
              {driver.subscription_status === "frozen"
                ? ` (+ $${state.settings.freeze_penalty_usd} penalty)`
                : ""}
              . Then tap “I paid”.
              <div className="mt-3">
                <Button
                  size="lg"
                  className="touch-target"
                  onClick={() => {
                    requestPay(user.id, { kind: "subscription" });
                    toast.success("Payment request logged — admin can confirm");
                  }}
                >
                  I paid on Whish
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        ) : null}

        {!isAdmin && !percentageMode && driver.subscription_status === "grace" ? (
          <Alert className="border-2 bg-muted">
            <AlertTitle className="text-xl">{dict.driver.gracePeriod}</AlertTitle>
            <AlertDescription className="text-lg">
              Renew soon or your account freezes after {state.settings.grace_days} days.
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <h1 className="heading-easy">{dict.driver.driverOrders}</h1>
          {driver.is_online ? (
            <Button
              variant="outline"
              size="lg"
              className="touch-target"
              onClick={() => setOnline(user.id, false)}
            >
              {dict.driver.goOffline}
            </Button>
          ) : (
            <Button size="lg" className="touch-target h-12 text-lg" onClick={goOnline}>
              {dict.driver.goOnlineLocation}
            </Button>
          )}
          <Badge className="text-sm">{DRIVER_TYPE_LABELS[driver.driver_type]}</Badge>
        </div>
        {locError ? <p className="text-base text-muted-foreground">{locError}</p> : null}

        <section className="flex flex-col gap-3">
          <h2 className="text-2xl font-bold">{dict.driver.activeJobs}</h2>
          {active.length === 0 ? (
            <p className="text-easy text-muted-foreground">{dict.driver.noActiveJobs}</p>
          ) : (
            active.map((o) => (
              <Card key={o.id} className="border-2">
                <CardHeader className="flex flex-row justify-between gap-2">
                  <CardTitle className="text-xl">{o.product_description}</CardTitle>
                  <Badge>{orderTypeLabel(o.order_type, dict)}</Badge>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-lg capitalize">{o.status.replaceAll("_", " ")} · ${o.driver_cut_usd.toFixed(2)}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="lg"
                      className="touch-target"
                      onClick={() => {
                        const warehouse = o.warehouse_id
                          ? state.warehouses.find((w) => w.id === o.warehouse_id)
                          : null;
                        openDrivingDirections(nextNavStop(o, warehouse));
                      }}
                    >
                      {dict.driver.navigate}
                    </Button>
                    <LinkButton href={`/app/driver/orders/${o.id}`} size="lg" className="touch-target">
                      {dict.driver.openJob}
                    </LinkButton>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-2xl font-bold">{dict.driver.availableNearby}</h2>
          {available.length === 0 ? (
            <p className="text-easy text-muted-foreground">
              {dict.driver.noMatching}
            </p>
          ) : (
            available.map((o) => (
              <Card key={o.id} className="border-2 border-primary/30">
                <CardHeader>
                  <CardTitle className="text-xl">{o.product_description}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 text-lg">
                  <p>
                    {o.pickup_address} → {o.dropoff_address}
                  </p>
                  <p>
                    {orderTypeLabel(o.order_type, dict)} · ${o.driver_cut_usd.toFixed(2)}
                  </p>
                  <Button
                    size="lg"
                    className="touch-target h-12 w-fit rounded-full px-6 text-base font-semibold"
                    onClick={() => {
                      const err = claimOrder(o.id, user.id);
                      if (err) toast.error(err);
                      else toast.success(dict.driver.youGotTheOrder);
                    }}
                  >
                    {dict.driver.accept}
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </section>

        <DeliveryMap
          markers={state.locations
            .filter((l) => state.drivers.find((d) => d.id === l.driver_id)?.is_online)
            .map((l) => {
              const d = state.drivers.find((x) => x.id === l.driver_id)!;
              const p = state.profiles.find((x) => x.id === l.driver_id)!;
              return {
                id: l.driver_id,
                lat: l.lat,
                lng: l.lng,
                label: p.full_name,
                role: d.driver_type,
                kind: "driver" as const,
              };
            })}
        />
      </div>
    </AppShell>
  );
}
