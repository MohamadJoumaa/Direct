import React, { useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { Plus, Search, ShieldCheck, Star } from "lucide-react-native";
import { DRIVER_TYPE_LABELS, PUBLIC_DRIVER_TYPES, type DriverType } from "@direct/shared";
import { driverPayMethod, driverReviewStatus, type DriverReviewStatus } from "@direct/core";

import { AppHeader } from "@/components/app-header";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Card, EmptyState } from "@/components/ui/card";
import { Field, OptionGroup, SegmentedControl } from "@/components/ui/field";
import { Row, Stack } from "@/components/ui/layout";
import { Screen } from "@/components/ui/screen";
import { Sheet } from "@/components/ui/sheet";
import { Text } from "@/components/ui/text";
import { useToast } from "@/components/ui/toast";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store-context";
import { useTheme } from "@/theme/theme-context";

type Filter = "all" | "online" | "restricted";

const STATUS_TONE: Record<DriverReviewStatus, BadgeTone> = {
  paid: "success",
  grace: "warning",
  frozen: "destructive",
  banned: "destructive",
  unpaid: "warning",
  waived: "brand",
};

/** Admin drivers directory. */
export default function AdminDrivers() {
  const { dict } = useI18n();
  const { colors } = useTheme();
  const { state, refreshFromStorage } = useStore();
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [addOpen, setAddOpen] = useState(false);

  const statusLabel: Record<DriverReviewStatus, string> = {
    paid: dict.admin.statusPaid,
    grace: dict.admin.statusGrace,
    frozen: dict.admin.statusFrozen,
    banned: dict.admin.statusBanned,
    unpaid: dict.admin.statusUnpaid,
    waived: dict.admin.statusWaived,
  };

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return state.drivers
      .map((driver) => ({
        driver,
        profile: state.profiles.find((p) => p.id === driver.id),
        status: driverReviewStatus(driver, state),
      }))
      // An admin's synthetic `owner` row is scaffolding, not a driver to manage.
      .filter((row) => row.profile && row.profile.role === "driver")
      .filter((row) => {
        if (filter === "online") return row.driver.is_online;
        if (filter === "restricted") {
          return row.driver.admin_frozen || row.driver.banned || row.status === "frozen";
        }
        return true;
      })
      .filter((row) => {
        if (!needle) return true;
        return `${row.profile?.full_name ?? ""} ${row.profile?.phone ?? ""}`
          .toLowerCase()
          .includes(needle);
      });
  }, [state, query, filter]);

  return (
    <>
      <AppHeader
        title={dict.admin.driversTitle}
        action={
          <IconButton accessibilityLabel={dict.admin.addDriver} onPress={() => setAddOpen(true)}>
            <Plus size={20} color={colors.foreground} />
          </IconButton>
        }
      />
      <Screen onRefresh={refreshFromStorage}>
        <SegmentedControl<Filter>
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: dict.admin.filterAll },
            { value: "online", label: dict.common.online },
            { value: "restricted", label: dict.admin.statusFrozen },
          ]}
        />

        <Field
          value={query}
          onChangeText={setQuery}
          placeholder={dict.admin.searchDrivers}
          autoCapitalize="none"
          autoCorrect={false}
          prefix={<Search size={18} color={colors.mutedForeground} />}
        />

        {rows.length === 0 ? (
          <EmptyState title={dict.admin.noDriversMatch} />
        ) : (
          <Stack gap="sm">
            {rows.map(({ driver, profile, status }) => (
              <Card
                key={driver.id}
                onPress={() => router.push(`/admin/drivers/${driver.id}`)}
                accessibilityLabel={profile?.full_name}
              >
                <Stack gap="sm">
                  <Row gap="sm" justify="space-between">
                    <Stack gap={2} flex={1}>
                      <Row gap="xs">
                        <Text variant="subheading" weight="semibold" numberOfLines={1}>
                          {profile?.full_name}
                        </Text>
                        {driver.is_trusted ? (
                          <ShieldCheck size={15} color={colors.brand} />
                        ) : null}
                      </Row>
                      <Text variant="caption" color="mutedForeground" numeric>
                        {profile?.phone} · {DRIVER_TYPE_LABELS[driver.driver_type]}
                      </Text>
                    </Stack>
                    <Badge label={statusLabel[status]} tone={STATUS_TONE[status]} />
                  </Row>

                  <Row gap="sm" justify="space-between">
                    <Row gap="xs">
                      <Star size={13} color={colors.gold} fill={colors.gold} />
                      <Text variant="caption" numeric color="mutedForeground">
                        {driver.rating_avg.toFixed(1)} ({driver.rating_count})
                      </Text>
                    </Row>
                    <Row gap="xs">
                      <Badge
                        label={driver.is_online ? dict.common.online : dict.common.offline}
                        tone={driver.is_online ? "success" : "secondary"}
                      />
                      <Badge
                        label={
                          {
                            whish: dict.admin.payWhish,
                            whish_manual: dict.admin.payWhishManual,
                            none: dict.admin.payNone,
                          }[driverPayMethod(state, driver.id)]
                        }
                        tone="secondary"
                      />
                    </Row>
                  </Row>
                </Stack>
              </Card>
            ))}
          </Stack>
        )}

        <Text variant="caption" color="mutedForeground">
          {dict.admin.restrictionHint}
        </Text>
      </Screen>

      <AddDriverSheet open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  );
}

function AddDriverSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { dict } = useI18n();
  const { addDriver } = useStore();
  const toast = useToast();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [driverType, setDriverType] = useState<DriverType>("fast");

  function submit() {
    const error = addDriver({
      full_name: fullName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      password,
      driver_type: driverType,
    });
    if (error) {
      toast.error(error);
      return;
    }
    toast.success(dict.admin.driverAdded);
    setFullName("");
    setEmail("");
    setPhone("");
    setPassword("");
    onClose();
  }

  const canSubmit = fullName.trim() && email.trim() && phone.trim() && password;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={dict.admin.addDriver}
      footer={
        <Button title={dict.common.add} size="lg" disabled={!canSubmit} onPress={submit} />
      }
    >
      <Field label={dict.auth.fullName} value={fullName} onChangeText={setFullName} />
      <Field
        label={dict.common.email}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <Field
        label={dict.common.phone}
        value={phone}
        onChangeText={setPhone}
        keyboardType="phone-pad"
      />
      <Field
        label={dict.common.password}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
      />
      {/* Admins can assign any public type; registration only offers two. */}
      <OptionGroup<DriverType>
        label={dict.auth.driverType}
        value={driverType}
        onChange={setDriverType}
        options={PUBLIC_DRIVER_TYPES.map((type) => ({
          value: type,
          label: DRIVER_TYPE_LABELS[type],
        }))}
      />
    </Sheet>
  );
}
