import React, { useState } from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Camera, Check, Upload } from "lucide-react-native";
import { allowedDocTypes, type DocType } from "@direct/core";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, Section } from "@/components/ui/card";
import { Row, Stack } from "@/components/ui/layout";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store-context";
import { useTheme } from "@/theme/theme-context";
import { radius } from "@/theme/tokens";

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

  if (!user) return null;

  const types = allowedDocTypes(user.role);
  const labels: Record<DocType, string> = {
    selfie: dict.profile.docSelfie,
    id: dict.profile.docId,
    vehicle_registration: dict.profile.docVehicle,
    driver_license: dict.profile.docLicense,
  };

  async function pick(docType: DocType) {
    setBusy(docType);
    try {
      const permission =
        docType === "selfie"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) return;

      // A selfie is taken, not chosen from the roll: it doubles as the profile
      // photo and has to be of the person holding the phone.
      const result =
        docType === "selfie"
          ? await ImagePicker.launchCameraAsync({
              cameraType: ImagePicker.CameraType.front,
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
                    icon={
                      docType === "selfie" ? (
                        <Camera size={15} color={colors.foreground} />
                      ) : (
                        <Upload size={15} color={colors.foreground} />
                      )
                    }
                    onPress={() => void pick(docType)}
                  />
                </Stack>
              </Card>
            );
          })}
        </Stack>
      </Section>
    </Screen>
  );
}
