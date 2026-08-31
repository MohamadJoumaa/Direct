"use client";

import { AppShell } from "@/components/app-shell";
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
import { useStore } from "@/lib/store-context";
import { orderTypeLabel, useI18n } from "@/lib/i18n";

export default function ClientHistoryPage() {
  const { user } = useAuth();
  const { state } = useStore();
  const { dict } = useI18n();
  if (!user) return null;
  const history = state.orders.filter(
    (o) => o.client_id === user.id && ["completed", "cancelled", "disputed"].includes(o.status),
  );

  return (
    <AppShell title={dict.nav.history}>
      <Card className="border-2">
        <CardHeader>
          <CardTitle className="heading-easy">{dict.client.pastDeliveries}</CardTitle>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-easy text-muted-foreground">{dict.client.noCompleted}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-base">{dict.common.item}</TableHead>
                  <TableHead className="text-base">{dict.common.type}</TableHead>
                  <TableHead className="text-base">{dict.client.paid}</TableHead>
                  <TableHead className="text-base">{dict.common.status}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="text-base">{o.product_description}</TableCell>
                    <TableCell>
                      <Badge>{orderTypeLabel(o.order_type, dict)}</Badge>
                    </TableCell>
                    <TableCell className="text-base">${o.delivery_fee_usd.toFixed(2)}</TableCell>
                    <TableCell className="text-base capitalize">{o.status}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </AppShell>
  );
}
