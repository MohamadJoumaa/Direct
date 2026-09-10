"use client";

import Link from "next/link";
import { formatDeliveryCash } from "@direct/shared";
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
import { orderStatusLabel, useI18n } from "@/lib/i18n";
import { OrderSearchField, useOrderSearch } from "@/components/order-search";
import { orderPartyExtras } from "@/lib/order-search";

export default function ClientHistoryPage() {
  const { user } = useAuth();
  const { state } = useStore();
  const { dict } = useI18n();
  const history = user
    ? state.orders.filter(
        (o) => o.client_id === user.id && ["completed", "cancelled", "disputed"].includes(o.status),
      )
    : [];
  const { query, setQuery, showSearch, filtered } = useOrderSearch(history, (o) =>
    orderPartyExtras(o, state.profiles),
  );

  return (
      <Card className="border-2">
        <CardHeader className="flex flex-col gap-3">
          <CardTitle className="heading-easy">{dict.client.pastDeliveries}</CardTitle>
          <OrderSearchField show={showSearch} value={query} onChange={setQuery} />
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-easy text-muted-foreground">{dict.client.noCompleted}</p>
          ) : filtered.length === 0 ? (
            <p className="text-easy text-muted-foreground">{dict.common.noOrderMatches}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-base">{dict.common.orderNumber}</TableHead>
                  <TableHead className="text-base">{dict.common.item}</TableHead>
                  <TableHead className="text-base">{dict.client.paid}</TableHead>
                  <TableHead className="text-base">{dict.common.status}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="font-mono text-base font-semibold tabular-nums">
                        <Link
                          href={`/app/client/orders/${o.id}`}
                          className="underline-offset-4 hover:underline"
                        >
                          {formatOrderNumber(o.order_number)}
                        </Link>
                      </TableCell>
                      <TableCell className="text-base">{o.product_description}</TableCell>
                    <TableCell className="text-base">
                      {formatDeliveryCash(o.delivery_fee_usd, o.delivery_fee_lbp)}
                    </TableCell>
                    <TableCell className="text-base capitalize">{orderStatusLabel(o.status, dict)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
  );
}
