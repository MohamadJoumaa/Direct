"use client";

import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { useStore } from "@/lib/store-context";

export default function AdminReportsPage() {
  const { isAdmin } = useAuth();
  const { state, resolveReport } = useStore();
  if (!isAdmin) {
    return (
      <AppShell>
        <p className="text-easy">Admin only.</p>
      </AppShell>
    );
  }

  return (
    <AppShell title="Reports">
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="heading-easy">Driver reports (fake data)</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {state.reports.length === 0 ? (
            <p className="text-easy text-muted-foreground">No reports.</p>
          ) : (
            state.reports.map((r) => {
              const reporter = state.profiles.find((p) => p.id === r.reporter_id);
              const order = state.orders.find((o) => o.id === r.order_id);
              return (
                <div key={r.id} className="rounded-xl border p-4">
                  <p className="text-lg font-semibold">
                    {reporter?.full_name} · {r.status}
                  </p>
                  <p className="text-base text-muted-foreground">
                    Order: {order?.product_description ?? r.order_id}
                  </p>
                  <p className="mt-2 text-lg">{r.reason}</p>
                  {r.status === "open" ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        size="lg"
                        className="touch-target"
                        onClick={() => {
                          resolveReport(r.id, true);
                          toast.success("Upheld — 50/50 loss applied");
                        }}
                      >
                        Uphold (50/50)
                      </Button>
                      <Button
                        size="lg"
                        variant="outline"
                        className="touch-target"
                        onClick={() => {
                          resolveReport(r.id, false);
                          toast.message("Dismissed");
                        }}
                      >
                        Dismiss
                      </Button>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
