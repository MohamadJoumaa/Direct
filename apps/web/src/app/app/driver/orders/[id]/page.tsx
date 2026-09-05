"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Navigation, Phone } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { DeliveryMap } from "@/components/delivery-map";
import { OrderReceipt } from "@/components/order-receipt";
import { ProfilePhoto } from "@/components/profile-photo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import { formatOrderNumber, profilePhotoUrl } from "@/lib/demo-store";
import { useStore } from "@/lib/store-context";
import { useI18n } from "@/lib/i18n";
import { nextNavStop, openDrivingDirections } from "@/lib/maps-nav";

export default function DriverOrderPage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const { state, advanceOrder, confirmDelivery, reportClient, addCheckin } = useStore();
  const { dict } = useI18n();
  const [reason, setReason] = useState("");
  const [checkStatus, setCheckStatus] = useState<"on_time" | "late" | "missed">("on_time");
  const [checkNote, setCheckNote] = useState("");

  const order = state.orders.find((o) => o.id === params.id);
  const assigned =
    !!user &&
    !!order &&
    (order.assigned_driver_id === user.id || order.long_distance_driver_id === user.id);
  if (!user || !order || !assigned) {
    return (
      <AppShell>
        <p className="text-easy">{dict.common.orderNotFound}</p>
      </AppShell>
    );
  }

  const client = state.profiles.find((p) => p.id === order.client_id);
  const isHistory = ["completed", "cancelled", "disputed"].includes(order.status);

  const warehouse = order.warehouse_id
    ? state.warehouses.find((w) => w.id === order.warehouse_id)
    : null;
  const liveLoc = state.locations.find((l) => l.driver_id === user.id);
  const nextStop = nextNavStop(order, warehouse);
  const nextLabel =
    nextStop.kind === "pickup"
      ? dict.driver.navigatePickup
      : nextStop.kind === "warehouse"
        ? dict.driver.navigateWarehouse
        : dict.driver.navigateDropoff;

  return (
    <AppShell title={`${dict.common.orderNumber} ${formatOrderNumber(order.order_number)}`}>
      <div className="flex flex-col gap-6">
        <Link
          href={isHistory ? "/app/driver/history" : "/app/driver"}
          className="touch-target inline-flex w-fit items-center gap-2 text-base font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4 rtl:rotate-180" />
          {isHistory ? dict.driver.pastJobs : dict.driver.backToJobs}
        </Link>

        <OrderReceipt
          order={order}
          warehouse={warehouse}
          cashLabel={dict.driver.yourPay}
          cashValue={`$${order.driver_cut_usd.toFixed(2)}`}
          people={
            client ? (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border-2 bg-muted/40 p-3">
                <ProfilePhoto
                  src={profilePhotoUrl(state, client.id)}
                  name={client.full_name}
                  className="size-12"
                />
                <div className="min-w-0 flex-1">
                  <p>
                    <strong>{dict.common.client}:</strong> {client.full_name}
                  </p>
                  <p>
                    <strong>{dict.common.phone}:</strong> {client.phone}
                  </p>
                </div>
                <Button
                  nativeButton={false}
                  render={<a href={`tel:${client.phone}`} />}
                  size="lg"
                  className="touch-target h-12 rounded-full px-6 text-base font-semibold"
                  aria-label={`${dict.driver.callClient} ${client.phone}`}
                >
                  <Phone data-icon="inline-start" />
                  {dict.driver.callClient}
                </Button>
              </div>
            ) : null
          }
        />

        {isHistory ? null : (
          <Card className="border-2">
            <CardContent className="flex flex-wrap gap-2 pt-6">
              <Button
                size="lg"
                className="touch-target h-12 rounded-full px-6 text-base font-semibold"
                aria-label={nextLabel}
                onClick={() => openDrivingDirections(nextStop)}
              >
                <Navigation data-icon="inline-start" />
                {dict.driver.navigate}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="touch-target"
                onClick={() =>
                  openDrivingDirections({ lat: order.pickup_lat, lng: order.pickup_lng })
                }
              >
                {dict.driver.navigatePickup}
              </Button>
              {warehouse ? (
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="touch-target"
                  onClick={() =>
                    openDrivingDirections({ lat: warehouse.lat, lng: warehouse.lng })
                  }
                >
                  {dict.driver.navigateWarehouse}
                </Button>
              ) : null}
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="touch-target"
                onClick={() =>
                  openDrivingDirections({ lat: order.dropoff_lat, lng: order.dropoff_lng })
                }
              >
                {dict.driver.navigateDropoff}
              </Button>
            </CardContent>
          </Card>
        )}

        {isHistory ? null : (
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="text-xl">Update progress</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {order.order_type === "long_distance" && order.status === "accepted" ? (
              <>
                <Button
                  size="lg"
                  className="touch-target"
                  onClick={() => {
                    const err = advanceOrder(order.id, user.id, "picked_up");
                    if (err) toast.error(err);
                  }}
                >
                  Picked up
                </Button>
                <Button
                  size="lg"
                  className="touch-target"
                  onClick={() => {
                    const err = advanceOrder(order.id, user.id, "at_warehouse");
                    if (err) toast.error(err);
                    else toast.success("At warehouse — long-distance drivers notified");
                  }}
                >
                  Arrived at warehouse
                </Button>
              </>
            ) : null}
            {["accepted", "picked_up", "in_transit"].includes(order.status) &&
            order.order_type !== "long_distance" ? (
              <>
                {order.status === "accepted" ? (
                  <Button
                    size="lg"
                    className="touch-target"
                    onClick={() => advanceOrder(order.id, user.id, "picked_up")}
                  >
                    Picked up
                  </Button>
                ) : null}
                <Button
                  size="lg"
                  className="touch-target"
                  onClick={() => advanceOrder(order.id, user.id, "in_transit")}
                >
                  On the way
                </Button>
                <Button
                  size="lg"
                  className="touch-target"
                  onClick={() => {
                    const err = advanceOrder(order.id, user.id, "arrived");
                    if (err) toast.error(err);
                    else toast.success("Marked arrived — waiting for confirmations");
                  }}
                >
                  I arrived
                </Button>
              </>
            ) : null}
            {order.order_type === "long_distance" &&
            order.status === "in_transit" &&
            order.long_distance_driver_id === user.id ? (
              <Button
                size="lg"
                className="touch-target"
                onClick={() => advanceOrder(order.id, user.id, "arrived")}
              >
                I arrived
              </Button>
            ) : null}
            {(order.status === "awaiting_confirmation" || order.status === "arrived") &&
            !order.driver_confirmed ? (
              <Button
                size="lg"
                className="touch-target h-14 text-xl"
                onClick={() => {
                  const err = confirmDelivery(order.id, user.id, "driver");
                  if (err) toast.error(err);
                  else toast.success("You confirmed delivery");
                }}
              >
                Confirm delivered
              </Button>
            ) : null}
          </CardContent>
        </Card>
        )}

        {!isHistory && order.order_type === "private" ? (
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="text-xl">Daily check-in</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Select
                value={checkStatus}
                onValueChange={(v) => setCheckStatus(v as typeof checkStatus)}
                items={[
                  { label: "On time", value: "on_time" },
                  { label: "Late", value: "late" },
                  { label: "Missed", value: "missed" },
                ]}
              >
                <SelectTrigger className="h-12 text-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="on_time">On time</SelectItem>
                    <SelectItem value="late">Late</SelectItem>
                    <SelectItem value="missed">Missed</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
              <Input
                className="h-12 text-lg"
                placeholder="Note (optional)"
                value={checkNote}
                onChange={(e) => setCheckNote(e.target.value)}
              />
              <Button
                size="lg"
                className="touch-target w-fit"
                onClick={() => {
                  addCheckin(order.id, user.id, checkStatus, checkNote);
                  toast.success("Check-in saved");
                }}
              >
                Save today&apos;s check
              </Button>
              <ul className="text-base text-muted-foreground">
                {state.checkins
                  .filter((c) => c.order_id === order.id)
                  .map((c) => (
                    <li key={c.id}>
                      {c.check_date}: {c.status} {c.note ? `— ${c.note}` : ""}
                    </li>
                  ))}
              </ul>
            </CardContent>
          </Card>
        ) : null}

        {isHistory ? null : (
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="text-xl">Report fake / problem client</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Textarea
              className="text-lg"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe the problem (visible to admin)"
            />
            <Button
              variant="destructive"
              size="lg"
              className="touch-target w-fit"
              onClick={() => {
                if (reason.trim().length < 5) {
                  toast.error("Please write a short reason");
                  return;
                }
                const err = reportClient(order.id, user.id, reason);
                if (err) toast.error(err);
                else toast.success("Report sent to admin (50/50 if upheld)");
              }}
            >
              Send report
            </Button>
          </CardContent>
        </Card>
        )}

        <DeliveryMap
          markers={[
            {
              id: "p",
              lat: order.pickup_lat,
              lng: order.pickup_lng,
              label: "Pickup",
              place: order.pickup_address,
              kind: "pickup",
            },
            ...(warehouse
              ? [
                  {
                    id: "w",
                    lat: warehouse.lat,
                    lng: warehouse.lng,
                    label: warehouse.name,
                    place: warehouse.address,
                    kind: "warehouse" as const,
                  },
                ]
              : []),
            {
              id: "d",
              lat: order.dropoff_lat,
              lng: order.dropoff_lng,
              label: dict.common.dropoff,
              place: order.dropoff_address,
              kind: "dropoff",
            },
            ...(liveLoc
              ? [
                  {
                    id: "live",
                    lat: liveLoc.lat,
                    lng: liveLoc.lng,
                    label: dict.common.yourDriver,
                    kind: "live" as const,
                  },
                ]
              : []),
          ]}
          route={[
            { lat: order.pickup_lat, lng: order.pickup_lng },
            ...(warehouse ? [{ lat: warehouse.lat, lng: warehouse.lng }] : []),
            { lat: order.dropoff_lat, lng: order.dropoff_lng },
          ]}
          routeHint={
            order.order_type === "long_distance"
              ? "Route: pickup → warehouse → drop-off"
              : "Best route to drop-off"
          }
        />
      </div>
    </AppShell>
  );
}
