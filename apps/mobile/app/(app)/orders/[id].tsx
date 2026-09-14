import React, { useMemo, useState } from "react";
import { Linking } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Flag, Navigation, Phone, X } from "lucide-react-native";
import { formatDeliveryCash } from "@direct/shared";
import {
  formatOrderNumber,
  locationLabel,
  orderPriceFloorLbp,
  orderPriceFloorUsd,
  publicClientInfo,
  publicDriverInfo,
  viewerIsLinkedDriver,
  type Order,
} from "@direct/core";

import { DeliveryMap, type MapPoint } from "@/components/map/delivery-map";
import { ConfirmDeliverySheet } from "@/screens/client-home";
import { Badge, OrderStatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, Section } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Divider, Row, Stack } from "@/components/ui/layout";
import { Screen } from "@/components/ui/screen";
import { Sheet } from "@/components/ui/sheet";
import { Text } from "@/components/ui/text";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth-context";
import { fmt, orderStatusLabel, useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store-context";
import { useTheme } from "@/theme/theme-context";

/** Next status this order can move to, and the label for that button. */
type Advance = Parameters<ReturnType<typeof useStore>["advanceOrder"]>[2];

function nextAdvance(order: Order): Advance | null {
  switch (order.status) {
    case "accepted":
      return "picked_up";
    case "picked_up":
      // Long-distance runs hop through the hub; everything else goes direct.
      return order.order_type === "long_distance" ? "at_warehouse" : "in_transit";
    case "at_warehouse":
      return "in_transit";
    case "in_transit":
      return "arrived";
    default:
      return null;
  }
}

/**
 * One order, seen from whichever side is looking.
 *
 * The website has three separate detail pages (client, driver, admin); on a
 * phone they are the same content with different actions, so this is one screen
 * that asks `useAuth` who is looking rather than three near-copies.
 */
export default function OrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { dict, lang } = useI18n();
  const { colors } = useTheme();
  const { user, effectiveRole, isAdmin } = useAuth();
  const { state, advanceOrder, confirmDelivery, cancelOrder, updateOrderPrice, reportClient } =
    useStore();
  const toast = useToast();
  const router = useRouter();

  const [priceOpen, setPriceOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [confirming, setConfirming] = useState<Order | null>(null);

  const order = state.orders.find((o) => o.id === id) ?? null;

  const points = useMemo<MapPoint[]>(() => {
    if (!order) return [];
    const list: MapPoint[] = [
      {
        id: "pickup",
        kind: "pickup",
        lat: order.pickup_lat,
        lng: order.pickup_lng,
        label: locationLabel(order.pickup_address, order.pickup_lat, order.pickup_lng, lang),
      },
      {
        id: "dropoff",
        kind: "dropoff",
        lat: order.dropoff_lat,
        lng: order.dropoff_lng,
        label: locationLabel(order.dropoff_address, order.dropoff_lat, order.dropoff_lng, lang),
      },
    ];
    const driverId = order.assigned_driver_id ?? order.long_distance_driver_id;
    const position = driverId
      ? state.locations.find((l) => l.driver_id === driverId)
      : undefined;
    if (position) {
      list.push({
        id: "driver",
        kind: "driver",
        lat: position.lat,
        lng: position.lng,
        label: dict.common.driver,
      });
    }
    return list;
  }, [order, state.locations, lang, dict.common.driver]);

  if (!order || !user) {
    return (
      <Screen>
        <EmptyState title={dict.common.orderNotFound} />
      </Screen>
    );
  }

  const isOwner = order.client_id === user.id;
  const isLinkedDriver = viewerIsLinkedDriver(order, user.id);
  const canDrive = isLinkedDriver || (isAdmin && effectiveRole === "driver");
  const advance = nextAdvance(order);
  const driverInfo = publicDriverInfo(state, order);
  const clientInfo = publicClientInfo(state, order, user.id);

  const primary = (() => {
    if (canDrive && advance) {
      return (
        <Button
          title={orderStatusLabel(advance, dict)}
          size="lg"
          onPress={() => {
            const error = advanceOrder(order.id, user.id, advance);
            if (error) toast.error(error);
          }}
        />
      );
    }
    if (canDrive && order.status === "awaiting_confirmation" && !order.driver_confirmed) {
      return (
        <Button
          title={dict.client.confirmReceived}
          size="lg"
          onPress={() => {
            // The driver's half carries no rating; only the client rates.
            const error = confirmDelivery(order.id, user.id, "driver");
            if (error) toast.error(error);
            else toast.success(dict.orderStatus.completed);
          }}
        />
      );
    }
    if (isOwner && order.status === "awaiting_confirmation" && !order.client_confirmed) {
      return (
        <Button
          title={dict.client.confirmAndRate}
          size="lg"
          onPress={() => setConfirming(order)}
        />
      );
    }
    return undefined;
  })();

  return (
    <>
      <Screen footer={primary}>
        <Row justify="space-between">
          <Text variant="title" weight="extrabold" numeric>
            {formatOrderNumber(order.order_number)}
          </Text>
          <Row gap="xs">
            {order.is_urgent ? (
              <Badge label={dict.order.urgentBadge} tone="destructive" />
            ) : null}
            <OrderStatusBadge status={order.status} />
          </Row>
        </Row>

        <DeliveryMap points={points} height={220} />

        <Card>
          <Stack gap="sm">
            <Text variant="label" color="mutedForeground">
              {dict.common.item}
            </Text>
            <Text variant="subheading" weight="semibold">
              {order.product_description}
            </Text>
            <Divider />
            <Stack gap="xs">
              <Text variant="label" color="mutedForeground">
                {dict.common.pickup}
              </Text>
              <Text variant="callout">
                {locationLabel(order.pickup_address, order.pickup_lat, order.pickup_lng, lang)}
              </Text>
            </Stack>
            <Stack gap="xs">
              <Text variant="label" color="mutedForeground">
                {dict.common.dropoff}
              </Text>
              <Text variant="callout">
                {locationLabel(order.dropoff_address, order.dropoff_lat, order.dropoff_lng, lang)}
              </Text>
            </Stack>
          </Stack>
        </Card>

        <Card>
          <Stack gap="sm">
            <Row justify="space-between">
              <Text variant="callout" color="mutedForeground">
                {dict.common.cash}
              </Text>
              <Text variant="heading" weight="bold" numeric>
                {formatDeliveryCash(order.delivery_fee_usd, order.delivery_fee_lbp)}
              </Text>
            </Row>
            {order.delivery_fee_usd > order.quoted_fee_usd ? (
              <Row justify="space-between">
                <Text variant="caption" color="mutedForeground">
                  {dict.admin.clientRaisedPrice}
                </Text>
                <Text variant="caption" numeric color="brand">
                  {formatDeliveryCash(order.quoted_fee_usd, order.quoted_fee_lbp)}
                </Text>
              </Row>
            ) : null}
            {canDrive || isAdmin ? (
              <Row justify="space-between">
                <Text variant="caption" color="mutedForeground">
                  {dict.common.driverPay}
                </Text>
                <Text variant="caption" weight="semibold" numeric color="success">
                  {formatDeliveryCash(order.driver_cut_usd)}
                </Text>
              </Row>
            ) : null}
            {order.night_surcharge_usd > 0 ? (
              <Text variant="caption" color="mutedForeground">
                {fmt(dict.order.nightNote, {
                  amount: formatDeliveryCash(order.night_surcharge_usd),
                })}
              </Text>
            ) : null}
            <Text variant="caption" color="mutedForeground">
              {dict.order.cashNote}
            </Text>
          </Stack>
        </Card>

        {/* Contact is shared one way only, and only after a driver is linked. */}
        {isOwner && driverInfo.contact ? (
          <ContactCard
            role={dict.common.driver}
            name={driverInfo.contact.full_name}
            phone={driverInfo.contact.phone}
          />
        ) : null}
        {canDrive && clientInfo ? (
          <ContactCard
            role={dict.common.client}
            name={clientInfo.full_name}
            phone={clientInfo.phone}
          />
        ) : null}

        {canDrive ? (
          <Section title={dict.driver.navigate}>
            <Row gap="sm">
              <Button
                title={dict.driver.navigatePickup}
                variant="outline"
                size="sm"
                style={{ flex: 1 }}
                icon={<Navigation size={15} color={colors.foreground} />}
                onPress={() => void openMaps(order.pickup_lat, order.pickup_lng)}
              />
              <Button
                title={dict.driver.navigateDropoff}
                variant="outline"
                size="sm"
                style={{ flex: 1 }}
                icon={<Navigation size={15} color={colors.foreground} />}
                onPress={() => void openMaps(order.dropoff_lat, order.dropoff_lng)}
              />
            </Row>
          </Section>
        ) : null}

        {/* A client may raise the price only while the order is still pending:
            once a driver accepts, the pay they agreed to cannot move. */}
        {isOwner && order.status === "pending" ? (
          <Stack gap="sm">
            <Button
              title={dict.order.editPrice}
              variant="outline"
              size="md"
              full
              onPress={() => setPriceOpen(true)}
            />
            <Button
              title={dict.common.cancel}
              variant="ghost"
              size="md"
              full
              icon={<X size={16} color={colors.destructive} />}
              onPress={() => {
                const error = cancelOrder(order.id, user.id);
                if (error) toast.error(error);
                else router.back();
              }}
            />
          </Stack>
        ) : null}

        {canDrive && order.status !== "pending" ? (
          <Button
            title={dict.nav.reports}
            variant="ghost"
            size="md"
            full
            icon={<Flag size={16} color={colors.mutedForeground} />}
            onPress={() => setReportOpen(true)}
          />
        ) : null}
      </Screen>

      <EditPriceSheet
        order={priceOpen ? order : null}
        onClose={() => setPriceOpen(false)}
        onSubmit={(usd) => {
          const error = updateOrderPrice(order.id, user.id, usd);
          if (error) toast.error(error);
          else toast.success(dict.order.priceUpdated);
          setPriceOpen(false);
        }}
      />

      <ReportSheet
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        onSubmit={(reason) => {
          const error = reportClient(order.id, user.id, reason);
          if (error) toast.error(error);
          setReportOpen(false);
        }}
      />

      <ConfirmDeliverySheet order={confirming} onClose={() => setConfirming(null)} />
    </>
  );
}

function ContactCard({ role, name, phone }: { role: string; name: string; phone: string }) {
  const { dict } = useI18n();
  const { colors } = useTheme();
  return (
    <Card>
      <Row gap="md">
        <Stack gap={2} flex={1}>
          <Text variant="label" color="mutedForeground">
            {role}
          </Text>
          <Text variant="subheading" weight="semibold" numberOfLines={1}>
            {name}
          </Text>
        </Stack>
        <Button
          title={dict.common.phone}
          variant="outline"
          size="sm"
          icon={<Phone size={15} color={colors.foreground} />}
          onPress={() => void Linking.openURL(`tel:${phone}`)}
        />
      </Row>
    </Card>
  );
}

function EditPriceSheet({
  order,
  onClose,
  onSubmit,
}: {
  order: Order | null;
  onClose: () => void;
  onSubmit: (usd: number) => void;
}) {
  const { dict } = useI18n();
  const [value, setValue] = useState("");

  const floorUsd = order ? orderPriceFloorUsd(order) : 0;
  const floorLbp = order ? orderPriceFloorLbp(order) : 0;
  const typed = Number(value);
  const tooLow = value.trim() !== "" && Number.isFinite(typed) && typed < floorUsd;

  return (
    <Sheet
      open={order != null}
      onClose={onClose}
      title={dict.order.raisePrice}
      subtitle={fmt(dict.order.priceEditHint, {
        min: formatDeliveryCash(floorUsd, floorLbp),
      })}
      footer={
        <Button
          title={dict.common.save}
          size="lg"
          disabled={!value.trim() || tooLow || !Number.isFinite(typed)}
          onPress={() => onSubmit(typed)}
        />
      }
    >
      <Field
        label={dict.order.price}
        value={value}
        onChangeText={setValue}
        keyboardType="decimal-pad"
        placeholder={floorUsd.toFixed(2)}
        prefix={
          <Text variant="body" color="mutedForeground">
            $
          </Text>
        }
        error={
          tooLow
            ? fmt(dict.order.priceBelowQuote, { min: formatDeliveryCash(floorUsd, floorLbp) })
            : undefined
        }
      />
    </Sheet>
  );
}

function ReportSheet({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  const { dict } = useI18n();
  const [reason, setReason] = useState("");

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={dict.nav.reports}
      footer={
        <Button
          title={dict.common.done}
          size="lg"
          disabled={!reason.trim()}
          onPress={() => {
            onSubmit(reason.trim());
            setReason("");
          }}
        />
      }
    >
      <Field value={reason} onChangeText={setReason} multiline placeholder={dict.common.item} />
    </Sheet>
  );
}

async function openMaps(lat: number, lng: number) {
  const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
  try {
    await Linking.openURL(url);
  } catch {
    // Nothing to fall back to; the addresses are on screen either way.
  }
}
