"use client";

import { useMemo, useState } from "react";
import { Menu } from "lucide-react";
import { WHISH_NUMBER } from "@direct/shared";
import { driverCommissionTotals, driverDailyProfit, driverRevenue } from "@/lib/demo-store";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useStore } from "@/lib/store-context";
import { useI18n } from "@/lib/i18n";

const chartConfig = {
  profit: { label: "Profit $", color: "var(--gold)" },
} satisfies ChartConfig;

type Period = "today" | "yesterday" | "week" | "month";

export default function DriverDashboardPage() {
  const { user, driver } = useAuth();
  const { state, requestPay, confirmWhish } = useStore();
  const { dict } = useI18n();
  const [period, setPeriod] = useState<Period>("week");
  const [checking, setChecking] = useState(false);

  const chartData = useMemo(
    () => (user ? driverDailyProfit(state, user.id, period) : []),
    [state, user, period],
  );

  if (!user || !driver) return null;

  const periods: { key: Period; label: string }[] = [
    { key: "today", label: dict.driver.today },
    { key: "yesterday", label: dict.driver.yesterday },
    { key: "week", label: dict.driver.lastWeek },
    { key: "month", label: dict.driver.lastMonth },
  ];
  const stats = periods.map((p) => ({
    ...p,
    ...driverRevenue(state, user.id, p.key),
  }));
  const selectedPeriod = periods.find((p) => p.key === period) ?? periods[2];

  const history = state.orders.filter(
    (o) =>
      (o.assigned_driver_id === user.id || o.long_distance_driver_id === user.id) &&
      ["completed", "disputed"].includes(o.status),
  );

  const percentageMode = state.settings.revenue_mode === "percentage";
  const commission = percentageMode
    ? driverCommissionTotals(state, user.id)
    : { dueNow: 0, accruingToday: 0 };
  const payKind = percentageMode ? "commission" : "subscription";
  const pendingApiTx = state.whish.find(
    (t) =>
      t.driver_id === user.id &&
      t.source === "api" &&
      t.status === "pending" &&
      t.kind === payKind,
  );

  const dueAmount = percentageMode
    ? commission.dueNow
    : state.settings.subscription_price_usd +
      (driver.subscription_status === "frozen" ? state.settings.freeze_penalty_usd : 0);

  async function payWithWhish() {
    if (percentageMode && dueAmount <= 0) {
      toast.info(dict.driver.accruingTodayHint);
      return;
    }
    setChecking(true);
    try {
      const res = await fetch("/api/whish/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: dueAmount,
          phone: user!.phone,
          note: percentageMode
            ? `Direct commission — ${user!.full_name}`
            : `Direct subscription — ${user!.full_name}`,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.configured) {
        toast.info(`Whish API is not configured — pay manually to ${WHISH_NUMBER}`);
        return;
      }
      requestPay(user!.id, {
        source: "api",
        externalId: data.externalId,
        kind: payKind,
        amount: dueAmount,
      });
      if (data.collectUrl) window.open(data.collectUrl, "_blank", "noopener");
      toast.success("Whish payment created — finish it in the Whish app");
    } catch {
      toast.info(`Whish is unreachable — pay manually to ${WHISH_NUMBER}`);
    } finally {
      setChecking(false);
    }
  }

  async function checkWhishStatus() {
    if (!pendingApiTx) return;
    setChecking(true);
    try {
      const res = await fetch("/api/whish/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ externalId: pendingApiTx.external_id }),
      });
      const data = await res.json();
      if (data.paid) {
        confirmWhish(pendingApiTx.id);
        toast.success(
          percentageMode
            ? dict.driver.commissionPaymentConfirmed
            : dict.driver.paymentConfirmed,
        );
      } else {
        toast.info(dict.driver.notPaidYet);
      }
    } catch {
      toast.error("Could not check the payment right now");
    } finally {
      setChecking(false);
    }
  }

  return (
    <AppShell title={dict.nav.money}>
      <div className="flex flex-col gap-6">
        <h1 className="heading-easy">{dict.driver.yourEarnings}</h1>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((s) => (
            <Card key={s.key} className="border-2">
              <CardHeader>
                <CardTitle className="text-lg text-muted-foreground">{s.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold text-primary">${s.profit.toFixed(2)}</p>
                <p className="text-base text-muted-foreground">
                  {s.orders} {dict.common.orders}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="border-2">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
            <div className="flex flex-col gap-2">
              <CardTitle className="text-xl">
                {dict.driver.profitChart} — {selectedPeriod.label}
              </CardTitle>
              <span aria-hidden className="block h-0.5 w-10 rounded-full bg-gold" />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger
                className="touch-target inline-flex items-center gap-2 rounded-full border-2 px-4 py-2 text-base font-semibold transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                aria-label={dict.driver.period}
              >
                <Menu className="size-5" />
                <span className="hidden sm:inline">{selectedPeriod.label}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>{dict.driver.period}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {periods.map((p) => (
                    <DropdownMenuItem
                      key={p.key}
                      onClick={() => setPeriod(p.key)}
                      className={p.key === period ? "font-semibold" : undefined}
                    >
                      {p.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-64 w-full">
              <BarChart data={chartData}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" minTickGap={24} tickLine={false} />
                <YAxis width={40} tickLine={false} axisLine={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="profit" fill="var(--color-profit)" radius={6} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card className="border-2 bg-muted">
          <CardHeader>
            <CardTitle className="text-xl">
              {percentageMode ? dict.driver.commissionDue : dict.driver.subscription}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-lg">
            {percentageMode ? (
              <>
                <p>
                  {dict.driver.dueNow}:{" "}
                  <strong>${commission.dueNow.toFixed(2)}</strong>
                  {commission.dueNow > 0 ? (
                    <span className="mt-1 block text-base text-muted-foreground">
                      {dict.driver.mustPayToTakeOrders}
                    </span>
                  ) : null}
                </p>
                <p>
                  {dict.driver.accruingToday}:{" "}
                  <strong>${commission.accruingToday.toFixed(2)}</strong>
                  <span className="mt-1 block text-base text-muted-foreground">
                    {dict.driver.accruingTodayHint}
                  </span>
                </p>
                <p>
                  ${dueAmount.toFixed(2)} via Whish → <strong>{WHISH_NUMBER}</strong>
                </p>
              </>
            ) : (
              <>
                <p>
                  {dict.common.status}:{" "}
                  <strong className="capitalize">
                    {driver.subscription_status.replaceAll("_", " ")}
                  </strong>
                </p>
                <p>
                  {dict.driver.ends}:{" "}
                  <strong>
                    {driver.subscription_ends_at
                      ? new Date(driver.subscription_ends_at).toLocaleDateString()
                      : dict.driver.notStarted}
                  </strong>
                </p>
                <p>
                  ${dueAmount} via Whish → <strong>{WHISH_NUMBER}</strong>
                </p>
              </>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                size="lg"
                className="touch-target rounded-full"
                disabled={checking || (percentageMode && dueAmount <= 0)}
                onClick={payWithWhish}
              >
                {dict.driver.payWithWhish}
              </Button>
              {pendingApiTx ? (
                <Button
                  size="lg"
                  variant="outline"
                  className="touch-target rounded-full"
                  disabled={checking}
                  onClick={checkWhishStatus}
                >
                  {dict.driver.checkPayment}
                </Button>
              ) : (
                <Button
                  size="lg"
                  variant="outline"
                  className="touch-target rounded-full"
                  disabled={percentageMode && dueAmount <= 0}
                  onClick={() => {
                    requestPay(user.id, { kind: payKind, amount: dueAmount });
                    toast.success(dict.driver.paidLogged);
                  }}
                >
                  {dict.driver.iPaid}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader>
            <CardTitle className="text-xl">{dict.driver.completedOrders}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {history.length === 0 ? (
              <p className="text-muted-foreground">{dict.driver.noCompleted}</p>
            ) : (
              history.map((o) => (
                <div
                  key={o.id}
                  className="flex justify-between gap-2 rounded-lg bg-muted px-3 py-2 text-base"
                >
                  <span>{o.product_description}</span>
                  <span className="font-semibold">${o.driver_cut_usd.toFixed(2)}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
