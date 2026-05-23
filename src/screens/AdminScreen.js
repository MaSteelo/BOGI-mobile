import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS } from "../constants/colors";

export default function AdminScreen({ session, profile }) {
  console.log("[AdminScreen] admin:", profile?.is_admin);
  return (
    <View style={styles.container}>
      <Text style={styles.text}>🛠 관리자 검토</Text>
      <Text style={styles.sub}>편집 제안 승인/거절 — 포팅 예정</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  text: {
    fontSize: 24,
    fontWeight: "800",
    color: COLORS.text,
  },
  sub: {
    fontSize: 13,
    color: COLORS.subLight,
  },
});
