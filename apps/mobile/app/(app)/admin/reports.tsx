import React, { useState } from "react";
import { formatOrderNumber } from "@direct/core";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { SegmentedControl } from "@/components/ui/field";
import { Divider, Row, Stack } from "@/components/ui/layout";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store-context";

type Filter = "open" | "upheld" | "dismissed";

/**
 * Client reports raised by drivers.
 *
 * Upholding one splits that order 50/50 — `resolveReport` owns that rule; here
 * an admin only decides which way it goes.
 */
export default function AdminReports() {
  const { dict } = useI18n();
  const { state, resolveReport } = useStore();
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>("open");

  const reports = state.reports
    .filter((r) => r.status === filter)
    .toSorted((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <Screen>
      <SegmentedControl<Filter>
        value={filter}
        onChange={setFilter}
        options={[
          { value: "open", label: dict.admin.pendingReview },
          { value: "upheld", label: dict.admin.approve },
          { value: "dismissed", label: dict.admin.rejectDoc },
        ]}
      />

      {reports.length === 0 ? (
        <EmptyState title={dict.nav.reports} />
      ) : (
        <Stack gap="sm">
          {reports.map((report) => {
            const order = state.orders.find((o) => o.id === report.order_id);
            const reporter = state.profiles.find((p) => p.id === report.reporter_id);
            return (
              <Card key={report.id}>
                <Stack gap="sm">
                  <Row gap="sm" justify="space-between">
                    <Text variant="callout" weight="semibold" numeric>
                      {order ? formatOrderNumber(order.order_number) : report.order_id}
                    </Text>
                    <Badge
                      label={report.status}
                      tone={
                        report.status === "open"
                          ? "warning"
                          : report.status === "upheld"
                            ? "destructive"
                            : "secondary"
                      }
                    />
                  </Row>

                  <Text variant="caption" color="mutedForeground">
                    {reporter?.full_name ?? report.reporter_id}
                  </Text>

                  <Divider />

                  <Text variant="callout">{report.reason}</Text>

                  {report.status === "open" ? (
                    <Row gap="sm">
                      <Button
                        title={dict.admin.rejectDoc}
                        variant="outline"
                        size="sm"
                        style={{ flex: 1 }}
                        onPress={() => {
                          resolveReport(report.id, false);
                          toast.info(dict.admin.docRejected);
                        }}
                      />
                      <Button
                        title={dict.admin.approve}
                        size="sm"
                        style={{ flex: 1 }}
                        onPress={() => {
                          resolveReport(report.id, true);
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
