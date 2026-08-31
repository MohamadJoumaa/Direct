"use client";

import { toast } from "sonner";
import type { RevenueMode } from "@direct/shared";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
            <CardTitle className="text-2xl">Delivery prices (driver profit)</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Field label="Fast / normal $" value={s.price_normal_usd} onChange={(v) => num("price_normal_usd", v)} />
            <Field label="Long distance $" value={s.price_long_distance_usd} onChange={(v) => num("price_long_distance_usd", v)} />
            <Field label="Trusted $" value={s.price_trusted_usd} onChange={(v) => num("price_trusted_usd", v)} />
            <Field label="Private $" value={s.price_private_usd} onChange={(v) => num("price_private_usd", v)} />
            <Field label="Owner $" value={s.price_owner_usd} onChange={(v) => num("price_owner_usd", v)} />
            <Field label="Medical (later) $" value={s.price_medical_usd} onChange={(v) => num("price_medical_usd", v)} />
            <Field label="Nearby radius km" value={s.nearby_radius_km} onChange={(v) => num("nearby_radius_km", v)} />
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
}: {
  label: string;
  value: number;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label className="text-lg">{label}</Label>
      <Input
        type="number"
        step="0.01"
        className="h-12 text-lg"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
