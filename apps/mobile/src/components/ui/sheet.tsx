import React from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { X } from "lucide-react-native";
import { IconButton } from "./button";
import { Row, Stack } from "./layout";
import { Text } from "./text";
import { useTheme } from "@/theme/theme-context";
import { radius, space } from "@/theme/tokens";

/**
 * Bottom sheet.
 *
 * Everything the website puts in a centred dialog belongs down here instead:
 * on a phone the bottom of the screen is the only region reachable one-handed,
 * and a sheet keeps the page behind it visible as context.
 */
export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const { colors, shadow } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={{ flex: 1, justifyContent: "flex-end" }}>
        <Pressable
          accessibilityLabel="Close"
          onPress={onClose}
          style={{ flex: 1, backgroundColor: colors.overlay }}
        />
        <View
          style={{
            backgroundColor: colors.popover,
            borderTopLeftRadius: radius["3xl"],
            borderTopRightRadius: radius["3xl"],
            borderTopWidth: 1,
            borderColor: colors.border,
            maxHeight: "86%",
            ...shadow("lg"),
          }}
        >
          {/* Grabber: the affordance that says this panel can be dismissed. */}
          <View style={{ alignItems: "center", paddingTop: space.sm }}>
            <View
              style={{
                width: 40,
                height: 4,
                borderRadius: radius.full,
                backgroundColor: colors.border,
              }}
            />
          </View>

          <Row gap="sm" align="flex-start" style={{ padding: space.md, paddingBottom: space.sm }}>
            <Stack gap={2} flex={1}>
              <Text variant="heading" weight="bold">
                {title}
              </Text>
              {subtitle ? (
                <Text variant="callout" color="mutedForeground">
                  {subtitle}
                </Text>
              ) : null}
            </Stack>
            <IconButton accessibilityLabel="Close" onPress={onClose}>
              <X size={20} color={colors.mutedForeground} />
            </IconButton>
          </Row>

          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: space.md, paddingTop: 0, gap: space.md }}
          >
            {children}
          </ScrollView>

          <View
            style={{
              padding: space.md,
              paddingBottom: Math.max(insets.bottom, space.md),
              borderTopWidth: footer ? 1 : 0,
              borderTopColor: colors.border,
            }}
          >
            {footer}
          </View>
        </View>
      </View>
    </Modal>
  );
}
