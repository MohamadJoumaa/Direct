import React from "react";
import { useRouter } from "expo-router";
import {
  Building2,
  FileCheck2,
  Flag,
  LogOut,
  Settings,
  User,
  Warehouse,
} from "lucide-react-native";

import { AppControls } from "@/components/app-controls";
import { AppHeader } from "@/components/app-header";
import { ListCard, ListRow, Section } from "@/components/ui/card";
import { Row } from "@/components/ui/layout";
import { Screen } from "@/components/ui/screen";
import { Text } from "@/components/ui/text";
import { useAuth } from "@/lib/auth-context";
import { useI18n } from "@/lib/i18n";
import { useStore } from "@/lib/store-context";
import { useTheme } from "@/theme/theme-context";

/**
 * Everything an admin needs but does not open every hour. Four tabs is the
 * limit on a phone, so the long tail lives behind one entry instead of a
 * cramped fifth and sixth tab.
 */
export default function AdminMore() {
  const { dict } = useI18n();
  const { colors } = useTheme();
  const { user } = useAuth();
  const { state, logout } = useStore();
  const router = useRouter();

  const pendingDocs = state.documents.filter((d) => d.status === "pending").length;
  const openReports = state.reports.filter((r) => r.status === "open").length;

  const icon = (Icon: typeof Settings) => <Icon size={18} color={colors.mutedForeground} />;

  return (
    <>
      <AppHeader title={dict.common.more} subtitle={user?.full_name} />
      <Screen>
        <Section title={dict.nav.settings}>
          <ListCard>
            <ListRow
              icon={icon(Warehouse)}
              label={dict.nav.warehouses}
              value={String(state.warehouses.length)}
              onPress={() => router.push("/admin/warehouses")}
            />
            <ListRow
              icon={icon(Building2)}
              label={dict.nav.businesses}
              value={String(state.profiles.filter((p) => p.role === "business").length)}
              onPress={() => router.push("/admin/businesses")}
            />
            <ListRow
              icon={icon(FileCheck2)}
              label={dict.nav.documents}
              value={pendingDocs > 0 ? String(pendingDocs) : undefined}
              onPress={() => router.push("/admin/documents")}
            />
            <ListRow
              icon={icon(Flag)}
              label={dict.nav.reports}
              value={openReports > 0 ? String(openReports) : undefined}
              onPress={() => router.push("/admin/reports")}
            />
            <ListRow
              icon={icon(Settings)}
              label={dict.nav.settings}
              onPress={() => router.push("/admin/settings")}
              last
            />
          </ListCard>
        </Section>

        <Section title={dict.nav.profile}>
          <ListCard>
            <ListRow
              icon={icon(User)}
              label={dict.profile.editProfile}
              onPress={() => router.push("/profile")}
            />
            <ListRow
              icon={icon(LogOut)}
              label={dict.common.logOut}
              destructive
              onPress={() => {
                logout();
                router.replace("/");
              }}
              last
            />
          </ListCard>
        </Section>

        <Row justify="space-between">
          <Text variant="label" color="mutedForeground">
            {dict.home.copyright}
          </Text>
          <AppControls />
        </Row>
      </Screen>
    </>
  );
}
