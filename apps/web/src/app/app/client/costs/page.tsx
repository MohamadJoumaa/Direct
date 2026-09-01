"use client";

import { CircleDollarSign } from "lucide-react";
import { formatDeliveryCash, withBusinessOrderCosts } from "@direct/shared";
import { AppShell } from "@/components/app-shell";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { useStore } from "@/lib/store-context";
import { useI18n } from "@/lib/i18n";

export default function BusinessCostsPage() {
  const { user, effectiveRole } = useAuth();
  const { state } = useStore();
  const { dict } = useI18n();

  if (effectiveRole !== "business") {
    return (
      <AppShell>
        <p className="text-easy">{dict.admin.businessOnly}</p>
      </AppShell>
    );
  }

  const business =
    user?.role === "business"
      ? user
      : (state.profiles.find((p) => p.role === "business") ?? null);

  if (!business) {
    return (
      <AppShell title={dict.nav.costs}>
        <Card className="border-2">
          <CardContent className="py-10 text-center text-easy text-muted-foreground">
            {dict.admin.noBusinesses}
          </CardContent>
        </Card>
      </AppShell>
    );
  }

  const costs = withBusinessOrderCosts(business);

  return (
    <AppShell title={dict.nav.costs}>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="heading-easy">{dict.profile.orderCosts}</h1>
          <p className="mt-2 max-w-2xl text-lg text-muted-foreground">
            {dict.profile.orderCostsReadonly}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="text-2xl">
                <CircleDollarSign className="me-2 inline size-6" />
                {dict.profile.minOrder}
              </CardTitle>
              <CardDescription className="text-base">
                {business.business_name || business.full_name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold tabular-nums">
                {formatDeliveryCash(costs.order_min_usd, costs.order_min_lbp)}
              </p>
            </CardContent>
          </Card>
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="text-2xl">
                <CircleDollarSign className="me-2 inline size-6" />
                {dict.profile.maxOrder}
              </CardTitle>
              <CardDescription className="text-base">
                {business.business_name || business.full_name}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold tabular-nums">
                {formatDeliveryCash(costs.order_max_usd, costs.order_max_lbp)}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
