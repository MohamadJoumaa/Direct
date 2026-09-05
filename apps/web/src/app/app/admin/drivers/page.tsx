"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, UserPlus } from "lucide-react";
import { DRIVER_TYPE_LABELS, PUBLIC_DRIVER_TYPES, type DriverType } from "@direct/shared";
import { AppShell } from "@/components/app-shell";
import { LinkButton } from "@/components/link-button";
import { ProfilePhoto } from "@/components/profile-photo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  driverPayMethod,
  driverReviewStatus,
  profilePhotoUrl,
  type DriverReviewStatus,
} from "@/lib/demo-store";
import { payMethodLabel, ReviewStatusBadge } from "./account-status";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

export default function AdminDriversPage() {
  const { isAdmin, user } = useAuth();
  const { state, addDriver, setDriverAccountAction } = useStore();
  const { dict } = useI18n();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [driverType, setDriverType] = useState<DriverType>("fast");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | DriverReviewStatus>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return state.drivers.filter((d) => {
      const p = state.profiles.find((x) => x.id === d.id);
      const status = driverReviewStatus(d);
      if (filter !== "all" && status !== filter) return false;
      if (!q) return true;
      return (
        (p?.full_name ?? "").toLowerCase().includes(q) ||
        (p?.phone ?? "").includes(q) ||
        (p?.email ?? "").toLowerCase().includes(q)
      );
    });
  }, [state.drivers, state.profiles, query, filter]);

  if (!isAdmin || !user) {
    return (
      <AppShell>
        <p className="text-easy">{dict.common.adminOnly}</p>
      </AppShell>
    );
  }

  function onAdd(e: React.FormEvent) {
    e.preventDefault();
    const err = addDriver({
      full_name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      password,
      driver_type: driverType,
    });
    if (err) {
      toast.error(err);
      return;
    }
    toast.success(dict.admin.driverAdded);
    setName("");
    setPhone("");
    setEmail("");
    setPassword("");
  }

  return (
    <AppShell title={dict.nav.drivers}>
      <div className="flex flex-col gap-6">
        <Card className="border-2">
          <CardHeader>
            <CardTitle className="text-2xl">
              <UserPlus className="me-2 inline size-6" />
              {dict.admin.addDriver}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onAdd} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="dv-name">{dict.common.name}</Label>
                <Input
                  id="dv-name"
                  className="h-11"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="dv-phone">{dict.common.phone}</Label>
                <Input
                  id="dv-phone"
                  className="h-11"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="dv-email">{dict.common.email}</Label>
                <Input
                  id="dv-email"
                  type="email"
                  className="h-11"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="dv-pass">{dict.common.password}</Label>
                <Input
                  id="dv-pass"
                  type="password"
                  className="h-11"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={6}
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label>{dict.auth.driverType}</Label>
                <Select
                  value={driverType}
                  onValueChange={(v) => setDriverType(v as DriverType)}
                  items={PUBLIC_DRIVER_TYPES.map((t) => ({
                    label: DRIVER_TYPE_LABELS[t],
                    value: t,
                  }))}
                >
                  <SelectTrigger className="h-11 w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {PUBLIC_DRIVER_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {DRIVER_TYPE_LABELS[t]}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button type="submit" size="lg" className="touch-target rounded-full px-6">
                  {dict.common.add}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader>
            <CardTitle className="heading-easy">{dict.admin.driversTitle}</CardTitle>
            <p className="text-base text-muted-foreground">{dict.admin.restrictionHint}</p>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <Input
              className="h-11 max-w-md"
              placeholder={dict.admin.searchDrivers}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label={dict.admin.searchDrivers}
            />
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["all", dict.admin.filterAll],
                  ["paid", dict.admin.statusPaid],
                  ["grace", dict.admin.statusGrace],
                  ["unpaid", dict.admin.statusUnpaid],
                  ["frozen", dict.admin.statusFrozen],
                  ["banned", dict.admin.statusBanned],
                ] as const
              ).map(([key, label]) => (
                <Button
                  key={key}
                  type="button"
                  size="sm"
                  variant={filter === key ? "default" : "outline"}
                  className="touch-target rounded-full"
                  onClick={() => setFilter(key)}
                  aria-pressed={filter === key}
                >
                  {label}
                </Button>
              ))}
            </div>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{dict.common.name}</TableHead>
                    <TableHead>{dict.common.phone}</TableHead>
                    <TableHead>{dict.common.type}</TableHead>
                    <TableHead>{dict.admin.paymentMethod}</TableHead>
                    <TableHead>{dict.admin.accountStatus}</TableHead>
                    <TableHead>{dict.profile.rating}</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                        {dict.admin.noDriversMatch}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filtered.map((d) => {
                      const p = state.profiles.find((x) => x.id === d.id);
                      const isSelf = d.id === user.id;
                      const status = driverReviewStatus(d);
                      const payMethod = driverPayMethod(state, d.id);
                      return (
                        <TableRow key={d.id}>
                          <TableCell className="font-medium">
                            <span className="inline-flex items-center gap-2">
                              <ProfilePhoto
                                src={profilePhotoUrl(state, d.id)}
                                name={p?.full_name ?? "Driver"}
                                className="size-9"
                              />
                              <span className="inline-flex items-center gap-1.5">
                                {p?.full_name}
                                {d.is_trusted ? (
                                  <ShieldCheck className="size-4 text-emerald-500" />
                                ) : null}
                              </span>
                            </span>
                          </TableCell>
                          <TableCell>{p?.phone}</TableCell>
                          <TableCell>
                            <Badge>{DRIVER_TYPE_LABELS[d.driver_type]}</Badge>
                          </TableCell>
                          <TableCell>{payMethodLabel(payMethod, dict)}</TableCell>
                          <TableCell>
                            <ReviewStatusBadge status={status} dict={dict} />
                          </TableCell>
                          <TableCell>
                            {d.rating_avg.toFixed(1)} ({d.rating_count})
                          </TableCell>
                          <TableCell className="text-end">
                            <div className="flex flex-wrap justify-end gap-2">
                              <LinkButton
                                href={`/app/admin/drivers/${d.id}`}
                                size="sm"
                                variant="outline"
                                className="touch-target rounded-full"
                              >
                                {dict.admin.openProfile}
                              </LinkButton>
                              {!isSelf && !d.banned ? (
                                d.admin_frozen ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="touch-target"
                                    onClick={() => {
                                      const err = setDriverAccountAction(d.id, "unfreeze");
                                      if (err) toast.error(err);
                                      else toast.success(dict.admin.driverUnfrozenToast);
                                    }}
                                  >
                                    {dict.admin.unfreezeDriver}
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="touch-target"
                                    onClick={() => {
                                      if (!window.confirm(dict.admin.confirmFreeze)) return;
                                      const err = setDriverAccountAction(d.id, "freeze");
                                      if (err) toast.error(err);
                                      else toast.success(dict.admin.driverFrozenToast);
                                    }}
                                  >
                                    {dict.admin.freezeDriver}
                                  </Button>
                                )
                              ) : null}
                              {!isSelf ? (
                                d.banned ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="touch-target"
                                    onClick={() => {
                                      const err = setDriverAccountAction(d.id, "unban");
                                      if (err) toast.error(err);
                                      else toast.success(dict.admin.driverUnbannedToast);
                                    }}
                                  >
                                    {dict.admin.unbanDriver}
                                  </Button>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    className="touch-target"
                                    onClick={() => {
                                      if (!window.confirm(dict.admin.confirmBan)) return;
                                      const err = setDriverAccountAction(d.id, "ban");
                                      if (err) toast.error(err);
                                      else toast.success(dict.admin.driverBannedToast);
                                    }}
                                  >
                                    {dict.admin.banDriver}
                                  </Button>
                                )
                              ) : null}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {state.documents.some((d) => d.status === "pending") ? (
          <Card className="border-2 border-amber-200 dark:border-amber-800">
            <CardContent className="flex items-center justify-between gap-3 py-4">
              <p className="text-base font-medium">
                {state.documents.filter((d) => d.status === "pending").length} document(s) pending review
              </p>
              <Button
                variant="outline"
                className="touch-target"
                onClick={() => window.location.assign("/app/admin/documents")}
              >
                Review documents
              </Button>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </AppShell>
  );
}
