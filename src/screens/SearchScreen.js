import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS } from "../constants/colors";

export default function SearchScreen({ session }) {
  console.log("[SearchScreen] session:", session?.user?.email);
  return (
    <View style={styles.container}>
      <Text style={styles.text}>🔍 검색</Text>
      <Text style={styles.sub}>게임 검색 — 포팅 예정</Text>
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
