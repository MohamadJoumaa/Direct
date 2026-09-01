"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CircleDollarSign } from "lucide-react";
import { formatDeliveryCash, withBusinessOrderCosts } from "@direct/shared";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";
import { useStore } from "@/lib/store-context";
import { useI18n } from "@/lib/i18n";

export default function AdminBusinessCostsPage() {
  const { isAdmin } = useAuth();
  const { state, updateBusinessOrderCosts } = useStore();
  const { dict } = useI18n();

  const businesses = state.profiles.filter((p) => p.role === "business");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected =
    businesses.find((b) => b.id === selectedId) ?? businesses[0] ?? null;

  const [minUsd, setMinUsd] = useState("");
  const [maxUsd, setMaxUsd] = useState("");
  const [minLbp, setMinLbp] = useState("");
  const [maxLbp, setMaxLbp] = useState("");

  useEffect(() => {
    if (!selected) return;
    const costs = withBusinessOrderCosts(selected);
    setMinUsd(String(costs.order_min_usd));
    setMaxUsd(String(costs.order_max_usd));
    setMinLbp(String(costs.order_min_lbp));
    setMaxLbp(String(costs.order_max_lbp));
  }, [selected]);

  if (!isAdmin) {
    return (
      <AppShell>
        <p className="text-easy">{dict.common.adminOnly}</p>
      </AppShell>
    );
  }

  function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    const err = updateBusinessOrderCosts(selected.id, {
      order_min_usd: Number(minUsd),
      order_max_usd: Number(maxUsd),
      order_min_lbp: Number(minLbp),
      order_max_lbp: Number(maxLbp),
    });
    if (err) {
      toast.error(err);
      return;
    }
    toast.success(dict.admin.costsSaved);
  }

  return (
    <AppShell title={dict.nav.orderCosts}>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="heading-easy">{dict.admin.orderCostsTitle}</h1>
          <p className="mt-2 max-w-2xl text-lg text-muted-foreground">{dict.admin.orderCostsBody}</p>
        </div>

        {businesses.length === 0 ? (
          <Card className="border-2">
            <CardContent className="py-10 text-center text-easy text-muted-foreground">
              {dict.admin.noBusinesses}
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-3">
              {businesses.map((b) => {
                const costs = withBusinessOrderCosts(b);
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setSelectedId(b.id)}
                    className={`touch-target rounded-xl border-2 p-4 text-start transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ${
                      selected?.id === b.id
                        ? "border-foreground bg-muted"
                        : "border-border hover:bg-muted/60"
                    }`}
                  >
                    <p className="text-lg font-semibold">{b.business_name || b.full_name}</p>
                    <p className="text-base text-muted-foreground">
                      {formatDeliveryCash(costs.order_min_usd, costs.order_min_lbp)} –{" "}
                      {formatDeliveryCash(costs.order_max_usd, costs.order_max_lbp)}
                    </p>
                  </button>
                );
              })}
            </div>

            {selected ? (
              <Card className="border-2">
                <CardHeader>
                  <CardTitle className="text-2xl">
                    <CircleDollarSign className="me-2 inline size-6" />
                    {selected.business_name || selected.full_name}
                  </CardTitle>
                  <CardDescription className="text-base">
                    {dict.admin.orderCostsBody}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={onSave} className="grid gap-4 sm:grid-cols-2">
                    <CostField
                      id="min-usd"
                      label={dict.admin.minUsd}
                      value={minUsd}
                      onChange={setMinUsd}
                    />
                    <CostField
                      id="max-usd"
                      label={dict.admin.maxUsd}
                      value={maxUsd}
                      onChange={setMaxUsd}
                    />
                    <CostField
                      id="min-lbp"
                      label={dict.admin.minLbp}
                      value={minLbp}
                      onChange={setMinLbp}
                      step="1000"
                    />
                    <CostField
                      id="max-lbp"
                      label={dict.admin.maxLbp}
                      value={maxLbp}
                      onChange={setMaxLbp}
                      step="1000"
                    />
                    <Button
                      type="submit"
                      size="lg"
                      className="touch-target w-fit rounded-full px-6 sm:col-span-2"
                    >
                      {dict.admin.saveCosts}
                    </Button>
                  </form>
                </CardContent>
              </Card>
            ) : null}
          </>
        )}
      </div>
    </AppShell>
  );
}

function CostField({
  id,
  label,
  value,
  onChange,
  step = "0.01",
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  step?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="text-lg">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        step={step}
        min={0}
        inputMode="decimal"
        className="h-12 text-lg"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
      />
    </div>
  );
}
