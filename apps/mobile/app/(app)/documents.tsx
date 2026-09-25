import React, { useState } from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Camera, Check, Images, Upload } from "lucide-react-native";
import { allowedDocTypes, type DocType } from "@direct/core";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, Section } from "@/components/ui/card";
import { Row, Stack } from "@/components/ui/layout";
import { Screen } from "@/components/ui/screen";
import { Sheet } from "@/components/ui/sheet";
import { Text } from "@/components/ui/text";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store-context";
import { useTheme } from "@/theme/theme-context";
import { radius } from "@/theme/tokens";

/** Where the image comes from. The driver picks; neither is privileged. */
type PickSource = "camera" | "library";

/**
 * Identity documents.
 *
 * Which types are asked for comes from `allowedDocTypes`: drivers need four,
 * clients and businesses only a selfie and an ID. When every required type is
 * approved the account becomes trusted and gets one notification -- all of that
 * is the store's job, not this screen's.
 */
export default function Documents() {
  const { dict } = useI18n();
  const { colors } = useTheme();
  const { user, driver } = useAuth();
  const { state, addDocument } = useStore();
  const toast = useToast();
  const [busy, setBusy] = useState<DocType | null>(null);
  /** Which document the source sheet is open for, if any. */
  const [choosing, setChoosing] = useState<DocType | null>(null);

  if (!user) return null;

  const types = allowedDocTypes(user.role);
  const labels: Record<DocType, string> = {
    selfie: dict.profile.docSelfie,
    id: dict.profile.docId,
    vehicle_registration: dict.profile.docVehicle,
    driver_license: dict.profile.docLicense,
  };

  /**
   * Take or choose one document image.
   *
   * Every type accepts both sources, the selfie included. Forcing the camera
   * there was meant to keep the photo honest, but it does not: a camera can be
   * pointed at a printed photo just as easily. What it did do was lock out the
   * drivers who already have a usable photo, the ones on a phone whose camera
   * permission is denied at the OS level, and anyone re-uploading after a
   * rejection. Verification is the admin's review, not the capture method.
   */
  async function pick(docType: DocType, source: PickSource) {
    setChoosing(null);
    setBusy(docType);
    try {
      const permission =
        source === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        // Say which permission is missing and that the other source still
        // works — a silent return reads as a broken button.
        toast.error(
          source === "camera" ? dict.profile.cameraDenied : dict.profile.galleryDenied,
        );
        return;
      }

      const result =
        source === "camera"
          ? await ImagePicker.launchCameraAsync({
              // A selfie is of the person holding the phone, so open the front
              // lens for it; every other document is photographed with the back.
              cameraType:
                docType === "selfie"
                  ? ImagePicker.CameraType.front
                  : ImagePicker.CameraType.back,
              quality: 0.6,
              base64: true,
            })
          : await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ["images"],
              quality: 0.6,
              base64: true,
            });

      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const dataUrl = asset.base64
        ? `data:${asset.mimeType ?? "image/jpeg"};base64,${asset.base64}`
        : undefined;

      const error = addDocument(
        user!.id,
        docType,
        asset.fileName ?? `${docType}.jpg`,
        dataUrl,
      );
      if (error) toast.error(error);
      else toast.success(dict.profile.uploadedToast);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <Screen>
        <Text variant="callout" color="mutedForeground">
          {user.role === "driver"
            ? dict.profile.uploadDocsOptional
            : dict.profile.uploadCustomerDocs}
        </Text>

        {driver?.is_trusted ? (
          <Card>
            <Row gap="sm">
              <Check size={18} color={colors.success} />
              <Text variant="callout" weight="semibold" color="success" style={{ flex: 1 }}>
                {dict.profile.verified}
              </Text>
            </Row>
          </Card>
        ) : null}

        <Section title={dict.profile.identityDocuments}>
          <Stack gap="sm">
            {types.map((docType) => {
              const doc = state.documents.find(
                (d) => d.driver_id === user.id && d.doc_type === docType,
              );
              return (
                <Card key={docType}>
                  <Stack gap="sm">
                    <Row gap="sm" justify="space-between">
                      <Text variant="callout" weight="semibold" style={{ flex: 1 }}>
                        {labels[docType]}
                      </Text>
                      {doc ? (
                        <Badge
                          label={dict.docStatus[doc.status]}
                          tone={
                            doc.status === "approved"
                              ? "success"
                              : doc.status === "rejected"
                                ? "destructive"
                                : "warning"
                          }
                        />
                      ) : (
                        <Badge label={dict.profile.notUploaded} tone="secondary" />
                      )}
                    </Row>

                    {doc?.file_data ? (
                      <View
                        style={{
                          height: 140,
                          borderRadius: radius.lg,
                          overflow: "hidden",
                          backgroundColor: colors.muted,
                        }}
                      >
                        <Image
                          source={{ uri: doc.file_data }}
                          style={{ width: "100%", height: "100%" }}
                          contentFit="cover"
                        />
                      </View>
                    ) : null}

                    {docType === "selfie" ? (
                      <Text variant="caption" color="mutedForeground">
                        {dict.profile.selfieHint}
                      </Text>
                    ) : null}

                    <Button
                      title={dict.profile.upload}
                      variant="outline"
                      size="sm"
                      full
                      loading={busy === docType}
                      icon={<Upload size={15} color={colors.foreground} />}
                      onPress={() => setChoosing(docType)}
                    />
                  </Stack>
                </Card>
              );
            })}
          </Stack>
        </Section>
      </Screen>

      {/* Bottom sheet rather than a centred Alert: this is a choice, and the
          bottom of the screen is the one-handed region (MASTER.md). */}
      <Sheet
        open={choosing !== null}
        onClose={() => setChoosing(null)}
        title={choosing ? labels[choosing] : dict.profile.docSource}
        subtitle={dict.profile.docSourceHint}
        footer={
          <Button
            title={dict.common.cancel}
            variant="ghost"
            size="md"
            full
            onPress={() => setChoosing(null)}
          />
        }
      >
        <Stack gap="sm">
          <Button
            title={dict.profile.takePhoto}
            size="lg"
            icon={<Camera size={16} color={colors.primaryForeground} />}
            onPress={() => {
              if (choosing) void pick(choosing, "camera");
            }}
          />
          <Button
            title={dict.profile.chooseFromGallery}
            size="lg"
            variant="outline"
            icon={<Images size={16} color={colors.foreground} />}
            onPress={() => {
              if (choosing) void pick(choosing, "library");
            }}
          />
        </Stack>
      </Sheet>
    </>
  );
}
