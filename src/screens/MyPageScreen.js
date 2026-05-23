import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS } from "../constants/colors";

export default function MyPageScreen({ session, profile, isOwnPage = true }) {
  console.log("[MyPageScreen] isOwnPage:", isOwnPage, "uid:", session?.user?.id);
  return (
    <View style={styles.container}>
      <Text style={styles.text}>👤 마이페이지</Text>
      <Text style={styles.sub}>{profile?.nickname ?? "로딩 중..."}</Text>
      <Text style={styles.sub}>기록 / 취향분석 — 포팅 예정</Text>
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
