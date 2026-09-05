"use client";

import { toast } from "sonner";
import { FileText, Phone } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { DocumentAttachment } from "@/components/document-attachment";
import { ProfilePhoto } from "@/components/profile-photo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { profilePhotoUrl } from "@/lib/demo-store";
import { useStore } from "@/lib/store-context";
import { useI18n } from "@/lib/i18n";

const DOC_TYPE_ORDER = ["selfie", "id", "vehicle_registration", "driver_license"] as const;

export default function AdminDocumentsPage() {
  const { isAdmin, user } = useAuth();
  const { state, approveDocument } = useStore();
  const { dict } = useI18n();

  if (!isAdmin || !user) {
    return (
      <AppShell>
        <p className="text-easy">{dict.common.adminOnly}</p>
      </AppShell>
    );
  }

  const docLabels: Record<string, string> = {
    selfie: dict.profile.docSelfie,
    id: dict.profile.docId,
    vehicle_registration: dict.profile.docVehicle,
    driver_license: dict.profile.docLicense,
  };

  // Group documents by driver
  const driverIds = [...new Set(state.documents.map((d) => d.driver_id))];
  const driversWithDocs = driverIds.map((driverId) => {
    const profile = state.profiles.find((p) => p.id === driverId);
    const driver = state.drivers.find((d) => d.id === driverId);
    const docs = state.documents.filter((d) => d.driver_id === driverId);
    return { driverId, profile, driver, docs };
  });

  return (
    <AppShell title={dict.admin.documentsTitle}>
      <div className="flex flex-col gap-6">
        {driversWithDocs.length === 0 ? (
          <Card className="border-2">
            <CardContent className="py-10 text-center">
              <FileText className="mx-auto mb-3 size-10 text-muted-foreground" />
              <p className="text-lg text-muted-foreground">{dict.admin.noDocuments}</p>
            </CardContent>
          </Card>
        ) : (
          driversWithDocs.map(({ driverId, profile, driver, docs }) => {
            const hasPending = docs.some((d) => d.status === "pending");
            return (
              <Card key={driverId} className="border-2">
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-3">
                    <ProfilePhoto
                      src={profilePhotoUrl(state, driverId)}
                      name={profile?.full_name ?? "Driver"}
                      className="size-12"
                    />
                    <div className="min-w-0">
                      <CardTitle className="flex items-center gap-2 text-xl">
                        {profile?.full_name ?? "Unknown"}
                        {driver?.is_trusted ? (
                          <Badge variant="default" className="gap-1">
                            {dict.profile.verified}
                          </Badge>
                        ) : hasPending ? (
                          <Badge variant="secondary">{dict.admin.pendingReview}</Badge>
                        ) : null}
                      </CardTitle>
                      <p className="flex items-center gap-1.5 text-base text-muted-foreground">
                        <Phone className="size-4" />
                        {profile?.phone ?? "—"}
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-col gap-3">
                    {DOC_TYPE_ORDER.map((docType) => {
                      const doc = docs.find((d) => d.doc_type === docType);
                      if (!doc) return null;
                      return (
                        <div
                          key={doc.id}
                          className="flex flex-col gap-3 rounded-xl border p-4"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-base font-semibold">{docLabels[docType]}</p>
                            <Badge
                              variant={
                                doc.status === "approved"
                                  ? "default"
                                  : doc.status === "rejected"
                                    ? "destructive"
                                    : "secondary"
                              }
                              className="capitalize"
                            >
                              {doc.status}
                            </Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-3">
                            <DocumentAttachment
                              label={docLabels[docType]}
                              fileName={doc.file_name}
                              fileData={doc.file_data}
                              openLabel={dict.admin.openAttachment}
                              noPreview={dict.admin.noPreview}
                            />
                            <p className="text-xs text-muted-foreground">
                              {new Date(doc.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          {doc.status === "pending" ? (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="touch-target flex-1"
                                onClick={() => {
                                  approveDocument(doc.id, true);
                                  toast.success(dict.admin.docApproved);
                                }}
                              >
                                {dict.admin.approve}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="touch-target flex-1"
                                onClick={() => {
                                  approveDocument(doc.id, false);
                                  toast.message(dict.admin.docRejected);
                                }}
                              >
                                {dict.admin.rejectDoc}
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </AppShell>
  );
}
