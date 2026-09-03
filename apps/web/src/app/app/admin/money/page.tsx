"use client";

import { useMemo, useState } from "react";
import { Menu } from "lucide-react";
import { toast } from "sonner";
import { percentageAccrued, subscriptionBudget, driverRevenue, driverDailyProfit } from "@/lib/demo-store";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

const chartConfig = {
  profit: { label: "Profit $", color: "var(--gold)" },
} satisfies ChartConfig;

type Period = "today" | "yesterday" | "week" | "month";

export default function AdminMoneyPage() {
  const { isAdmin } = useAuth();
  const { state, confirmWhish } = useStore();
  if (!isAdmin) {
    return (
      <AppShell>
        <p className="text-easy">Admin only.</p>
      </AppShell>
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
    <AppShell title="Budget">
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
                Mode: {state.settings.revenue_mode}
              </p>
            </CardContent>
          </Card>
        </div>

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
          <CardContent className="overflow-x-auto">
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
    </AppShell>
  );
}
