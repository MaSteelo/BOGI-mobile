import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { COLORS } from "../constants/colors";

export default function UserProfileScreen({ route, session, profile }) {
  const navigation = useNavigation();
  const { userId } = route?.params ?? {};
  console.log("[UserProfileScreen] userId:", userId);
  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
        <Text style={styles.backText}>← 뒤로</Text>
      </TouchableOpacity>
      <Text style={styles.text}>👤 유저 프로필</Text>
      <Text style={styles.sub}>userId: {userId}</Text>
      <Text style={styles.sub}>포팅 예정</Text>
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
  backBtn: {
    position: "absolute",
    top: 60,
    left: 20,
  },
  backText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.sub,
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
