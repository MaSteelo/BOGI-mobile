import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  StyleSheet,
  Dimensions,
  Keyboard,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "../constants/colors";
import { supabase } from "../lib/supabase";
import GameCard, { getGenreStyle } from "../components/GameCard";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const PADDING = 16;
const GAP = 8;
const CARD_WIDTH = (SCREEN_WIDTH - PADDING * 2 - GAP * 2) / 3;

const GENRES = [
  "전략", "가족", "파티", "추상", "테마", "카드",
  "협력", "경제", "추리", "어드벤처", "퍼즐", "덱빌딩",
  "다이스", "워커플레이스먼트", "타일배치", "정체은닉", "2인", "솔로",
];

const PLAYER_OPTIONS = [
  { label: "1인", value: 1 },
  { label: "2인", value: 2 },
  { label: "3인", value: 3 },
  { label: "4인", value: 4 },
  { label: "5인", value: 5 },
  { label: "6인+", value: 6 },
];

const TIME_OPTIONS = [
  { label: "~15분", value: 15 },
  { label: "~30분", value: 30 },
  { label: "~60분", value: 60 },
  { label: "~120분", value: 120 },
  { label: "120분+", value: 9999 },
];

const AGE_OPTIONS = [
  { label: "전체연령", value: null },
  { label: "6세+", value: 6 },
  { label: "8세+", value: 8 },
  { label: "10세+", value: 10 },
  { label: "12세+", value: 12 },
  { label: "14세+", value: 14 },
  { label: "18세+", value: 18 },
];

const SORT_OPTIONS = [
  { key: "name", label: "이름순" },
  { key: "rating", label: "평점순" },
  { key: "bgg", label: "BGG순" },
  { key: "year", label: "최신순" },
];

