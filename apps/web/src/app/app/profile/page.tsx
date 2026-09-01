"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Camera, Star } from "lucide-react";
import { formatDeliveryCash, withBusinessOrderCosts } from "@direct/shared";
import { AppShell } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";
import { useStore } from "@/lib/store-context";
import { useI18n } from "@/lib/i18n";

const DOC_TYPES = ["selfie", "id", "vehicle_registration"] as const;

/** Downscale the chosen image so the demo store stays small. */
function fileToAvatar(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      const size = 128;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("no canvas"));
      const min = Math.min(img.width, img.height);
      ctx.drawImage(
        img,
        (img.width - min) / 2,
        (img.height - min) / 2,
        min,
        min,
        0,
        0,
        size,
        size,
      );
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = reject;
    img.src = url;
  });
}

export default function ProfilePage() {
  const { user, driver } = useAuth();
  const { state, updateProfile, addDocument } = useStore();
  const { dict } = useI18n();
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [businessName, setBusinessName] = useState(user?.business_name ?? "");

  if (!user) return null;

  const orderCosts = user.role === "business" ? withBusinessOrderCosts(user) : null;

  const docLabels: Record<(typeof DOC_TYPES)[number], string> = {
    selfie: dict.profile.docSelfie,
    id: dict.profile.docId,
    vehicle_registration: dict.profile.docVehicle,
  };

  const initials = user.full_name
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  function onSave(e: React.FormEvent) {
    e.preventDefault();
    const err = updateProfile(user!.id, {
      full_name: fullName.trim(),
      phone: phone.trim(),
      email: email.trim(),
      ...(user!.role === "business" ? { business_name: businessName.trim() } : {}),
    });
    if (err) {
      toast.error(err);
      return;
    }
    toast.success(dict.profile.saved);
  }

  async function onAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToAvatar(file);
      const err = updateProfile(user!.id, { avatar_url: dataUrl });
      if (err) toast.error(err);
      else toast.success(dict.profile.saved);
    } catch {
      toast.error("Could not read that image");
    }
    e.target.value = "";
  }

  return (
    <AppShell title={dict.profile.title}>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <Card className="border-2">
          <CardContent className="flex flex-wrap items-center gap-5 pt-6">
            <button
              type="button"
              className="group relative size-24 shrink-0 overflow-hidden rounded-full bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              onClick={() => avatarInputRef.current?.click()}
              aria-label={dict.profile.editProfile}
            >
              {user.avatar_url ? (
                <Image
                  src={user.avatar_url}
                  alt=""
                  fill
                  sizes="96px"
                  className="object-cover"
                  unoptimized
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-3xl font-bold text-muted-foreground">
                  {initials}
                </span>
              )}
              <span className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                <Camera className="size-6 text-white" />
              </span>
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={onAvatarChange}
            />
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-extrabold tracking-tight">{user.full_name}</h1>
              <p className="text-base capitalize text-muted-foreground">{user.role}</p>
              {driver ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge className="capitalize">{driver.driver_type.replaceAll("_", " ")}</Badge>
                  <Badge variant="secondary" className="gap-1">
                    <Star className="size-3.5 fill-current" />
                    {driver.rating_avg.toFixed(1)} ({driver.rating_count} {dict.profile.reviews})
                  </Badge>
                  {driver.is_trusted ? (
                    <Badge variant="outline">{dict.profile.trustedDriver}</Badge>
                  ) : null}
                </div>
              ) : null}
            </div>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader>
            <CardTitle className="text-2xl">{dict.profile.editProfile}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSave} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="pf-name" className="text-base">
                  {dict.common.name}
                </Label>
                <Input
                  id="pf-name"
                  className="h-12 text-lg"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
              {user.role === "business" ? (
                <div className="flex flex-col gap-2">
                  <Label htmlFor="pf-biz" className="text-base">
                    {dict.auth.businessName}
                  </Label>
                  <Input
                    id="pf-biz"
                    className="h-12 text-lg"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                  />
                </div>
              ) : null}
              {user.role === "business" ? (
                <div className="flex flex-col gap-2">
                  <Label className="text-base">{dict.profile.shopLocation}</Label>
                  <p className="text-base text-muted-foreground">
                    {user.business_address?.trim() || "—"}
                  </p>
                  <p className="text-sm text-muted-foreground">{dict.profile.shopLocationReadonly}</p>
                </div>
              ) : null}
              {orderCosts ? (
                <div className="flex flex-col gap-2">
                  <Label className="text-base">{dict.profile.orderCosts}</Label>
                  <p className="text-base font-medium">
                    {formatDeliveryCash(orderCosts.order_min_usd, orderCosts.order_min_lbp)}
                    {" – "}
                    {formatDeliveryCash(orderCosts.order_max_usd, orderCosts.order_max_lbp)}
                  </p>
                  <p className="text-sm text-muted-foreground">{dict.profile.orderCostsReadonly}</p>
                </div>
              ) : null}
              <div className="flex flex-col gap-2">
                <Label htmlFor="pf-phone" className="text-base">
                  {dict.common.phone}
                </Label>
                <Input
                  id="pf-phone"
                  className="h-12 text-lg"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="pf-email" className="text-base">
                  {dict.common.email}
                </Label>
                <Input
                  id="pf-email"
                  type="email"
                  className="h-12 text-lg"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                />
              </div>
              <Button
                type="submit"
                size="lg"
                className="touch-target mt-1 w-fit rounded-full px-6"
              >
                {dict.common.save}
              </Button>
            </form>
          </CardContent>
        </Card>

        {driver && !driver.is_trusted ? (
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="text-2xl">{dict.profile.becomeTrusted}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-easy text-muted-foreground">{dict.profile.uploadDocsNote}</p>
              {DOC_TYPES.map((docType) => {
                const existing = state.documents.find(
                  (d) => d.driver_id === user.id && d.doc_type === docType,
                );
                return (
                  <div
                    key={docType}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"
                  >
                    <div>
                      <p className="text-lg font-semibold">{docLabels[docType]}</p>
                      {existing ? (
                        <Badge variant="secondary" className="mt-1 capitalize">
                          {existing.status}: {existing.file_name}
                        </Badge>
                      ) : (
                        <p className="text-base text-muted-foreground">
                          {dict.profile.notUploaded}
                        </p>
                      )}
                    </div>
                    <label className="touch-target inline-flex h-11 cursor-pointer items-center rounded-full bg-primary px-5 text-base font-semibold text-primary-foreground transition-opacity hover:opacity-90 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring">
                      {dict.profile.upload}
                      <input
                        type="file"
                        accept="image/*,.pdf"
                        className="sr-only"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          addDocument(user.id, docType, file.name);
                          toast.success(dict.profile.uploadedToast);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </AppShell>
  );
}
