"use client";

import { AppShell } from "@/components/app-shell";
import { LinkButton } from "@/components/link-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/lib/auth-context";
import { formatOrderNumber } from "@/lib/demo-store";
import { useStore } from "@/lib/store-context";
import { orderTypeLabel, useI18n } from "@/lib/i18n";

export default function DriverHistoryPage() {
  const { user, driver } = useAuth();
  const { state } = useStore();
  const { dict } = useI18n();
  if (!user || !driver) {
    return (
      <AppShell>
        <p className="text-easy">{dict.driver.profileRequired}</p>
      </AppShell>
    );
  }

  const history = state.orders.filter(
    (o) =>
      (o.assigned_driver_id === user.id || o.long_distance_driver_id === user.id) &&
      ["completed", "cancelled", "disputed"].includes(o.status),
  );

  return (
    <AppShell title={dict.nav.history}>
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="heading-easy">{dict.driver.pastJobs}</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-easy text-muted-foreground">{dict.driver.noCompleted}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-base">{dict.common.orderNumber}</TableHead>
                  <TableHead className="text-base">{dict.common.item}</TableHead>
                  <TableHead className="text-base">{dict.common.client}</TableHead>
                  <TableHead className="text-base">{dict.common.type}</TableHead>
                  <TableHead className="text-base">{dict.driver.yourPay}</TableHead>
                  <TableHead className="text-base">{dict.common.status}</TableHead>
                  <TableHead className="text-base">
                    <span className="sr-only">{dict.driver.openDetails}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((o) => {
                  const client = state.profiles.find((p) => p.id === o.client_id);
                  return (
                    <TableRow key={o.id}>
                      <TableCell className="font-mono text-base font-semibold tabular-nums">
                        {formatOrderNumber(o.order_number)}
                      </TableCell>
                      <TableCell className="text-base">{o.product_description}</TableCell>
                      <TableCell className="text-base">
                        <div>{client?.full_name ?? "—"}</div>
                        {client?.phone ? (
                          <div className="text-muted-foreground">{client.phone}</div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Badge>{orderTypeLabel(o.order_type, dict)}</Badge>
                      </TableCell>
                      <TableCell className="text-base">
                        ${o.driver_cut_usd.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-base capitalize">{o.status}</TableCell>
                      <TableCell>
                        <LinkButton
                          href={`/app/driver/orders/${o.id}`}
                          variant="outline"
                          size="lg"
                          className="touch-target"
                        >
                          {dict.driver.openDetails}
                        </LinkButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
