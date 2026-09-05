"use client";

import type { ReactNode } from "react";
import { Clock, MapPin, Package } from "lucide-react";
import type { Order, Warehouse } from "@/lib/demo-store";
import { formatOrderNumber } from "@/lib/demo-store";
import { Badge } from "@/components/ui/badge";
import { orderTypeLabel, useI18n } from "@/lib/i18n";
import { locationLabel } from "@/lib/place-name";
import { cn } from "@/lib/utils";

type ExtraLine = { label: string; value: string };

export function OrderReceipt({
  order,
  warehouse,
  cashLabel,
  cashValue,
  extraCashLines,
  people,
}: {
  order: Order;
  warehouse?: Warehouse | null;
  cashLabel: string;
  cashValue: string;
  extraCashLines?: ExtraLine[];
  people?: ReactNode;
}) {
  const { dict, lang } = useI18n();
  const placed = new Date(order.created_at).toLocaleString(lang === "ar" ? "ar-LB" : "en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <article className="overflow-hidden rounded-2xl border-2 bg-card">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-dashed bg-muted px-5 py-4">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-xs font-semibold tracking-[0.18em] text-muted-foreground uppercase">
            {dict.common.receipt}
          </p>
          <p className="font-mono text-3xl font-bold tracking-tight tabular-nums">
            {formatOrderNumber(order.order_number)}
          </p>
          <p className="text-sm text-muted-foreground">
            {dict.common.placed} · {placed}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge>{orderTypeLabel(order.order_type, dict)}</Badge>
          <Badge variant="outline" className="capitalize">
            {order.status.replaceAll("_", " ")}
          </Badge>
        </div>
      </header>

      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-start gap-3 rounded-xl border-2 bg-muted/40 p-4">
          <Package className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted-foreground">{dict.common.item}</p>
            <p className="text-xl font-semibold">{order.product_description}</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <LocationBox
            label={dict.common.from}
            value={locationLabel(order.pickup_address, order.pickup_lat, order.pickup_lng)}
          />
          <LocationBox
            label={dict.common.to}
            value={locationLabel(order.dropoff_address, order.dropoff_lat, order.dropoff_lng)}
          />
        </div>

        {warehouse ? (
          <LocationBox
            label={dict.common.warehouse}
            value={`${warehouse.name} — ${locationLabel(warehouse.address, warehouse.lat, warehouse.lng)}`}
          />
        ) : null}

        <div className="flex flex-col gap-2 rounded-xl border-2 border-dashed p-4">
          <ReceiptRow label={cashLabel} value={cashValue} emphasize />
          {extraCashLines?.map((line) => (
            <ReceiptRow key={line.label} label={line.label} value={line.value} />
          ))}
          {order.eta_minutes != null ? (
            <ReceiptRow
              label={dict.common.eta}
              value={`~${order.eta_minutes} ${dict.common.minutes}`}
              icon
            />
          ) : null}
        </div>

        {people ? <div className="flex flex-col gap-3">{people}</div> : null}
      </div>
    </article>
  );
}

function LocationBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border-2 p-4">
      <MapPin className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="text-base font-semibold">{value}</p>
      </div>
    </div>
  );
}

function ReceiptRow({
  label,
  value,
  emphasize,
  icon,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
  icon?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="inline-flex items-center gap-2 text-sm text-muted-foreground">
        {icon ? <Clock className="size-4" aria-hidden /> : null}
        {label}
      </span>
      <span className={cn("text-right tabular-nums", emphasize ? "text-lg font-bold" : "text-base font-medium")}>
        {value}
      </span>
    </div>
  );
}
