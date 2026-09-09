"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Camera, Star, ShieldCheck } from "lucide-react";
import { formatDeliveryCash, withBusinessOrderCosts, type RevenueMode } from "@direct/shared";
import { ProfilePhoto } from "@/components/profile-photo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";
import { profilePhotoUrl, driverCompanyPayMode } from "@/lib/demo-store";
import { useStore } from "@/lib/store-context";
import { useI18n, fmt } from "@/lib/i18n";
import { fileToAvatar, fileToDocumentPreview } from "@/lib/image-file";
import { locationLabel } from "@/lib/place-name";
import { cn } from "@/lib/utils";

const DOC_TYPES = ["selfie", "id", "vehicle_registration", "driver_license"] as const;

export default function ProfilePage() {
  const { user, driver } = useAuth();
  const { state, updateProfile, addDocument, setDriverRevenueMode } = useStore();
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
    driver_license: dict.profile.docLicense,
  };

  const photoUrl = profilePhotoUrl(state, user.id);

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

  function onPayPlan(mode: RevenueMode) {
    if (!driver || !user) return;
    if (driverCompanyPayMode(driver, state.settings) === mode) return;
    const err = setDriverRevenueMode(user.id, mode);
    if (err) {
      toast.error(err);
      return;
    }
    toast.success(dict.profile.payPlanSaved);
  }

  async function onAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToAvatar(file);
      if (driver) {
        addDocument(user!.id, "selfie", file.name, dataUrl);
        toast.success(dict.profile.uploadedToast);
      } else {
        const err = updateProfile(user!.id, { avatar_url: dataUrl });
        if (err) toast.error(err);
        else toast.success(dict.profile.saved);
      }
    } catch {
      toast.error("Could not read that image");
    }
    e.target.value = "";
  }

  return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <Card className="border-2">
          <CardContent className="flex flex-wrap items-center gap-5 pt-6">
            <button
              type="button"
              className="group relative size-24 shrink-0 overflow-hidden rounded-full bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              onClick={() => avatarInputRef.current?.click()}
              aria-label={dict.profile.editProfile}
            >
              <ProfilePhoto
                src={photoUrl}
                name={user.full_name}
                className="size-24 text-3xl"
              />
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
              <h1 className="flex items-center gap-2 truncate text-2xl font-extrabold tracking-tight">
                {user.full_name}
                {driver?.is_trusted ? (
                  <ShieldCheck className="size-5 shrink-0 text-emerald-500" aria-label={dict.profile.verified} />
                ) : null}
              </h1>
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
                    {user.business_address?.trim()
                      ? locationLabel(user.business_address, user.business_lat, user.business_lng)
                      : "—"}
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

        {driver ? (
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="text-2xl">{dict.profile.companyPayTitle}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-base text-muted-foreground">{dict.profile.companyPayHint}</p>
              <div
                role="radiogroup"
                aria-labelledby="pf-pay-plan"
                className="grid gap-3 sm:grid-cols-2"
              >
                <span id="pf-pay-plan" className="sr-only">
                  {dict.profile.companyPayTitle}
                </span>
                {(
                  [
                    {
                      value: "subscription" as const,
                      title: dict.profile.payPlanSubscription,
                      desc: fmt(dict.profile.payPlanSubscriptionDesc, {
                        price: `$${state.settings.subscription_price_usd}`,
                      }),
                    },
                    {
                      value: "percentage" as const,
                      title: dict.profile.payPlanPercentage,
                      desc: fmt(dict.profile.payPlanPercentageDesc, {
                        pct: state.settings.company_percentage,
                      }),
                    },
                  ] as const
                ).map((opt) => {
                  const selected = driverCompanyPayMode(driver, state.settings) === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => onPayPlan(opt.value)}
                      className={cn(
                        "touch-target flex min-h-11 flex-col items-start gap-1 rounded-xl border-2 p-4 text-start transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
                        selected ? "border-primary bg-muted" : "border-border",
                      )}
                    >
                      <span className="text-lg font-semibold">{opt.title}</span>
                      <span className="text-base text-muted-foreground">{opt.desc}</span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {driver ? (
          <Card className="border-2">
            <CardHeader>
              <CardTitle className="text-2xl">{dict.profile.legalDocuments}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-base text-muted-foreground">{dict.profile.uploadDocsOptional}</p>
              {DOC_TYPES.map((docType) => {
                const existing = state.documents.find(
                  (d) => d.driver_id === user.id && d.doc_type === docType,
                );
                return (
                  <div
                    key={docType}
                    className="flex flex-col gap-2 rounded-xl border p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold">{docLabels[docType]}</p>
                        {docType === "selfie" ? (
                          <p className="text-sm text-amber-600 dark:text-amber-400">
                            {dict.profile.selfieHint}
                          </p>
                        ) : null}
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
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            let fileData: string | undefined;
                            if (file.type.startsWith("image/")) {
                              fileData = await fileToDocumentPreview(file);
                              if (docType === "selfie") {
                                const avatar = await fileToAvatar(file);
                                updateProfile(user.id, { avatar_url: avatar });
                              }
                            }
                            addDocument(user.id, docType, file.name, fileData);
                            toast.success(dict.profile.uploadedToast);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </div>
                    {existing?.file_data ? (
                      <div className="mt-1">
                        <Image
                          src={existing.file_data}
                          alt={docLabels[docType]}
                          width={96}
                          height={96}
                          className="rounded-lg border object-cover"
                          unoptimized
                        />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        ) : null}
      </div>
  );
}
