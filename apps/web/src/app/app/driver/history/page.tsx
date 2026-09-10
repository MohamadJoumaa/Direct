"use client";

import { LinkButton } from "@/components/link-button";
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
import { formatOrderNumber, publicClientInfo } from "@/lib/demo-store";
import { useStore } from "@/lib/store-context";
import { orderStatusLabel, useI18n } from "@/lib/i18n";
import { OrderSearchField, useOrderSearch } from "@/components/order-search";
import { orderPartyExtras } from "@/lib/order-search";

export default function DriverHistoryPage() {
  const { user, driver } = useAuth();
  const { state } = useStore();
  const { dict } = useI18n();
  const history =
    user && driver
      ? state.orders.filter(
          (o) =>
            (o.assigned_driver_id === user.id || o.long_distance_driver_id === user.id) &&
            ["completed", "cancelled", "disputed"].includes(o.status),
        )
      : [];
  const { query, setQuery, showSearch, filtered } = useOrderSearch(history, (o) =>
    orderPartyExtras(o, state.profiles),
  );
  if (!user || !driver) {
    return (
        <p className="text-easy">{dict.driver.profileRequired}</p>
    );
  }

  return (
      <Card className="border-2">
        <CardHeader className="flex flex-col gap-3">
          <CardTitle className="heading-easy">{dict.driver.pastJobs}</CardTitle>
          <OrderSearchField show={showSearch} value={query} onChange={setQuery} />
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <p className="text-easy text-muted-foreground">{dict.driver.noCompleted}</p>
          ) : filtered.length === 0 ? (
            <p className="text-easy text-muted-foreground">{dict.common.noOrderMatches}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-base">{dict.common.orderNumber}</TableHead>
                  <TableHead className="text-base">{dict.common.item}</TableHead>
                  <TableHead className="text-base">{dict.common.client}</TableHead>
                  <TableHead className="text-base">{dict.driver.yourPay}</TableHead>
                  <TableHead className="text-base">{dict.common.status}</TableHead>
                  <TableHead className="text-base">
                    <span className="sr-only">{dict.driver.openDetails}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((o) => {
                  const client = publicClientInfo(state, o, user.id);
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
                      <TableCell className="text-base">
                        ${o.driver_cut_usd.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-base capitalize">{orderStatusLabel(o.status, dict)}</TableCell>
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
  );
}
