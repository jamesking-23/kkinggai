import { Pressable, StyleSheet, Text, View } from "react-native";
import { C } from "./theme";

/** Top bar of a native module screen: back to Home, title, optional action on the right. */
export function ScreenHeader({
  title,
  onBack,
  action,
}: {
  title: string;
  onBack: () => void;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={s.header}>
      <Pressable onPress={onBack} hitSlop={12}>
        <Text style={s.link}>‹ Home</Text>
      </Pressable>
      <Text style={s.title}>{title}</Text>
      {action ? (
        <Pressable onPress={action.onPress} hitSlop={12}>
          <Text style={s.link}>{action.label}</Text>
        </Pressable>
      ) : (
        <View style={{ width: 56 }} />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  link: { color: C.primary, fontWeight: "600", fontSize: 14 },
  title: { fontSize: 18, fontWeight: "700", color: C.text },
});
