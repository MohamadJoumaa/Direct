"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, UserPlus } from "lucide-react";
import { DRIVER_TYPE_LABELS, PUBLIC_DRIVER_TYPES, type DriverType } from "@direct/shared";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const { state, addDriver, removeDriver } = useStore();
  const { dict } = useI18n();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [driverType, setDriverType] = useState<DriverType>("fast");

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
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{dict.common.name}</TableHead>
                  <TableHead>{dict.common.phone}</TableHead>
                  <TableHead>{dict.common.type}</TableHead>
                  <TableHead>{dict.common.online}</TableHead>
                  <TableHead>{dict.driver.subscription}</TableHead>
                  <TableHead>{dict.profile.rating}</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.drivers.map((d) => {
                  const p = state.profiles.find((x) => x.id === d.id);
                  const isSelf = d.id === user.id;
                  return (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">
                        <span className="inline-flex items-center gap-1.5">
                          {p?.full_name}
                          {d.is_trusted ? (
                            <ShieldCheck className="size-4 text-emerald-500" />
                          ) : null}
                        </span>
                      </TableCell>
                      <TableCell>{p?.phone}</TableCell>
                      <TableCell>
                        <Badge>{DRIVER_TYPE_LABELS[d.driver_type]}</Badge>
                      </TableCell>
                      <TableCell>{d.is_online ? dict.common.yes : dict.common.no}</TableCell>
                      <TableCell className="capitalize">
                        {d.subscription_status.replaceAll("_", " ")}
                      </TableCell>
                      <TableCell>
                        {d.rating_avg.toFixed(1)} ({d.rating_count})
                      </TableCell>
                      <TableCell className="text-end">
                        {!isSelf ? (
                          <Button
                            size="sm"
                            variant="destructive"
                            className="touch-target"
                            onClick={() => {
                              const err = removeDriver(d.id);
                              if (err) toast.error(err);
                              else toast.success(dict.admin.driverRemoved);
                            }}
                          >
                            {dict.admin.removeDriver}
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
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
