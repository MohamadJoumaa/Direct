"use client";

import { toast } from "sonner";
import { FileText, Phone } from "lucide-react";
import { DocumentAttachment } from "@/components/document-attachment";
import { ProfilePhoto } from "@/components/profile-photo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth-context";
import { allowedDocTypes, profilePhotoUrl } from "@/lib/demo-store";
import { useStore } from "@/lib/store-context";
import { useI18n } from "@/lib/i18n";

export default function AdminDocumentsPage() {
  const { isAdmin, user } = useAuth();
  const { state, approveDocument } = useStore();
  const { dict } = useI18n();

  if (!isAdmin || !user) {
    return (
        <p className="text-easy">{dict.common.adminOnly}</p>
    );
  }

  const docLabels: Record<string, string> = {
    selfie: dict.profile.docSelfie,
    id: dict.profile.docId,
    vehicle_registration: dict.profile.docVehicle,
    driver_license: dict.profile.docLicense,
  };

  // Group documents by the account that uploaded them — drivers, but also
  // clients and businesses, who submit a selfie and an ID.
  const ownerIds = [...new Set(state.documents.map((d) => d.driver_id))];
  const accountsWithDocs = ownerIds.map((ownerId) => {
    const profile = state.profiles.find((p) => p.id === ownerId);
    const docs = state.documents.filter((d) => d.driver_id === ownerId);
    const required = allowedDocTypes(profile?.role);
    const verified = required.every((t) =>
      docs.some((d) => d.doc_type === t && d.status === "approved"),
    );
    return { ownerId, profile, docs, required, verified };
  });

  return (
      <div className="flex flex-col gap-6">
        {accountsWithDocs.length === 0 ? (
          <Card className="border-2">
            <CardContent className="py-10 text-center">
              <FileText className="mx-auto mb-3 size-10 text-muted-foreground" />
              <p className="text-lg text-muted-foreground">{dict.admin.noDocuments}</p>
            </CardContent>
          </Card>
        ) : (
          accountsWithDocs.map(({ ownerId, profile, docs, required, verified }) => {
            const hasPending = docs.some((d) => d.status === "pending");
            return (
              <Card key={ownerId} className="border-2">
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-3">
                    <ProfilePhoto
                      src={profilePhotoUrl(state, ownerId)}
                      name={profile?.full_name ?? "—"}
                      className="size-12"
                    />
                    <div className="min-w-0">
                      <CardTitle className="flex flex-wrap items-center gap-2 text-xl">
                        {profile?.full_name ?? "Unknown"}
                        {profile ? (
                          <Badge variant="outline">{dict.roles[profile.role]}</Badge>
                        ) : null}
                        {verified ? (
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
                    {required.map((docType) => {
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
                            >
                              {dict.docStatus[doc.status]}
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
  );
}
