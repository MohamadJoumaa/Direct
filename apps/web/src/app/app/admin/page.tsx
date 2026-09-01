"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { formatDeliveryCash, ORDER_TYPE_LABELS } from "@direct/shared";
import { AppShell } from "@/components/app-shell";
import { LinkButton } from "@/components/link-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { useI18n } from "@/lib/i18n";

export default function AdminOrdersPage() {
  const router = useRouter();
  const { isAdmin, user } = useAuth();
  const { state, claimOrder, rejectOrder } = useStore();
  const { dict } = useI18n();

  if (!user || !isAdmin) {
    return (
      <AppShell>
        <p className="text-easy">{dict.common.adminOnly}</p>
      </AppShell>
    );
  }

  const pending = state.orders.filter((o) => o.status === "pending" || o.status === "at_warehouse");
  const ongoing = state.orders.filter(
    (o) => !["pending", "completed", "cancelled", "disputed", "at_warehouse"].includes(o.status),
  );
  const history = state.orders.filter((o) =>
    ["completed", "cancelled", "disputed"].includes(o.status),
  );

  return (
    <AppShell title="Admin">
      <div className="flex flex-col gap-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="heading-easy">{dict.admin.allOrders}</h1>
          <LinkButton href="/app/client/new" size="lg" className="touch-target rounded-full">
            {dict.nav.newOrder}
          </LinkButton>
        </div>

        <Card className="border-2">
          <CardHeader>
            <CardTitle className="text-2xl">{dict.admin.pendingOrders}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{dict.common.item}</TableHead>
                  <TableHead>{dict.common.type}</TableHead>
                  <TableHead>{dict.common.client}</TableHead>
                  <TableHead>{dict.common.status}</TableHead>
                  <TableHead>{dict.common.fee}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {pending.map((o) => {
                  const client = state.profiles.find((p) => p.id === o.client_id);
                  return (
                    <TableRow key={o.id}>
                      <TableCell className="text-base">{o.product_description}</TableCell>
                      <TableCell>
                        <Badge>{ORDER_TYPE_LABELS[o.order_type]}</Badge>
                      </TableCell>
                      <TableCell className="text-base">
                        {client?.full_name}
                        <br />
                        <span className="text-muted-foreground">{client?.phone}</span>
                      </TableCell>
                      <TableCell className="capitalize">{o.status.replaceAll("_", " ")}</TableCell>
                      <TableCell>
                        {formatDeliveryCash(o.delivery_fee_usd, o.delivery_fee_lbp)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap justify-end gap-2">
                          <Link
                            href={`/app/admin/orders/${o.id}`}
                            className="touch-target inline-flex items-center rounded-full border-2 px-4 py-1.5 text-sm font-semibold transition-colors hover:bg-muted"
                          >
                            {dict.admin.details}
                          </Link>
                          <Button
                            size="sm"
                            className="touch-target"
                            onClick={() => {
                              const err = claimOrder(o.id, user.id);
                              if (err) {
                                toast.error(err);
                                return;
                              }
                              router.push(`/app/admin/orders/${o.id}`);
                            }}
                          >
                            {dict.admin.takeOrder}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            className="touch-target"
                            onClick={() => {
                              const err = rejectOrder(o.id);
                              if (err) toast.error(err);
                              else toast.success(dict.admin.rejectedToast);
                            }}
                          >
                            {dict.admin.reject}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {pending.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">
                      {dict.admin.noPending}
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader>
            <CardTitle className="text-2xl">{dict.admin.ongoingOrders}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{dict.common.item}</TableHead>
                  <TableHead>{dict.common.type}</TableHead>
                  <TableHead>{dict.common.driver}</TableHead>
                  <TableHead>{dict.common.status}</TableHead>
                  <TableHead>{dict.common.fee}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {ongoing.map((o) => {
                  const driverId = o.long_distance_driver_id ?? o.assigned_driver_id;
                  const driver = driverId
                    ? state.profiles.find((p) => p.id === driverId)
                    : null;
                  return (
                    <TableRow key={o.id}>
                      <TableCell>{o.product_description}</TableCell>
                      <TableCell>
                        <Badge>{ORDER_TYPE_LABELS[o.order_type]}</Badge>
                      </TableCell>
                      <TableCell>
                        {driver?.full_name ?? "—"}
                        <br />
                        <span className="text-muted-foreground">{driver?.phone}</span>
                      </TableCell>
                      <TableCell className="capitalize">{o.status.replaceAll("_", " ")}</TableCell>
                      <TableCell>
                        {formatDeliveryCash(o.delivery_fee_usd, o.delivery_fee_lbp)}
                      </TableCell>
                      <TableCell className="text-end">
                        <Link
                          href={`/app/admin/orders/${o.id}`}
                          className="touch-target inline-flex items-center rounded-full border-2 px-4 py-1.5 text-sm font-semibold transition-colors hover:bg-muted"
                        >
                          {dict.admin.details}
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {ongoing.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-muted-foreground">
                      {dict.admin.noOngoing}
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader>
            <CardTitle className="text-2xl">{dict.admin.historyOrders}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{dict.common.item}</TableHead>
                  <TableHead>{dict.common.client}</TableHead>
                  <TableHead>{dict.common.status}</TableHead>
                  <TableHead>Driver cut</TableHead>
                  <TableHead>Company cut</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((o) => {
                  const client = state.profiles.find((p) => p.id === o.client_id);
                  return (
                    <TableRow key={o.id}>
                      <TableCell>{o.product_description}</TableCell>
                      <TableCell>{client?.full_name}</TableCell>
                      <TableCell className="capitalize">{o.status}</TableCell>
                      <TableCell>${o.driver_cut_usd.toFixed(2)}</TableCell>
                      <TableCell>${o.company_cut_usd.toFixed(2)}</TableCell>
                    </TableRow>
                  );
                })}
                {history.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-muted-foreground">
                      {dict.admin.noHistory}
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
