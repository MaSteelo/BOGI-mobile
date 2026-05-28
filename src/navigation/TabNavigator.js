import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  TextInput,
  FlatList,
  ScrollView,
  Alert,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/colors";
import { supabase } from "../lib/supabase";
import HomeScreen from "../screens/HomeScreen";
import SearchScreen from "../screens/SearchScreen";
import MyPageScreen from "../screens/MyPageScreen";
import AdminScreen from "../screens/AdminScreen";

const Tab = createBottomTabNavigator();

function StarRow({ value, onChange }) {
  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <TouchableOpacity
          key={n}
          onPress={() => onChange(n === value ? 0 : n)}
          hitSlop={8}
        >
          <Text style={{ fontSize: 36, color: n <= value ? COLORS.accent : "#e5e7eb" }}>
            ★
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function RecordModal({ visible, onClose, session }) {
  const [step, setStep] = useState(1);
  const [query, setQuery] = useState("");
  const [games, setGames] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedGame, setSelectedGame] = useState(null);
  const [totalScore, setTotalScore] = useState(0);
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) {
      setStep(1);
      setQuery("");
      setGames([]);
      setSelectedGame(null);
      setTotalScore(0);
      setMemo("");
    }
  }, [visible]);

  useEffect(() => {
    if (query.trim().length === 0) { setGames([]); return; }
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      const { data } = await supabase
        .from("games")
        .select("id, name_ko, name_en, genre")
        .eq("status", "approved")
        .ilike("name_ko", `%${query}%`)
        .limit(20);
      console.log("[RecordModal] 검색 결과:", data?.length, "query:", query);
      setGames(data ?? []);
      setSearchLoading(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const handleSubmit = async () => {
    if (!session || !selectedGame || totalScore === 0) {
      Alert.alert("알림", "게임과 별점을 선택해주세요");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("reviews").insert({
      game_id: selectedGame.id,
      user_id: session.user.id,
      total_score: totalScore,
      memo: memo.trim() || null,
      rating_mode: "total",
    });
    setSaving(false);
    if (error) {
      Alert.alert("오류", error.message);
    } else {
      Alert.alert("완료", "기록이 저장되었어요! 🎉");
      onClose();
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={rm.container}>
        {/* Header */}
        <View style={rm.header}>
          {step === 2 ? (
            <TouchableOpacity
              onPress={() => { setStep(1); setSelectedGame(null); setTotalScore(0); setMemo(""); }}
              hitSlop={8}
            >
              <Ionicons name="chevron-back" size={24} color={COLORS.text} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 24 }} />
          )}
          <Text style={rm.title}>
            {step === 1 ? "게임 검색" : "기록 남기기"}
          </Text>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={24} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        {step === 1 ? (
          <>
            <View style={rm.searchBar}>
              <Text style={{ fontSize: 16, marginRight: 8 }}>🔍</Text>
              <TextInput
                autoFocus
                value={query}
                onChangeText={setQuery}
                placeholder="게임 이름 검색..."
                placeholderTextColor={COLORS.subLight}
                style={rm.searchInput}
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
              {searchLoading && (
                <ActivityIndicator size="small" color={COLORS.accent} />
              )}
            </View>

            <FlatList
              data={games}
              keyExtractor={(item) => item.id}
              contentContainerStyle={rm.gameList}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={rm.gameItem}
                  onPress={() => { setSelectedGame(item); setStep(2); }}
                >
                  <Text style={rm.gameName}>{item.name_ko || item.name_en}</Text>
                  {item.name_en && item.name_ko && item.name_ko !== item.name_en && (
                    <Text style={rm.gameEn}>{item.name_en}</Text>
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <View style={{ alignItems: "center", paddingTop: 48 }}>
                  <Text style={{ color: COLORS.subLight, fontSize: 14 }}>
                    {query.trim() ? "검색 결과가 없어요" : "게임 이름을 입력해주세요"}
                  </Text>
                </View>
              }
            />
          </>
        ) : (
          <ScrollView
            contentContainerStyle={rm.reviewContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Selected game */}
            <View style={rm.selectedGame}>
              <Text style={rm.selectedLabel}>선택한 게임</Text>
              <Text style={rm.selectedName}>
                {selectedGame?.name_ko || selectedGame?.name_en}
              </Text>
            </View>

            {/* Stars */}
            <View style={rm.formBlock}>
              <Text style={rm.formLabel}>
                ⭐ 별점 <Text style={{ color: COLORS.accent }}>필수</Text>
              </Text>
              <StarRow value={totalScore} onChange={setTotalScore} />
              <Text
                style={{
                  marginTop: 8,
                  fontWeight: "700",
                  fontSize: 14,
                  color: totalScore > 0 ? COLORS.accent : COLORS.subLight,
                }}
              >
                {totalScore > 0 ? `${totalScore}.0 / 5` : "별을 선택해주세요"}
              </Text>
            </View>

            {/* Memo */}
            <View style={rm.formBlock}>
              <Text style={rm.formLabel}>한 줄 감상 (선택)</Text>
              <TextInput
                value={memo}
                onChangeText={setMemo}
                placeholder="이 게임에 대한 생각을 남겨보세요"
                placeholderTextColor={COLORS.subLight}
                style={rm.memoInput}
                multiline
              />
            </View>

            {/* Submit */}
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={saving || totalScore === 0}
              style={[
                rm.submitBtn,
                (saving || totalScore === 0) && { opacity: 0.5 },
              ]}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={rm.submitText}>기록하기</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

function RecordButton({ onPress }) {
  return (
    <TouchableOpacity onPress={onPress} style={styles.recordBtn} activeOpacity={0.8}>
      <View style={styles.recordCircle}>
        <Text style={styles.recordPlus}>+</Text>
      </View>
      <Text style={styles.recordLabel}>기록</Text>
    </TouchableOpacity>
  );
}

function CustomTabBar({ state, descriptors, navigation, isAdmin, onRecordPress }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.tabBar, { paddingBottom: insets.bottom }]}>
      {state.routes.map((route, index) => {
        if (route.name === "Admin" && !isAdmin) return null;

        const isFocused = state.index === index;

        if (route.name === "Record") {
          return (
            <RecordButton key={route.key} onPress={onRecordPress} />
          );
        }

        const iconName = {
          Home: isFocused ? "home" : "home-outline",
          Search: isFocused ? "search" : "search-outline",
          MyPage: isFocused ? "person" : "person-outline",
          Admin: isFocused ? "construct" : "construct-outline",
        }[route.name];

        const label = {
          Home: "홈",
          Search: "검색",
          MyPage: "마이",
          Admin: "검토",
        }[route.name];

        return (
          <TouchableOpacity
            key={route.key}
            onPress={() => navigation.navigate(route.name)}
            style={styles.tabBtn}
            activeOpacity={0.7}
          >
            <Ionicons
              name={iconName}
              size={22}
              color={isFocused ? COLORS.accent : COLORS.subLight}
            />
            <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>
              {label}
            </Text>
            <View style={[styles.tabDot, isFocused && styles.tabDotActive]} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function TabNavigator({ session, profile }) {
  const isAdmin = profile?.is_admin ?? false;
  const [recordVisible, setRecordVisible] = useState(false);

  return (
    <>
      <Tab.Navigator
        tabBar={(props) => (
          <CustomTabBar
            {...props}
            isAdmin={isAdmin}
            onRecordPress={() => setRecordVisible(true)}
          />
        )}
        screenOptions={{ headerShown: false }}
      >
        <Tab.Screen name="Home">
          {() => <HomeScreen session={session} />}
        </Tab.Screen>
        <Tab.Screen name="Search">
          {() => <SearchScreen session={session} />}
        </Tab.Screen>
        <Tab.Screen name="Record">
          {() => <HomeScreen session={session} />}
        </Tab.Screen>
        <Tab.Screen name="MyPage">
          {() => (
            <MyPageScreen
              session={session}
              profile={profile}
              isOwnPage={true}
            />
          )}
        </Tab.Screen>
        {isAdmin && (
          <Tab.Screen name="Admin">
            {() => <AdminScreen session={session} profile={profile} />}
          </Tab.Screen>
        )}
      </Tab.Navigator>

      <RecordModal
        visible={recordVisible}
        onClose={() => setRecordVisible(false)}
        session={session}
      />
    </>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: "row",
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    height: 58,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 8,
  },
  tabBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    gap: 2,
  },
  tabLabel: { fontSize: 11, fontWeight: "600", color: COLORS.subLight, marginTop: 2 },
  tabLabelActive: { color: COLORS.accent },
  tabDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "transparent",
    marginTop: 2,
  },
  tabDotActive: { backgroundColor: COLORS.accent },
  recordBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 4,
  },
  recordCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  recordPlus: {
    color: "#fff",
    fontSize: 26,
    fontWeight: "300",
    lineHeight: 30,
  },
  recordLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.accent,
    marginTop: 2,
  },
});

const rm = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.text,
    flex: 1,
    textAlign: "center",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchInput: { flex: 1, fontSize: 15, color: COLORS.text, padding: 0 },
  gameList: { paddingHorizontal: 16, paddingBottom: 24 },
  gameItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  gameName: { fontSize: 15, fontWeight: "700", color: COLORS.text },
  gameEn: { fontSize: 12, color: COLORS.subLight, marginTop: 2 },
  reviewContent: { padding: 16, gap: 16, paddingBottom: 40 },
  selectedGame: {
    backgroundColor: COLORS.accentLight,
    borderRadius: 12,
    padding: 14,
    gap: 4,
  },
  selectedLabel: { fontSize: 11, color: COLORS.accent, fontWeight: "700" },
  selectedName: { fontSize: 18, fontWeight: "800", color: COLORS.text },
  formBlock: { gap: 8 },
  formLabel: { fontSize: 14, fontWeight: "800", color: COLORS.text },
  memoInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: COLORS.text,
    minHeight: 80,
    backgroundColor: COLORS.surface,
    textAlignVertical: "top",
  },
  submitBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
  },
  submitText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