export default function SearchScreen({ session }) {
  const insets = useSafeAreaInsets();
  const inputRef = useRef(null);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [games, setGames] = useState([]);
  const [gameStats, setGameStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedGenres, setSelectedGenres] = useState([]);
  const [filterPlayers, setFilterPlayers] = useState(null);
  const [filterTime, setFilterTime] = useState(null);
  const [filterAge, setFilterAge] = useState(null);
  const [sortBy, setSortBy] = useState("name");
  const [filterOpen, setFilterOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [gamesRes, reviewsRes] = await Promise.all([
        supabase
          .from("games")
          .select(
            "id, name_ko, name_en, bgg_rank, image_url, min_players, max_players, play_minutes, min_age, genre"
          )
          .eq("status", "approved")
          .order("name_ko"),
        supabase
          .from("reviews")
          .select("game_id, total_score")
          .not("total_score", "is", null),
      ]);

      if (!gamesRes.error) setGames(gamesRes.data ?? []);

      if (reviewsRes.data) {
        const agg = {};
        for (const r of reviewsRes.data) {
          if (!agg[r.game_id]) agg[r.game_id] = { sum: 0, count: 0 };
          agg[r.game_id].sum += r.total_score;
          agg[r.game_id].count += 1;
        }
        const computed = {};
        for (const [gid, s] of Object.entries(agg)) {
          computed[gid] = { avg: s.sum / s.count, count: s.count };
        }
        setGameStats(computed);
      }
      setLoading(false);
    }
    load();
  }, []);

  const toggleGenre = useCallback((g) => {
    setSelectedGenres((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
    );
  }, []);

  const resetFilters = useCallback(() => {
    setSelectedGenres([]);
    setFilterPlayers(null);
    setFilterTime(null);
    setFilterAge(null);
    setSortBy("name");
    setQuery("");
    setDebouncedQuery("");
  }, []);

  const filteredGames = useMemo(() => {
    let list = games;
    if (debouncedQuery.trim()) {
      const q = debouncedQuery.trim().toLowerCase();
      list = list.filter(
        (g) =>
          g.name_ko?.toLowerCase().includes(q) ||
          g.name_en?.toLowerCase().includes(q)
      );
    }
    if (selectedGenres.length > 0) {
      list = list.filter((g) =>
        selectedGenres.some((genre) => g.genre?.includes(genre))
      );
    }
    if (filterPlayers !== null) {
      if (filterPlayers === 6) {
        list = list.filter((g) => (g.max_players ?? 0) >= 6);
      } else {
        list = list.filter(
          (g) =>
            (g.min_players ?? 0) <= filterPlayers &&
            filterPlayers <= (g.max_players ?? 99)
        );
      }
    }
    if (filterTime !== null) {
      if (filterTime === 9999) {
        list = list.filter((g) => (g.play_minutes ?? 0) > 120);
      } else {
        list = list.filter(
          (g) => g.play_minutes != null && g.play_minutes <= filterTime
        );
      }
    }
    if (filterAge !== null) {
      list = list.filter((g) => g.min_age == null || g.min_age <= filterAge);
    }
    list = [...list];
    if (sortBy === "rating") {
      list.sort((a, b) => (gameStats[b.id]?.avg ?? 0) - (gameStats[a.id]?.avg ?? 0));
    } else if (sortBy === "bgg") {
      list.sort((a, b) => (a.bgg_rank ?? 99999) - (b.bgg_rank ?? 99999));
    } else if (sortBy === "year") {
      list.sort((a, b) => (b.year_published ?? 0) - (a.year_published ?? 0));
    }
    return list;
  }, [games, debouncedQuery, selectedGenres, filterPlayers, filterTime, filterAge, sortBy, gameStats]);

  const activeFilterCount =
    selectedGenres.length +
    (filterPlayers !== null ? 1 : 0) +
    (filterTime !== null ? 1 : 0) +
    (filterAge !== null ? 1 : 0);

  const hasActiveFilter =
    debouncedQuery.trim() !== "" ||
    selectedGenres.length > 0 ||
    filterPlayers !== null ||
    filterTime !== null ||
    filterAge !== null;

  const renderGame = useCallback(
    ({ item }) => (
      <GameCard
        game={item}
        session={session}
        gameStat={gameStats[item.id]}
        cardWidth={CARD_WIDTH}
      />
    ),
    [session, gameStats]
  );

  const ListHeader = (
    <View>
      {/* 필터 토글 행 */}
      <View style={styles.filterToggleRow}>
        <TouchableOpacity
          style={[
            styles.filterToggleBtn,
            (filterOpen || activeFilterCount > 0) && styles.filterToggleBtnActive,
          ]}
          onPress={() => setFilterOpen((v) => !v)}
        >
          <Text
            style={[
              styles.filterToggleText,
              (filterOpen || activeFilterCount > 0) && { color: "#fff" },
            ]}
          >
            {filterOpen ? "🔼" : "🔽"} 필터
          </Text>
          {activeFilterCount > 0 && (
            <View style={styles.filterBadge}>
              <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
            </View>
          )}
        </TouchableOpacity>
        {(hasActiveFilter || sortBy !== "name") && (
          <TouchableOpacity onPress={resetFilters} style={styles.resetBtn}>
            <Text style={styles.resetText}>초기화 ✕</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.countText}>{filteredGames.length}개</Text>
      </View>

      {/* 필터 패널 */}
      {filterOpen && (
        <View style={styles.filterPanel}>
          {/* 장르 */}
          <Text style={styles.sectionLabel}>장르</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
            keyboardShouldPersistTaps="handled"
          >
            {GENRES.map((g) => {
              const active = selectedGenres.includes(g);
              return (
                <TouchableOpacity
                  key={g}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => toggleGenre(g)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{g}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {/* 인원 */}
          <Text style={[styles.sectionLabel, { marginTop: 12 }]}>인원</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
            keyboardShouldPersistTaps="handled"
          >
            {PLAYER_OPTIONS.map(({ label, value }) => (
              <TouchableOpacity
                key={value}
                style={[styles.chip, filterPlayers === value && styles.chipActive]}
                onPress={() => setFilterPlayers(filterPlayers === value ? null : value)}
              >
                <Text style={[styles.chipText, filterPlayers === value && styles.chipTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* 시간 */}
          <Text style={[styles.sectionLabel, { marginTop: 12 }]}>플레이 시간</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
            keyboardShouldPersistTaps="handled"
          >
            {TIME_OPTIONS.map(({ label, value }) => (
              <TouchableOpacity
                key={value}
                style={[styles.chip, filterTime === value && styles.chipActive]}
                onPress={() => setFilterTime(filterTime === value ? null : value)}
              >
                <Text style={[styles.chipText, filterTime === value && styles.chipTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* 나이 */}
          <Text style={[styles.sectionLabel, { marginTop: 12 }]}>나이</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipRow}
            keyboardShouldPersistTaps="handled"
          >
            {AGE_OPTIONS.map(({ label, value }) => (
              <TouchableOpacity
                key={label}
                style={[styles.chip, filterAge === value && styles.chipActive]}
                onPress={() => setFilterAge(filterAge === value ? null : value)}
              >
                <Text style={[styles.chipText, filterAge === value && styles.chipTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* 정렬 */}
          <Text style={[styles.sectionLabel, { marginTop: 12 }]}>정렬</Text>
          <View style={styles.chipRowWrap}>
            {SORT_OPTIONS.map((opt) => (
              <TouchableOpacity
                key={opt.key}
                style={[styles.chip, sortBy === opt.key && styles.chipActive]}
                onPress={() => setSortBy(opt.key)}
              >
                <Text style={[styles.chipText, sortBy === opt.key && styles.chipTextActive]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
        <View style={[styles.container, { paddingTop: insets.top }]}>
          <View style={styles.searchBar}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder="게임 이름으로 검색..."
              placeholderTextColor={COLORS.subLight}
              value={query}
              onChangeText={setQuery}
              returnKeyType="search"
              onSubmitEditing={Keyboard.dismiss}
              clearButtonMode="while-editing"
            />
          </View>

          {loading ? (
            <View style={styles.center}>
              <Text style={styles.loadingText}>게임 목록 불러오는 중...</Text>
            </View>
          ) : (
            <FlatList
              data={filteredGames}
              keyExtractor={(item) => item.id}
              renderItem={renderGame}
              numColumns={3}
              ListHeaderComponent={ListHeader}
              contentContainerStyle={styles.listContent}
              columnWrapperStyle={filteredGames.length > 0 ? styles.columnWrapper : undefined}
              ListEmptyComponent={
                <View style={styles.center}>
                  <Text style={styles.emptyText}>검색 결과가 없어요 😅</Text>
                </View>
              }
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
            />
          )}
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.surface,
    marginHorizontal: PADDING,
    marginVertical: 12,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  searchIcon: { fontSize: 16, marginRight: 8 },
  input: { flex: 1, fontSize: 15, color: COLORS.text, padding: 0 },

  filterToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: PADDING,
    paddingBottom: 10,
    gap: 8,
  },
  filterToggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  filterToggleBtnActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  filterToggleText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.sub,
  },
  filterBadge: {
    backgroundColor: "rgba(255,255,255,0.3)",
    borderRadius: 10,
    width: 17,
    height: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  filterBadgeText: { fontSize: 10, fontWeight: "800", color: "#fff" },
  resetBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  resetText: { fontSize: 12, fontWeight: "600", color: COLORS.sub },
  countText: { marginLeft: "auto", fontSize: 12, color: COLORS.subLight },

  filterPanel: {
    marginHorizontal: PADDING,
    marginBottom: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.subLight,
    letterSpacing: 0.3,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: "row",
    gap: 6,
    paddingRight: 4,
  },
  chipRowWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  chipActive: {
    backgroundColor: COLORS.accent,
    borderColor: COLORS.accent,
  },
  chipText: { fontSize: 12, fontWeight: "600", color: COLORS.sub },
  chipTextActive: { color: "#fff" },

  listContent: { paddingHorizontal: PADDING, paddingBottom: 24 },
  columnWrapper: { gap: GAP, marginBottom: GAP },
  center: { flex: 1, alignItems: "center", paddingTop: 60 },
  loadingText: { fontSize: 14, color: COLORS.subLight },
  emptyText: { fontSize: 15, color: COLORS.sub },
});
