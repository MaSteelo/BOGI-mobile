import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  View, Text, TextInput, FlatList, StyleSheet,
  ActivityIndicator, TouchableOpacity, Image, Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";
import { COLORS } from "../constants/colors";
import GameCard, { getGenreStyle, safeImageUrl } from "../components/GameCard";

const { width: SW } = Dimensions.get("window");
const PADDING = 12;
const COL_GAP = 8;
const CARD_W = (SW - PADDING * 2 - COL_GAP * 2) / 3;

const RANK_COLORS = ["#f59e0b", "#9ca3af", "#cd7f32"];

// ── 섹션 헤더 ─────────────────────────────────────────────────
function SectionHeader({ title, sub }) {
  return (
    <View style={{ marginBottom: 10 }}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <View style={s.accentBar} />
        <Text style={s.sectionTitle}>{title}</Text>
      </View>
      {sub ? <Text style={s.sectionSub}>{sub}</Text> : null}
    </View>
  );
}

// ── BGG / BOGI 순위 카드 ───────────────────────────────────────
function RankCard({ rank, game, avg, badgeColor }) {
  const genreStyle = getGenreStyle(game.genre);
  const imageUrl = safeImageUrl(game.image_url);
  const [imgError, setImgError] = useState(false);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => console.log("[RankCard] 게임 상세:", game.id, game.name_ko)}
      style={s.rankCard}
    >
      {/* 이미지 영역 */}
      <View style={[s.rankImgBox, { backgroundColor: genreStyle.grad[0] }]}>
        {!imgError && imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={StyleSheet.absoluteFillObject}
            resizeMode="cover"
            onError={() => setImgError(true)}
          />
        ) : (
          <Text style={{ fontSize: 32 }}>{genreStyle.emoji}</Text>
        )}
        {/* 순위 배지 */}
        <View style={[s.rankBadge, { backgroundColor: badgeColor, shadowColor: badgeColor }]}>
          <Text style={s.rankBadgeText}>#{rank}</Text>
        </View>
      </View>

      {/* 정보 */}
      <View style={s.rankInfo}>
        <Text style={s.rankName} numberOfLines={2}>
          {game.name_ko || game.name_en}
        </Text>
        {avg != null && (
          <View style={s.avgRow}>
            <Text style={s.avgText}>⭐ {Number(avg).toFixed(1)}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ── 홈 화면 ───────────────────────────────────────────────────
export default function HomeScreen({ session }) {
  const insets = useSafeAreaInsets();

  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewSummary, setReviewSummary] = useState({});
  const [bogiTop, setBogiTop] = useState([]);
  const [bggTop, setBggTop] = useState([]);

  const [searchText, setSearchText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const searchTimer = useRef(null);

  const handleSearchChange = useCallback((text) => {
    setSearchText(text);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearchQuery(text), 300);
  }, []);

  const refreshReviewSummary = useCallback(async () => {
    if (!session) return;
    const { data } = await supabase
      .from("reviews")
      .select("game_id, total_score, created_at")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });
    if (!data) return;
    const map = {};
    data.forEach((r) => {
      if (!map[r.game_id]) map[r.game_id] = { count: 0, latestScore: r.total_score ?? null };
      map[r.game_id].count++;
    });
    setReviewSummary(map);
  }, [session]);

  useEffect(() => {
    (async () => {
      const [gamesRes, reviewsRes] = await Promise.all([
        supabase.from("games").select("id, name_ko, name_en, bgg_rank, image_url, min_players, max_players, play_minutes, genre, difficulty").eq("status", "approved").order("name_ko"),
        supabase.from("reviews").select("game_id, total_score").not("total_score", "is", null),
      ]);

      if (gamesRes.data) {
        const allGames = gamesRes.data;
        console.log("[HomeScreen] 게임 로드:", allGames.length, "개");
        setGames(allGames);

        // BGG TOP 10: bgg_rank 있는 게임, 오름차순
        const bgg = allGames
          .filter((g) => g.bgg_rank != null)
          .sort((a, b) => a.bgg_rank - b.bgg_rank)
          .slice(0, 10);
        setBggTop(bgg);

        // BOGI TOP 10: 리뷰 평균 별점
        if (reviewsRes.data?.length > 0) {
          const gamesById = {};
          allGames.forEach((g) => { gamesById[g.id] = g; });
          const agg = {};
          reviewsRes.data.forEach((r) => {
            if (!gamesById[r.game_id]) return;
            if (!agg[r.game_id]) agg[r.game_id] = { sum: 0, count: 0 };
            agg[r.game_id].sum += r.total_score;
            agg[r.game_id].count += 1;
          });
          const top = Object.entries(agg)
            .filter(([, v]) => v.count >= 1)
            .map(([id, { sum, count }]) => ({ game: gamesById[id], avg: sum / count, count }))
            .sort((a, b) => b.avg - a.avg || b.count - a.count)
            .slice(0, 10);
          setBogiTop(top);
        }
      }

      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (session) refreshReviewSummary();
    else setReviewSummary({});
  }, [session, refreshReviewSummary]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return games;
    const q = searchQuery.trim().toLowerCase();
    return games.filter(
      (g) => g.name_ko?.toLowerCase().includes(q) || g.name_en?.toLowerCase().includes(q)
    );
  }, [games, searchQuery]);

  const ListHeader = (
    <View style={{ paddingTop: insets.top + 8 }}>
      {/* 검색바 */}
      <View style={[s.searchRow, searchFocused && s.searchFocused]}>
        <Text style={s.searchIcon}>🔍</Text>
        <TextInput
          value={searchText}
          onChangeText={handleSearchChange}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          placeholder="게임 이름으로 검색 (한글/영문)"
          placeholderTextColor={COLORS.subLight}
          style={s.searchInput}
          returnKeyType="search"
        />
        {searchText.length > 0 && (
          <TouchableOpacity onPress={() => { setSearchText(""); setSearchQuery(""); }}>
            <Text style={{ fontSize: 14, color: COLORS.subLight, paddingHorizontal: 4 }}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* BGG 글로벌 TOP */}
      {!loading && bggTop.length > 0 && !searchQuery.trim() && (
        <View style={s.section}>
          <SectionHeader title="🌍 BGG 글로벌 TOP" sub={`bgg_rank 기준 TOP ${bggTop.length}`} />
          <FlatList
            data={bggTop}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={{ gap: 10, paddingRight: 4 }}
            renderItem={({ item, index }) => (
              <RankCard
                rank={index + 1}
                game={item}
                avg={null}
                badgeColor={index < 3 ? RANK_COLORS[index] : "#9ca3af"}
              />
            )}
          />
        </View>
      )}

      {/* BOGI 유저 평점 TOP */}
      {!loading && !searchQuery.trim() && (
        <View style={s.section}>
          <SectionHeader title="🏆 BOGI 유저 평점 TOP" sub={bogiTop.length > 0 ? `멤버 평점 기준 TOP ${bogiTop.length}` : null} />
          {bogiTop.length > 0 ? (
            <FlatList
              data={bogiTop}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.game.id.toString()}
              contentContainerStyle={{ gap: 10, paddingRight: 4 }}
              renderItem={({ item, index }) => (
                <RankCard
                  rank={index + 1}
                  game={item.game}
                  avg={item.avg}
                  badgeColor={index < 3 ? RANK_COLORS[index] : "#9ca3af"}
                />
              )}
            />
          ) : (
            <View style={s.emptyBox}>
              <Text style={{ fontSize: 28, marginBottom: 6 }}>🎲</Text>
              <Text style={s.emptyText}>아직 평가가 충분하지 않아요. 첫 평가를 남겨보세요!</Text>
            </View>
          )}
        </View>
      )}

      {/* 전체 게임 섹션 헤더 */}
      <View style={[s.section, { marginBottom: 8 }]}>
        <SectionHeader
          title="📚 전체 게임"
          sub={searchQuery.trim()
            ? `${filtered.length}개 검색됨 (전체 ${games.length}개)`
            : `전체 ${games.length}개`}
        />
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={[s.center, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={COLORS.accent} />
        <Text style={{ marginTop: 12, color: COLORS.sub, fontSize: 14 }}>게임 불러오는 중...</Text>
      </View>
    );
  }

  return (
    <View style={[s.container, { paddingBottom: insets.bottom }]}>
      {filtered.length === 0 ? (
        <FlatList
          data={[]}
          ListHeaderComponent={ListHeader}
          ListEmptyComponent={
            <View style={s.center}>
              <Text style={{ fontSize: 40, marginBottom: 10 }}>{searchQuery.trim() ? "😅" : "🎲"}</Text>
              <Text style={s.emptyTitle}>
                {searchQuery.trim() ? "검색 결과가 없어요 😅" : "등록된 게임이 없어요"}
              </Text>
            </View>
          }
          contentContainerStyle={{ paddingHorizontal: PADDING }}
          keyExtractor={() => "empty"}
          renderItem={() => null}
        />
      ) : (
        <FlatList
          data={filtered}
          numColumns={3}
          keyExtractor={(item) => item.id.toString()}
          ListHeaderComponent={ListHeader}
          contentContainerStyle={{ paddingHorizontal: PADDING, paddingBottom: 20 }}
          columnWrapperStyle={{ gap: COL_GAP, marginBottom: COL_GAP }}
          renderItem={({ item }) => (
            <GameCard
              game={item}
              session={session}
              reviewSummary={reviewSummary[item.id] || null}
              onReviewSaved={refreshReviewSummary}
              cardWidth={CARD_W}
            />
          )}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 60 },

  // 검색
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    marginBottom: 16,
    height: 48,
  },
  searchFocused: {
    borderColor: COLORS.accent,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 3,
  },
  searchIcon: { fontSize: 14, marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.text, height: "100%" },

  // 섹션
  section: { marginBottom: 24 },
  accentBar: { width: 3, height: 20, borderRadius: 2, backgroundColor: COLORS.accent, marginRight: 8 },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: COLORS.text, letterSpacing: -0.3 },
  sectionSub: { fontSize: 12, color: COLORS.sub, marginTop: 3, marginLeft: 11 },

  // 순위 카드
  rankCard: {
    width: 140,
    height: 190,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  rankImgBox: {
    height: 120,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  rankBadge: {
    position: "absolute",
    top: 7,
    left: 7,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 3,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 3,
  },
  rankBadgeText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  rankInfo: { padding: 8, flex: 1 },
  rankName: { fontSize: 12, fontWeight: "700", color: COLORS.text, marginBottom: 5, lineHeight: 16 },
  avgRow: {
    backgroundColor: "#fff8f5",
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    alignSelf: "flex-start",
  },
  avgText: { fontSize: 11, color: COLORS.accent, fontWeight: "700" },

  // 빈 상태
  emptyBox: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 28,
    alignItems: "center",
  },
  emptyText: { fontSize: 14, color: COLORS.subLight, textAlign: "center" },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: COLORS.sub, textAlign: "center" },
});
