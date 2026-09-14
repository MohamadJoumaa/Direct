"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Menu } from "lucide-react";
import { toast } from "sonner";
import {
  companyProfitOnDay,
  percentageAccrued,
  subscriptionBudget,
  driverDailyProfit,
} from "@/lib/demo-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { useAuth } from "@/lib/auth-context";
import { useStore } from "@/lib/store-context";
import { useI18n } from "@/lib/i18n";

const chartConfig = {
  profit: { label: "Profit $", color: "var(--gold)" },
} satisfies ChartConfig;

type Period = "today" | "yesterday" | "week" | "month";

/** `yyyy-mm-dd` in the admin's own timezone — what `<input type="date">` speaks. */
function toDateInput(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

function fromDateInput(value: string): Date | null {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

export default function AdminMoneyPage() {
  const { isAdmin } = useAuth();
  const { state, confirmWhish } = useStore();
  if (!isAdmin) {
    return (
        <p className="text-easy">Admin only.</p>
    );
  }

  const [period, setPeriod] = useState<Period>("week");

  const budget = subscriptionBudget(state);
  const pct = percentageAccrued(state);

  const chartData = useMemo(() => {
    const allDaily: Record<string, number> = {};
    for (const d of state.drivers) {
      const days = driverDailyProfit(state, d.id, period);
      for (const day of days) {
        allDaily[day.label] = (allDaily[day.label] ?? 0) + day.profit;
      }
    }
    return Object.entries(allDaily).map(([label, profit]) => ({ label, profit }));
  }, [state, period]);

  const periods: { key: Period; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "yesterday", label: "Yesterday" },
    { key: "week", label: "Last week" },
    { key: "month", label: "Last month" },
  ];
  const selectedPeriod = periods.find((p) => p.key === period) ?? periods[2];

  return (
      <div className="flex flex-col gap-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="border-2 bg-primary text-primary-foreground">
            <CardHeader>
              <CardTitle className="text-xl">Subscription budget</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold">${budget.toFixed(2)}</p>
              <p className="text-base opacity-90">Confirmed Whish payments</p>
            </CardContent>
          </Card>
          <Card className="border-2 bg-muted">
            <CardHeader>
              <CardTitle className="text-xl">Percentage accrued</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-4xl font-bold text-primary">${pct.toFixed(2)}</p>
              <p className="text-base text-muted-foreground">
                Drivers choose subscription or percentage on their profile.
              </p>
            </CardContent>
          </Card>
        </div>

        <ProfitByDay />

        <Card className="border-2">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
            <div className="flex flex-col gap-2">
              <CardTitle className="text-xl">
                Total profit — {selectedPeriod.label}
              </CardTitle>
              <span aria-hidden className="block h-0.5 w-10 rounded-full bg-gold" />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger
                className="touch-target inline-flex items-center gap-2 rounded-full border-2 px-4 py-2 text-base font-semibold transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                aria-label="Period"
              >
                <Menu className="size-5" />
                <span className="hidden sm:inline">{selectedPeriod.label}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuGroup>
                  <DropdownMenuLabel>Period</DropdownMenuLabel>
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

        <Card className="border-2">
          <CardHeader>
            <CardTitle className="text-2xl">Whish transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kind</TableHead>
                  <TableHead>Driver phone</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Note</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.whish.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="capitalize">{tx.kind}</TableCell>
                    <TableCell>{tx.phone_ref}</TableCell>
                    <TableCell>${tx.amount_usd.toFixed(2)}</TableCell>
                    <TableCell>{tx.source}</TableCell>
                    <TableCell className="capitalize">{tx.status}</TableCell>
                    <TableCell>{tx.note}</TableCell>
                    <TableCell>
                      {tx.status === "pending" ? (
                        <Button
                          size="sm"
                          onClick={() => {
                            confirmWhish(tx.id);
                            toast.success(
                              tx.kind === "commission"
                                ? "Payment confirmed"
                                : "Payment confirmed — subscription activated",
                            );
                          }}
                        >
                          Confirm
                        </Button>
                      ) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
  );
}

/** Pick any past day and read what Direct earned on it. */
function ProfitByDay() {
  const { state } = useStore();
  const { dict, lang } = useI18n();
  const today = toDateInput(new Date());
  const [day, setDay] = useState(today);

  const picked = fromDateInput(day);
  const profit = useMemo(
    () => (picked ? companyProfitOnDay(state, picked) : null),
    [state, picked],
  );
  const readableDay = picked
    ? picked.toLocaleDateString(lang === "ar" ? "ar-LB" : "en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "";

  return (
    <Card className="border-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <CalendarDays className="size-5" />
          {dict.admin.budgetByDay}
        </CardTitle>
        <CardDescription className="text-base">{dict.admin.budgetByDayHint}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="budget-day" className="text-lg">
            {dict.common.day}
          </Label>
          <Input
            id="budget-day"
            type="date"
            // No future days: there is nothing to report yet.
            max={today}
            className="h-12 w-fit text-lg"
            value={day}
            onChange={(e) => setDay(e.target.value)}
          />
        </div>
        {profit ? (
          <>
            <p className="text-base text-muted-foreground">{readableDay}</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <DayStat label={dict.common.total} value={`$${profit.total.toFixed(2)}`} emphasize />
              <DayStat
                label={dict.admin.daySubscriptions}
                value={`$${profit.subscription.toFixed(2)}`}
              />
              <DayStat label={dict.admin.dayOrderCuts} value={`$${profit.percentage.toFixed(2)}`} />
            </div>
            <p className="text-base text-muted-foreground">
              {dict.admin.dayDeliveries}: <strong>{profit.orders}</strong>
            </p>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}

function DayStat({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  return (
    <div className="rounded-xl bg-muted p-4">
      <p className="text-base text-muted-foreground">{label}</p>
      <p className={emphasize ? "text-3xl font-bold text-primary" : "text-2xl font-semibold"}>
        {value}
      </p>
    </div>
  );
}
