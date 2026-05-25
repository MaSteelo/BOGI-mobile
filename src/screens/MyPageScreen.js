import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "../constants/colors";
import { supabase } from "../lib/supabase";
import GameCard from "../components/GameCard";
import NotificationBell from "../components/NotificationBell";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const PADDING = 16;
const GAP = 8;
const CARD_WIDTH = (SCREEN_WIDTH - PADDING * 2 - GAP * 2) / 3;

const REVIEWS_QUERY =
  "*, games(id, name_ko, name_en, genre, min_players, max_players, play_minutes, bgg_rank, image_url)";

function Avatar({ nickname, size = 72 }) {
  const letter = nickname?.charAt(0)?.toUpperCase() || "?";
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2 },
      ]}
    >
      <Text style={[styles.avatarLetter, { fontSize: size * 0.42 }]}>
        {letter}
      </Text>
    </View>
  );
}

function StatCard({ label, value }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function RatingChart({ reviews }) {
  const counts = [1, 2, 3, 4, 5].map((s) => ({
    score: s,
    count: reviews.filter((r) => Math.round(r.total_score) === s).length,
  }));
  const max = Math.max(...counts.map((c) => c.count), 1);
  return (
    <View style={styles.chartCard}>
      <Text style={styles.chartTitle}>별점 분포</Text>
      {[...counts].reverse().map(({ score, count }) => (
        <View key={score} style={styles.barRow}>
          <Text style={styles.barLabel}>{"★".repeat(score)}</Text>
          <View style={styles.barTrack}>
            <View
              style={[
                styles.barFill,
                { width: `${(count / max) * 100}%` },
              ]}
            />
          </View>
          <Text style={styles.barCount}>{count}</Text>
        </View>
      ))}
    </View>
  );
}

function GenreChips({ reviews }) {
  const genreCount = {};
  for (const r of reviews) {
    for (const g of r.games?.genre ?? []) {
      genreCount[g] = (genreCount[g] || 0) + 1;
    }
  }
  const sorted = Object.entries(genreCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  if (sorted.length === 0) return null;
  return (
    <View style={styles.chartCard}>
      <Text style={styles.chartTitle}>좋아하는 장르</Text>
      <View style={styles.genreWrap}>
        {sorted.map(([g, c]) => (
          <View key={g} style={styles.genreChip}>
            <Text style={styles.genreChipText}>
              {g} {c}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function MonthlyChart({ reviews }) {
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return {
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: `${d.getMonth() + 1}월`,
      count: 0,
    };
  });
  for (const r of reviews) {
    const m = r.created_at?.slice(0, 7);
    const entry = months.find((x) => x.key === m);
    if (entry) entry.count++;
  }
  const max = Math.max(...months.map((m) => m.count), 1);
  return (
    <View style={styles.chartCard}>
      <Text style={styles.chartTitle}>월별 기록</Text>
      <View style={styles.monthRow}>
        {months.map((m) => (
          <View key={m.key} style={styles.monthCol}>
            <View
              style={[
                styles.monthBar,
                { height: Math.max(4, (m.count / max) * 60) },
              ]}
            />
            <Text style={styles.monthLabel}>{m.label}</Text>
            <Text style={styles.monthCount}>{m.count || ""}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function MyPageScreen({ session, profile: ownProfile, isOwnPage = true, targetUserId }) {
  const uid = targetUserId || session?.user?.id;
  console.log("[MyPageScreen] uid:", uid, "isOwnPage:", isOwnPage);

  const insets = useSafeAreaInsets();
  const [profile, setProfile] = useState(isOwnPage ? ownProfile : null);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("records");

  useEffect(() => {
    if (isOwnPage && ownProfile) setProfile(ownProfile);
  }, [ownProfile]);

  useEffect(() => {
    if (!uid) return;
    if (!isOwnPage) {
      supabase
        .from("profiles")
        .select("*")
        .eq("id", uid)
        .single()
        .then(({ data }) => {
          console.log("[MyPageScreen] 타겟 프로필:", data?.nickname);
          setProfile(data);
        });
    }
    loadReviews();
  }, [uid]);

  const loadReviews = async () => {
    if (!uid) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("reviews")
      .select(REVIEWS_QUERY)
      .eq("user_id", uid)
      .not("total_score", "is", null)
      .order("created_at", { ascending: false });
    if (error) console.warn("[MyPageScreen] 리뷰 오류:", error.message);
    console.log("[MyPageScreen] 리뷰 수:", data?.length);
    setReviews(data ?? []);
    setLoading(false);
  };

  const stats = useMemo(() => {
    if (reviews.length === 0) return { count: 0, avg: "-", favoriteGenre: "-" };
    const avg = reviews.reduce((s, r) => s + (r.total_score || 0), 0) / reviews.length;
    const genreCount = {};
    for (const r of reviews) {
      for (const g of r.games?.genre ?? []) {
        genreCount[g] = (genreCount[g] || 0) + 1;
      }
    }
    const favoriteGenre =
      Object.entries(genreCount).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "-";
    return { count: reviews.length, avg: avg.toFixed(1), favoriteGenre };
  }, [reviews]);

  const reviewedGames = useMemo(() => {
    const seen = new Set();
    return reviews
      .filter((r) => r.games && !seen.has(r.game_id) && seen.add(r.game_id))
      .map((r) => r.games);
  }, [reviews]);

  const renderGame = useCallback(
    ({ item }) => (
      <GameCard
        game={item}
        session={session}
        cardWidth={CARD_WIDTH}
        onReviewSaved={loadReviews}
      />
    ),
    [session]
  );

  const nickname = profile?.nickname || "사용자";

  const ListHeader = (
    <View>
      {/* Profile */}
      <View style={styles.profileSection}>
        <Avatar nickname={nickname} />
        <View style={styles.profileInfo}>
          <Text style={styles.nickname}>{nickname}</Text>
          {profile?.created_at && (
            <Text style={styles.joinDate}>
              {profile.created_at.slice(0, 10)} 가입
            </Text>
          )}
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <StatCard label="기록" value={stats.count} />
        <View style={styles.statDivider} />
        <StatCard label="평균 별점" value={stats.count > 0 ? stats.avg : "-"} />
        <View style={styles.statDivider} />
        <StatCard label="최애 장르" value={stats.favoriteGenre} />
      </View>

      {/* Tabs */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === "records" && styles.tabBtnActive]}
          onPress={() => setActiveTab("records")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "records" && styles.tabTextActive,
            ]}
          >
            기록
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.tabBtn,
            activeTab === "analytics" && styles.tabBtnActive,
          ]}
          onPress={() => setActiveTab("analytics")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "analytics" && styles.tabTextActive,
            ]}
          >
            취향분석
          </Text>
        </TouchableOpacity>
      </View>

      {loading && (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.accent} />
        </View>
      )}

      {activeTab === "analytics" && !loading && (
        <View style={{ paddingHorizontal: PADDING, paddingBottom: 20, gap: 12 }}>
          <RatingChart reviews={reviews} />
          <GenreChips reviews={reviews} />
          <MonthlyChart reviews={reviews} />
          {reviews.length === 0 && (
            <Text style={styles.emptyText}>아직 기록이 없어요 😅</Text>
          )}
        </View>
      )}
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {isOwnPage ? "마이페이지" : "프로필"}
        </Text>
        {isOwnPage && <NotificationBell session={session} />}
      </View>

      <FlatList
        data={activeTab === "records" ? reviewedGames : []}
        keyExtractor={(item) => item.id}
        renderItem={renderGame}
        numColumns={3}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={styles.listContent}
        columnWrapperStyle={
          activeTab === "records" && reviewedGames.length > 0
            ? styles.columnWrapper
            : undefined
        }
        ListEmptyComponent={
          !loading && activeTab === "records" ? (
            <View style={styles.center}>
              <Text style={styles.emptyText}>기록한 게임이 없어요 😅</Text>
            </View>
          ) : null
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: PADDING,
    paddingVertical: 14,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 18, fontWeight: "800", color: COLORS.text },
  profileSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    padding: PADDING,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  avatar: {
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: { color: "#fff", fontWeight: "800" },
  profileInfo: { gap: 4 },
  nickname: { fontSize: 20, fontWeight: "800", color: COLORS.text },
  joinDate: { fontSize: 12, color: COLORS.subLight },
  statsRow: {
    flexDirection: "row",
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 14,
  },
  statCard: { flex: 1, alignItems: "center", gap: 4, paddingHorizontal: 8 },
  statValue: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.accent,
    textAlign: "center",
  },
  statLabel: { fontSize: 11, color: COLORS.sub },
  statDivider: { width: 1, backgroundColor: COLORS.border },
  tabRow: {
    flexDirection: "row",
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    marginBottom: 12,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabBtnActive: { borderBottomColor: COLORS.accent },
  tabText: { fontSize: 14, fontWeight: "700", color: COLORS.subLight },
  tabTextActive: { color: COLORS.accent },
  listContent: { paddingHorizontal: PADDING, paddingBottom: 32 },
  columnWrapper: { gap: GAP, marginBottom: GAP },
  center: { alignItems: "center", paddingVertical: 32 },
  emptyText: { fontSize: 14, color: COLORS.sub, textAlign: "center" },
  chartCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.text,
    marginBottom: 12,
  },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  barLabel: { fontSize: 11, color: COLORS.accent, width: 60 },
  barTrack: {
    flex: 1,
    height: 8,
    backgroundColor: "#f3f4f6",
    borderRadius: 4,
    overflow: "hidden",
  },
  barFill: { height: "100%", backgroundColor: COLORS.accent, borderRadius: 4 },
  barCount: { fontSize: 11, color: COLORS.sub, width: 20, textAlign: "right" },
  genreWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  genreChip: {
    backgroundColor: COLORS.accentLight,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  genreChipText: { fontSize: 12, fontWeight: "700", color: COLORS.accent },
  monthRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-around",
    height: 80,
  },
  monthCol: { alignItems: "center", gap: 4 },
  monthBar: {
    width: 28,
    backgroundColor: COLORS.accent,
    borderRadius: 4,
    minHeight: 4,
  },
  monthLabel: { fontSize: 10, color: COLORS.sub },
  monthCount: { fontSize: 10, fontWeight: "700", color: COLORS.accent },
});
