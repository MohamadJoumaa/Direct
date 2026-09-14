import React, { useState } from "react";
import { Trash2, UserPlus } from "lucide-react-native";
import type { CompanySettings } from "@direct/shared";
import { adminProfiles, isProtectedAdmin } from "@direct/core";

import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Card, Section } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Divider, Row, Stack } from "@/components/ui/layout";
import { Screen } from "@/components/ui/screen";
import { Sheet } from "@/components/ui/sheet";
import { Text } from "@/components/ui/text";
import { useToast } from "@/components/ui/toast";
import { fmt, useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store-context";
import { useTheme } from "@/theme/theme-context";

type NumericKey = Exclude<keyof CompanySettings, "revenue_mode" | "whish_number">;

/** Groups of tunables, in the order an admin actually reasons about them. */
const GROUPS: { title: string; keys: NumericKey[] }[] = [
  {
    title: "Fares",
    keys: ["fare_min_km", "fare_max_km", "fare_min_usd", "fare_max_usd", "fare_min_lbp", "fare_max_lbp"],
  },
  {
    title: "Multipliers",
    keys: [
      "multiplier_normal",
      "multiplier_long_distance",
      "multiplier_trusted",
      "multiplier_private",
      "multiplier_owner",
      "multiplier_medical",
    ],
  },
  {
    title: "Night",
    keys: ["night_surcharge_usd", "night_surcharge_lbp"],
  },
  {
    title: "Company pay",
    keys: [
      "subscription_price_usd",
      "subscription_daily_price_usd",
      "grace_days",
      "freeze_penalty_usd",
      "company_percentage",
    ],
  },
  {
    title: "Dispatch",
    keys: [
      "max_active_orders",
      "nearby_radius_km",
      "dispatch_initial_radius_km",
      "dispatch_radius_growth",
      "dispatch_offer_timeout_sec",
    ],
  },
];

/**
 * Company settings.
 *
 * Everything here feeds the shared pricing and dispatch rules directly, so the
 * fields are typed as free text and committed on save rather than on every
 * keystroke — a half-typed "0.5" must never briefly become a live multiplier.
 */
export default function AdminSettings() {
  const { dict } = useI18n();
  const { colors } = useTheme();
  const { state, updateSettings, removeAdmin } = useStore();
  const toast = useToast();

  const [draft, setDraft] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(state.settings).map(([key, value]) => [key, String(value)]),
    ),
  );
  const [addAdminOpen, setAddAdminOpen] = useState(false);

  function save() {
    const patch: Partial<CompanySettings> = {};
    for (const group of GROUPS) {
      for (const key of group.keys) {
        const parsed = Number(draft[key]);
        if (!Number.isFinite(parsed) || parsed < 0) {
          toast.error(`${key}: ${dict.order.priceInvalid}`);
          return;
        }
        (patch as Record<string, number>)[key] = parsed;
      }
    }
    patch.whish_number = draft.whish_number ?? state.settings.whish_number;
    updateSettings(patch);
    toast.success(dict.profile.saved);
  }

  const admins = adminProfiles(state);

  return (
    <>
      <Screen footer={<Button title={dict.common.save} size="lg" onPress={save} />}>
        {GROUPS.map((group) => (
          <Section key={group.title} title={group.title}>
            <Card>
              <Stack gap="md">
                {group.keys.map((key) => (
                  <Field
                    key={key}
                    label={key.replaceAll("_", " ")}
                    value={draft[key] ?? ""}
                    onChangeText={(value) => setDraft((prev) => ({ ...prev, [key]: value }))}
                    keyboardType="decimal-pad"
                  />
                ))}
              </Stack>
            </Card>
          </Section>
        ))}

        <Section title="Whish">
          <Card>
            <Field
              label={dict.common.phone}
              value={draft.whish_number ?? ""}
              onChangeText={(value) => setDraft((prev) => ({ ...prev, whish_number: value }))}
              keyboardType="phone-pad"
              hint={fmt(dict.driver.whishSupportNumber, {
                number: draft.whish_number ?? state.settings.whish_number,
              })}
            />
          </Card>
        </Section>

        <Section
          title={dict.admin.adminsTitle}
          subtitle={dict.admin.adminsHint}
          action={
            <IconButton
              accessibilityLabel={dict.admin.addAdminAction}
              onPress={() => setAddAdminOpen(true)}
            >
              <UserPlus size={20} color={colors.foreground} />
            </IconButton>
          }
        >
          <Card>
            <Stack gap="sm">
              {admins.map((admin, index) => {
                const protectedAdmin = isProtectedAdmin(admin);
                return (
                  <Stack key={admin.id} gap="sm">
                    <Row gap="sm" justify="space-between">
                      <Stack gap={2} flex={1}>
                        <Text variant="callout" weight="semibold" numberOfLines={1}>
                          {admin.full_name}
                        </Text>
                        <Text variant="caption" color="mutedForeground" numeric>
                          {admin.phone}
                        </Text>
                      </Stack>
                      {protectedAdmin ? (
                        <Badge label={dict.admin.mainAdmin} tone="brand" />
                      ) : (
                        <IconButton
                          accessibilityLabel={dict.common.remove}
                          onPress={() => {
                            const error = removeAdmin(admin.id);
                            if (error) toast.error(error);
                            else toast.success(dict.admin.adminRemoved);
                          }}
                        >
                          <Trash2 size={18} color={colors.destructive} />
                        </IconButton>
                      )}
                    </Row>
                    {index < admins.length - 1 ? <Divider /> : null}
                  </Stack>
                );
              })}
              <Text variant="caption" color="mutedForeground">
                {fmt(dict.admin.mainAdminHint, { number: state.settings.whish_number })}
              </Text>
            </Stack>
          </Card>
        </Section>
      </Screen>

      <AddAdminSheet open={addAdminOpen} onClose={() => setAddAdminOpen(false)} />
    </>
  );
}

function AddAdminSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { dict } = useI18n();
  const { addAdmin } = useStore();
  const toast = useToast();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  function submit() {
    const error = addAdmin({
      full_name: fullName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      password,
    });
    if (error) {
      toast.error(error);
      return;
    }
    toast.success(dict.admin.adminAdded);
    setFullName("");
    setEmail("");
    setPhone("");
    setPassword("");
    onClose();
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={dict.admin.addAdminAction}
      subtitle={dict.admin.adminsHint}
      footer={
        <Button
          title={dict.common.add}
          size="lg"
          disabled={!fullName.trim() || !email.trim() || !phone.trim() || !password}
          onPress={submit}
        />
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
    </Sheet>
  );
}
