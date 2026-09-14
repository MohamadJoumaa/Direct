import React, { useState } from "react";
import { View } from "react-native";
import { Image } from "expo-image";
import type { DocType } from "@direct/core";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { SegmentedControl } from "@/components/ui/field";
import { Row, Stack } from "@/components/ui/layout";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store-context";
import { useTheme } from "@/theme/theme-context";
import { radius } from "@/theme/tokens";

type Filter = "pending" | "approved" | "rejected";

/**
 * Document review.
 *
 * Approving the last required type is what flips the account to trusted and
 * sends the single `docs_approved` notification — the store does that, so all
 * this screen owns is the decision.
 */
export default function AdminDocuments() {
  const { dict } = useI18n();
  const { colors } = useTheme();
  const { state, approveDocument } = useStore();
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>("pending");

  const labels: Record<DocType, string> = {
    selfie: dict.profile.docSelfie,
    id: dict.profile.docId,
    vehicle_registration: dict.profile.docVehicle,
    driver_license: dict.profile.docLicense,
  };

  const docs = state.documents.filter((d) => d.status === filter);

  return (
    <Screen>
      <SegmentedControl<Filter>
        value={filter}
        onChange={setFilter}
        options={[
          { value: "pending", label: dict.docStatus.pending },
          { value: "approved", label: dict.docStatus.approved },
          { value: "rejected", label: dict.docStatus.rejected },
        ]}
      />

      {docs.length === 0 ? (
        <EmptyState title={dict.admin.noDocuments} />
      ) : (
        <Stack gap="sm">
          {docs.map((doc) => {
            const owner = state.profiles.find((p) => p.id === doc.driver_id);
            return (
              <Card key={doc.id}>
                <Stack gap="sm">
                  <Row gap="sm" justify="space-between">
                    <Stack gap={2} flex={1}>
                      <Text variant="callout" weight="semibold" numberOfLines={1}>
                        {owner?.full_name ?? doc.driver_id}
                      </Text>
                      <Text variant="caption" color="mutedForeground">
                        {labels[doc.doc_type]} · {owner ? dict.roles[owner.role] : ""}
                      </Text>
                    </Stack>
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
                  </Row>

                  {doc.file_data ? (
                    <View
                      style={{
                        height: 200,
                        borderRadius: radius.lg,
                        overflow: "hidden",
                        backgroundColor: colors.muted,
                      }}
                    >
                      <Image
                        source={{ uri: doc.file_data }}
                        style={{ width: "100%", height: "100%" }}
                        contentFit="contain"
                      />
                    </View>
                  ) : (
                    <Text variant="caption" color="mutedForeground">
                      {dict.admin.noPreview}
                    </Text>
                  )}

                  {doc.status === "pending" ? (
                    <Row gap="sm">
                      <Button
                        title={dict.admin.rejectDoc}
                        variant="outline"
                        size="sm"
                        style={{ flex: 1 }}
                        onPress={() => {
                          approveDocument(doc.id, false);
                          toast.info(dict.admin.docRejected);
                        }}
                      />
                      <Button
                        title={dict.admin.approve}
                        size="sm"
                        style={{ flex: 1 }}
                        onPress={() => {
                          approveDocument(doc.id, true);
                          toast.success(dict.admin.docApproved);
                        }}
                      />
                    </Row>
                  ) : null}
                </Stack>
              </Card>
            );
          })}
        </Stack>
      )}
    </Screen>
  );
}
