"use client";

import { useState } from "react";
import { toast } from "sonner";
import { DRIVER_TYPE_LABELS } from "@direct/shared";
import { availableOrdersForDriver, driverCommissionTotals, driverCompanyPayMode, driverPayDueUsd, formatOrderNumber } from "@/lib/demo-store";
import { LinkButton } from "@/components/link-button";
import { DriverWhishActions } from "@/components/driver-whish-actions";
import { DeliveryMap } from "@/components/delivery-map";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { useStore } from "@/lib/store-context";
import { orderStatusLabel, orderTypeLabel, useI18n, fmt } from "@/lib/i18n";
import { locationLabel } from "@/lib/place-name";
import { nextNavStop, openDrivingDirections } from "@/lib/maps-nav";
import { OrderSearchField, useOrderSearch } from "@/components/order-search";
import { orderPartyExtras } from "@/lib/order-search";

export default function DriverHomePage() {
  const { user, driver: realDriver, isAdmin } = useAuth();
  const { state, claimOrder, declineOffer, setOnline } = useStore();
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
          admin_frozen: false,
          banned: false,
          payment_waived: false,
          revenue_mode: "subscription" as const,
        }
      : null);

  const available = user ? availableOrdersForDriver(state, user.id) : [];
  const active = user
    ? state.orders.filter(
        (o) =>
          (o.assigned_driver_id === user.id || o.long_distance_driver_id === user.id) &&
          !["completed", "cancelled", "disputed"].includes(o.status),
      )
    : [];
  const {
    query: activeQuery,
    setQuery: setActiveQuery,
    showSearch: showActiveSearch,
    filtered: filteredActive,
  } = useOrderSearch(active, (o) => orderPartyExtras(o, state.profiles));
  const {
    query: pendingQuery,
    setQuery: setPendingQuery,
    showSearch: showPendingSearch,
    filtered: filteredAvailable,
  } = useOrderSearch(available);

  if (!user || !driver) {
    return (
        <p className="text-easy">{dict.driver.profileRequired}</p>
    );
  }

  const percentageMode = driverCompanyPayMode(driver, state.settings) === "percentage";
  const commissionDue = percentageMode
    ? driverCommissionTotals(state, user.id).dueNow
    : 0;
  const payDue = driverPayDueUsd(state, driver);

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
      <div className="flex flex-col gap-6">
        {!isAdmin && driver.banned ? (
          <Alert variant="destructive" className="border-2">
            <AlertTitle className="text-xl">{dict.driver.accountBanned}</AlertTitle>
            <AlertDescription className="text-lg">{dict.driver.accountBannedBody}</AlertDescription>
          </Alert>
        ) : null}

        {!isAdmin && !driver.banned && driver.admin_frozen ? (
          <Alert variant="destructive" className="border-2">
            <AlertTitle className="text-xl">{dict.driver.accountFrozenAdmin}</AlertTitle>
            <AlertDescription className="text-lg">
              {dict.driver.accountFrozenAdminBody}
            </AlertDescription>
          </Alert>
        ) : null}

        {!isAdmin && percentageMode && commissionDue > 0 && !driver.payment_waived ? (
          <Alert className="border-2 border-destructive">
            <AlertTitle className="text-xl">{dict.driver.commissionDue}</AlertTitle>
            <AlertDescription className="flex flex-col gap-3 text-lg">
              {fmt(dict.driver.commissionDueBody, {
                amount: commissionDue.toFixed(2),
              })}
              <DriverWhishActions kind="commission" dueAmount={commissionDue} />
            </AlertDescription>
          </Alert>
        ) : null}

        {!isAdmin &&
        driver.payment_waived &&
        !driver.banned &&
        !driver.admin_frozen ? (
          <Alert className="border-2">
            <AlertTitle className="text-xl">{dict.admin.statusWaived}</AlertTitle>
            <AlertDescription className="text-lg">{dict.driver.paymentWaivedNotice}</AlertDescription>
          </Alert>
        ) : null}

        {!isAdmin &&
        !driver.payment_waived &&
        !percentageMode &&
        (driver.subscription_status === "frozen" ||
          driver.subscription_status === "pending_payment") ? (
          <Alert className="border-2 border-destructive">
            <AlertTitle className="text-xl">{dict.driver.subscriptionNeeded}</AlertTitle>
            <AlertDescription className="flex flex-col gap-3 text-lg">
              <p>
                {fmt(dict.driver.subscriptionNeededBody, {
                  amount: payDue.amount.toFixed(2),
                })}
              </p>
              {driver.subscription_status === "frozen" ? (
                <p>
                  {fmt(dict.driver.freezePenaltyNote, {
                    penalty: state.settings.freeze_penalty_usd.toFixed(2),
                  })}
                </p>
              ) : null}
              <DriverWhishActions
                kind="subscription"
                dueAmount={payDue.amount}
              />
            </AlertDescription>
          </Alert>
        ) : null}

        {!isAdmin && !percentageMode && driver.subscription_status === "grace" ? (
          <Alert className="border-2 bg-muted">
            <AlertTitle className="text-xl">{dict.driver.gracePeriod}</AlertTitle>
            <AlertDescription className="flex flex-col gap-3 text-lg">
              <p>
                {fmt(dict.driver.graceRenewBody, {
                  days: state.settings.grace_days,
                })}
              </p>
              <DriverWhishActions
                kind="subscription"
                dueAmount={payDue.amount}
              />
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
            <Button
              size="lg"
              className="touch-target h-12 text-lg"
              onClick={goOnline}
              disabled={driver.banned || driver.admin_frozen}
            >
              {dict.driver.goOnlineLocation}
            </Button>
          )}
          <Badge className="text-sm">{DRIVER_TYPE_LABELS[driver.driver_type]}</Badge>
        </div>
        {locError ? <p className="text-base text-muted-foreground">{locError}</p> : null}

        <section className="flex flex-col gap-3">
          <h2 className="text-2xl font-bold">{dict.driver.activeJobs}</h2>
          <OrderSearchField
            show={showActiveSearch}
            value={activeQuery}
            onChange={setActiveQuery}
          />
          {active.length === 0 ? (
            <p className="text-easy text-muted-foreground">{dict.driver.noActiveJobs}</p>
          ) : filteredActive.length === 0 ? (
            <p className="text-easy text-muted-foreground">{dict.common.noOrderMatches}</p>
          ) : (
            filteredActive.map((o) => (
              <Card key={o.id} className="border-2">
                <CardHeader className="flex flex-row justify-between gap-2">
                  <div>
                    <p className="font-mono text-sm font-semibold tabular-nums text-muted-foreground">
                      {formatOrderNumber(o.order_number)}
                    </p>
                    <CardTitle className="text-xl">{o.product_description}</CardTitle>
                  </div>
                  <Badge>{orderTypeLabel(o.order_type, dict)}</Badge>
                </CardHeader>
                <CardContent className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-lg capitalize">{orderStatusLabel(o.status, dict)} · ${o.driver_cut_usd.toFixed(2)}</p>
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
          <OrderSearchField
            show={showPendingSearch}
            value={pendingQuery}
            onChange={setPendingQuery}
          />
          {available.length === 0 ? (
            <p className="text-easy text-muted-foreground">
              {dict.driver.noMatching}
            </p>
          ) : filteredAvailable.length === 0 ? (
            <p className="text-easy text-muted-foreground">{dict.common.noOrderMatches}</p>
          ) : (
            filteredAvailable.map((o) => (
              <Card key={o.id} className="border-2 border-primary/30">
                <CardHeader>
                  <p className="font-mono text-sm font-semibold tabular-nums text-muted-foreground">
                    {formatOrderNumber(o.order_number)}
                  </p>
                  <CardTitle className="text-xl">{o.product_description}</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3 text-lg">
                  <p>
                    {locationLabel(o.pickup_address, o.pickup_lat, o.pickup_lng)} →{" "}
                    {locationLabel(o.dropoff_address, o.dropoff_lat, o.dropoff_lng)}
                  </p>
                  <p>
                    {orderTypeLabel(o.order_type, dict)} · ${o.driver_cut_usd.toFixed(2)}
                  </p>
                  <div className="flex flex-wrap gap-2">
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
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      className="touch-target h-12 w-fit rounded-full px-6 text-base font-semibold"
                      onClick={() => {
                        const err = declineOffer(o.id, user.id);
                        if (err) toast.error(err);
                        else toast.message(dict.driver.declinedToast);
                      }}
                    >
                      {dict.driver.decline}
                    </Button>
                  </div>
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
              const isYou = l.driver_id === user.id;
              return {
                id: l.driver_id,
                lat: l.lat,
                lng: l.lng,
                label: isYou ? dict.common.you : dict.common.nearbyDriver,
                role: d.driver_type,
                kind: "driver" as const,
              };
            })}
        />
      </div>
  );
}
