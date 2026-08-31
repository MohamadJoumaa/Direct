"use client";

import { toast } from "sonner";
import { percentageAccrued, subscriptionBudget, driverRevenue } from "@/lib/demo-store";
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
  profit: { label: "Driver profit", color: "var(--color-primary)" },
} satisfies ChartConfig;

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

  const budget = subscriptionBudget(state);
  const pct = percentageAccrued(state);
  const driverCharts = state.drivers.map((d) => {
    const p = state.profiles.find((x) => x.id === d.id);
    const week = driverRevenue(state, d.id, "week");
    return { name: p?.full_name?.split(" ")[0] ?? "Driver", profit: week.profit };
  });

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
          <CardHeader>
            <CardTitle className="text-xl">Driver revenue (last week)</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-72 w-full">
              <BarChart data={driverCharts}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="name" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="profit" fill="var(--color-profit)" radius={8} />
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
