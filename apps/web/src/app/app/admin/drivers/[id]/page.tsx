"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Phone, ShieldCheck, Star } from "lucide-react";
import { DRIVER_TYPE_LABELS, formatDeliveryCash } from "@direct/shared";
import { AppShell } from "@/components/app-shell";
import { DocumentAttachment } from "@/components/document-attachment";
import { ProfilePhoto } from "@/components/profile-photo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import {
  driverPayMethod,
  driverReviewStatus,
  formatOrderNumber,
  profilePhotoUrl,
} from "@/lib/demo-store";
import { useStore } from "@/lib/store-context";
import { useI18n } from "@/lib/i18n";
import { payMethodLabel, ReviewStatusBadge } from "../account-status";

const DOC_TYPES = ["selfie", "id", "vehicle_registration", "driver_license"] as const;

export default function AdminDriverProfilePage() {
  const params = useParams<{ id: string }>();
  const { isAdmin, user } = useAuth();
  const { state, setDriverAccountAction } = useStore();
  const { dict } = useI18n();

  const driver = state.drivers.find((d) => d.id === params.id);
  const profile = state.profiles.find((p) => p.id === params.id);

  if (!isAdmin || !user) {
    return (
      <AppShell>
        <p className="text-easy">{dict.common.adminOnly}</p>
      </AppShell>
    );
  }

  if (!driver || !profile) {
    return (
      <AppShell title={dict.admin.driverProfile}>
        <p className="text-easy">{dict.admin.noDriversMatch}</p>
      </AppShell>
    );
  }

  const status = driverReviewStatus(driver);
  const payMethod = driverPayMethod(state, driver.id);
  const isSelf = driver.id === user.id;
  const docs = state.documents.filter((d) => d.driver_id === driver.id);
  const history = state.orders.filter(
    (o) =>
      (o.assigned_driver_id === driver.id || o.long_distance_driver_id === driver.id) &&
      ["completed", "cancelled", "disputed"].includes(o.status),
  );

  const docLabels: Record<(typeof DOC_TYPES)[number], string> = {
    selfie: dict.profile.docSelfie,
    id: dict.profile.docId,
    vehicle_registration: dict.profile.docVehicle,
    driver_license: dict.profile.docLicense,
  };

  function runAction(action: "freeze" | "unfreeze" | "ban" | "unban", confirmMsg?: string) {
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    const err = setDriverAccountAction(driver.id, action);
    if (err) {
      toast.error(err);
      return;
    }
    if (action === "freeze") toast.success(dict.admin.driverFrozenToast);
    if (action === "unfreeze") toast.success(dict.admin.driverUnfrozenToast);
    if (action === "ban") toast.success(dict.admin.driverBannedToast);
    if (action === "unban") toast.success(dict.admin.driverUnbannedToast);
  }

  return (
    <AppShell title={dict.admin.driverProfile}>
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <Link
          href="/app/admin/drivers"
          className="touch-target inline-flex w-fit items-center gap-2 text-base font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4 rtl:rotate-180" />
          {dict.admin.backToDrivers}
        </Link>

        <Card className="border-2">
          <CardContent className="flex flex-wrap items-center gap-5 pt-6">
            <ProfilePhoto
              src={profilePhotoUrl(state, profile.id)}
              name={profile.full_name}
              className="size-24 text-3xl"
            />
            <div className="min-w-0">
              <h1 className="flex items-center gap-2 truncate text-2xl font-extrabold tracking-tight">
                {profile.full_name}
                {driver.is_trusted ? (
                  <ShieldCheck
                    className="size-5 shrink-0 text-emerald-500"
                    aria-label={dict.profile.verified}
                  />
                ) : null}
              </h1>
              <p className="mt-1 flex items-center gap-1.5 text-base text-muted-foreground">
                <Phone className="size-4" />
                {profile.phone}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge className="capitalize">{DRIVER_TYPE_LABELS[driver.driver_type]}</Badge>
                <Badge variant="secondary" className="gap-1">
                  <Star className="size-3.5 fill-current" />
                  {driver.rating_avg.toFixed(1)} ({driver.rating_count} {dict.profile.reviews})
                </Badge>
                <ReviewStatusBadge status={status} dict={dict} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader>
            <CardTitle className="text-2xl">{dict.admin.driverProfile}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-lg">
            <p>
              <strong>{dict.common.email}:</strong> {profile.email}
            </p>
            <p>
              <strong>{dict.common.online}:</strong>{" "}
              {driver.is_online ? dict.common.yes : dict.common.no}
            </p>
            <p>
              <strong>{dict.admin.joined}:</strong>{" "}
              {new Date(profile.created_at).toLocaleDateString()}
            </p>
            <p>
              <strong>{dict.admin.paymentMethod}:</strong> {payMethodLabel(payMethod, dict)}
            </p>
            <p className="flex flex-wrap items-center gap-2">
              <strong>{dict.admin.accountStatus}:</strong>
              <ReviewStatusBadge status={status} dict={dict} />
            </p>
            {driver.subscription_ends_at ? (
              <p>
                <strong>{dict.driver.ends}:</strong>{" "}
                {new Date(driver.subscription_ends_at).toLocaleDateString()}
              </p>
            ) : null}
            <p className="text-base text-muted-foreground">{dict.admin.restrictionHint}</p>
            {!isSelf ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {driver.admin_frozen ? (
                  <Button
                    size="lg"
                    variant="outline"
                    className="touch-target rounded-full"
                    onClick={() => runAction("unfreeze")}
                  >
                    {dict.admin.unfreezeDriver}
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    variant="outline"
                    className="touch-target rounded-full"
                    onClick={() => runAction("freeze", dict.admin.confirmFreeze)}
                    disabled={driver.banned}
                  >
                    {dict.admin.freezeDriver}
                  </Button>
                )}
                {driver.banned ? (
                  <Button
                    size="lg"
                    variant="outline"
                    className="touch-target rounded-full"
                    onClick={() => runAction("unban")}
                  >
                    {dict.admin.unbanDriver}
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    variant="destructive"
                    className="touch-target rounded-full"
                    onClick={() => runAction("ban", dict.admin.confirmBan)}
                  >
                    {dict.admin.banDriver}
                  </Button>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader>
            <CardTitle className="text-2xl">{dict.profile.legalDocuments}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {DOC_TYPES.map((docType) => {
              const doc = docs.find((d) => d.doc_type === docType);
              return (
                <div key={docType} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
                  <div>
                    <p className="text-base font-semibold">{docLabels[docType]}</p>
                    {doc ? (
                      <Badge variant="secondary" className="mt-1 capitalize">
                        {doc.status}
                      </Badge>
                    ) : (
                      <p className="text-sm text-muted-foreground">{dict.profile.notUploaded}</p>
                    )}
                  </div>
                  {doc ? (
                    <DocumentAttachment
                      label={docLabels[docType]}
                      fileName={doc.file_name}
                      fileData={doc.file_data}
                      openLabel={dict.admin.openAttachment}
                      noPreview={dict.admin.noPreview}
                    />
                  ) : null}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card className="border-2">
          <CardHeader>
            <CardTitle className="text-2xl">{dict.admin.recentDeliveries}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {history.length === 0 ? (
              <p className="text-muted-foreground">{dict.admin.noDriverHistory}</p>
            ) : (
              history.slice(0, 8).map((o) => (
                <Link
                  key={o.id}
                  href={`/app/admin/orders/${o.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-base transition-colors hover:bg-muted"
                >
                  <span className="font-medium">
                    {formatOrderNumber(o.order_number)} · {o.product_description}
                  </span>
                  <span className="text-muted-foreground">
                    {formatDeliveryCash(o.delivery_fee_usd, o.delivery_fee_lbp)} · {o.status}
                  </span>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
