"use client";

import { toast } from "sonner";
import {
  formatDeliveryCash,
  quoteDeliveryPrice,
  type RevenueMode,
} from "@direct/shared";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import { useStore } from "@/lib/store-context";

const PREVIEW_KM = [1, 3, 15, 50, 150, 200] as const;
const PREVIEW_AT = new Date("2026-09-01T12:00:00+03:00");

export default function AdminSettingsPage() {
  const { isAdmin } = useAuth();
  const { state, updateSettings, reset } = useStore();
  if (!isAdmin) {
    return (
      <AppShell>
        <p className="text-easy">Admin only.</p>
      </AppShell>
    );
  }

  const s = state.settings;

  function num(key: keyof typeof s, value: string) {
    const n = Number(value);
    if (Number.isNaN(n)) return;
    updateSettings({ [key]: n });
  }

  return (
    <AppShell title="Settings">
      <div className="flex flex-col gap-6">
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="heading-easy">Company money plan</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label className="text-lg">How we earn</Label>
              <Select
                value={s.revenue_mode}
                onValueChange={(v) => updateSettings({ revenue_mode: v as RevenueMode })}
                items={[
                  { label: "Driver monthly subscription (main)", value: "subscription" },
                  { label: "Percentage of each order", value: "percentage" },
                ]}
              >
                <SelectTrigger className="h-12 text-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="subscription">
                      Driver monthly subscription (main)
                    </SelectItem>
                    <SelectItem value="percentage">Percentage of each order</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {s.revenue_mode === "subscription" ? (
                <>
                  <Field
                    label="Subscription $"
                    value={s.subscription_price_usd}
                    onChange={(v) => num("subscription_price_usd", v)}
                  />
                  <Field
                    label="Grace days"
                    value={s.grace_days}
                    onChange={(v) => num("grace_days", v)}
                  />
                  <Field
                    label="Freeze penalty $"
                    value={s.freeze_penalty_usd}
                    onChange={(v) => num("freeze_penalty_usd", v)}
                  />
                </>
              ) : (
                <Field
                  label="Company %"
                  value={s.company_percentage}
                  onChange={(v) => num("company_percentage", v)}
                />
              )}
              <Field
                label="Night surcharge $"
                value={s.night_surcharge_usd}
                onChange={(v) => num("night_surcharge_usd", v)}
              />
              <Field
                label="Night surcharge LBP"
                value={s.night_surcharge_lbp}
                step="1000"
                onChange={(v) => num("night_surcharge_lbp", v)}
              />
              <div className="flex flex-col gap-2">
                <Label className="text-lg">Whish number</Label>
                <Input
                  className="h-12 text-lg"
                  value={s.whish_number}
                  onChange={(e) => updateSettings({ whish_number: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader>
            <CardTitle className="text-2xl">Delivery fare by distance</CardTitle>
            <CardDescription className="text-base">
              Minimum fare from 0 km up to the short-trip distance. Then the price rises
              linearly until the long-trip distance, and stays at the maximum after that.
              USD and LBP are set separately. Changes apply immediately to new quotes.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Short trip up to (km)"
                value={s.fare_min_km}
                onChange={(v) => num("fare_min_km", v)}
              />
              <Field
                label="Long trip from (km)"
                value={s.fare_max_km}
                onChange={(v) => num("fare_max_km", v)}
              />
              <Field
                label="Min fare $"
                value={s.fare_min_usd}
                onChange={(v) => num("fare_min_usd", v)}
              />
              <Field
                label="Min fare LBP"
                value={s.fare_min_lbp}
                step="1000"
                onChange={(v) => num("fare_min_lbp", v)}
              />
              <Field
                label="Max fare $"
                value={s.fare_max_usd}
                onChange={(v) => num("fare_max_usd", v)}
              />
              <Field
                label="Max fare LBP"
                value={s.fare_max_lbp}
                step="1000"
                onChange={(v) => num("fare_max_lbp", v)}
              />
            </div>

            <div>
              <p className="mb-3 text-lg font-semibold">Service multipliers</p>
              <p className="mb-4 text-base text-muted-foreground">
                Applied on top of the distance fare. Fast delivery uses 1. Private and
                trusted trips can be higher.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Fast / normal ×"
                  value={s.multiplier_normal}
                  onChange={(v) => num("multiplier_normal", v)}
                />
                <Field
                  label="Long distance ×"
                  value={s.multiplier_long_distance}
                  onChange={(v) => num("multiplier_long_distance", v)}
                />
                <Field
                  label="Trusted ×"
                  value={s.multiplier_trusted}
                  onChange={(v) => num("multiplier_trusted", v)}
                />
                <Field
                  label="Private ×"
                  value={s.multiplier_private}
                  onChange={(v) => num("multiplier_private", v)}
                />
                <Field
                  label="Owner ×"
                  value={s.multiplier_owner}
                  onChange={(v) => num("multiplier_owner", v)}
                />
                <Field
                  label="Medical (later) ×"
                  value={s.multiplier_medical}
                  onChange={(v) => num("multiplier_medical", v)}
                />
                <Field
                  label="Nearby radius km"
                  value={s.nearby_radius_km}
                  onChange={(v) => num("nearby_radius_km", v)}
                />
              </div>
            </div>

            <div className="rounded-xl bg-muted p-4">
              <p className="text-lg font-semibold">Fast delivery preview</p>
              <ul className="mt-3 flex flex-col gap-2 text-base">
                {PREVIEW_KM.map((km) => {
                  const q = quoteDeliveryPrice("normal", s, km, PREVIEW_AT);
                  return (
                    <li key={km} className="flex justify-between gap-4">
                      <span>{km} km</span>
                      <strong>{formatDeliveryCash(q.totalUsd, q.totalLbp)}</strong>
                    </li>
                  );
                })}
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader>
            <CardTitle className="text-xl">Warehouses</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-lg">
            {state.warehouses.map((w) => (
              <p key={w.id}>
                <strong>{w.name}</strong> — {w.address} ({w.lat}, {w.lng})
              </p>
            ))}
          </CardContent>
        </Card>

        <Button
          variant="outline"
          size="lg"
          className="touch-target w-fit"
          onClick={() => {
            reset();
            toast.message("Demo data reset");
          }}
        >
          Reset demo data
        </Button>
      </div>
    </AppShell>
  );
}

function Field({
  label,
  value,
  onChange,
  step = "0.01",
}: {
  label: string;
  value: number;
  onChange: (v: string) => void;
  step?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-lg">{label}</Label>
      <Input
        type="number"
        step={step}
        min={0}
        inputMode="decimal"
        className="h-12 text-lg"
        value={Number(step) >= 1 ? value : Number(value.toFixed(2))}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
