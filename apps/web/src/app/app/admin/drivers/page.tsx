"use client";

import { useState } from "react";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
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
  const { state, approveDocument, addDriver, removeDriver } = useStore();
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
                      <TableCell className="font-medium">{p?.full_name}</TableCell>
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

        <Card className="border-2">
          <CardHeader>
            <CardTitle className="text-2xl">Trusted documents</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {state.documents.length === 0 ? (
              <p className="text-muted-foreground">No uploads yet.</p>
            ) : (
              state.documents.map((doc) => {
                const p = state.profiles.find((x) => x.id === doc.driver_id);
                return (
                  <div
                    key={doc.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
                  >
                    <div>
                      <p className="text-lg font-semibold">
                        {p?.full_name} — {doc.doc_type}
                      </p>
                      <p className="text-base text-muted-foreground">
                        {doc.file_name} · {doc.status}
                      </p>
                    </div>
                    {doc.status === "pending" ? (
                      <div className="flex gap-2">
                        <Button
                          size="lg"
                          className="touch-target"
                          onClick={() => {
                            approveDocument(doc.id, true);
                            toast.success("Approved");
                          }}
                        >
                          Approve
                        </Button>
                        <Button
                          size="lg"
                          variant="outline"
                          className="touch-target"
                          onClick={() => {
                            approveDocument(doc.id, false);
                            toast.message("Rejected");
                          }}
                        >
                          Reject
                        </Button>
                      </div>
                    ) : (
                      <Badge className="capitalize">{doc.status}</Badge>
                    )}
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
