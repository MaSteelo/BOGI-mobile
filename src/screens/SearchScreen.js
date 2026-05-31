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
  "전략","협력","파티","가족","추상","경제","카드","다이스",
  "덱빌딩","워커플레이스먼트","타일배치","추리","정체은닉","2인","솔로",
];

const SORT_OPTIONS = [
  { key: "name", label: "이름순" },
  { key: "rating", label: "평점순" },
  { key: "bgg", label: "BGG순" },
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
  const [sortBy, setSortBy] = useState("name");

  // debounce 검색 — 입력 완료 후 결과 표시
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const [gamesRes, reviewsRes] = await Promise.all([
        supabase
          .from("games")
          .select(
            "id, name_ko, name_en, bgg_rank, image_url, min_players, max_players, play_minutes, genre"
          )
          .eq("status", "approved")
          .order("name_ko"),
        supabase
          .from("reviews")
          .select("game_id, total_score")
          .not("total_score", "is", null),
      ]);

      if (!gamesRes.error) {
        setGames(gamesRes.data ?? []);
      }

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
    if (sortBy === "rating") {
      list = [...list].sort((a, b) => {
        const ar = gameStats[a.id]?.avg ?? 0;
        const br = gameStats[b.id]?.avg ?? 0;
        return br - ar;
      });
    } else if (sortBy === "bgg") {
      list = [...list].sort((a, b) => {
        const ar = a.bgg_rank ?? 99999;
        const br = b.bgg_rank ?? 99999;
        return ar - br;
      });
    }
    return list;
  }, [games, debouncedQuery, selectedGenres, sortBy, gameStats]);

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
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        keyboardShouldPersistTaps="handled"
      >
        {selectedGenres.length > 0 && (
          <TouchableOpacity
            style={[styles.pill, styles.pillClear]}
            onPress={() => setSelectedGenres([])}
          >
            <Text style={[styles.pillText, { color: "#fff" }]}>전체</Text>
          </TouchableOpacity>
        )}
        {GENRES.map((g) => {
          const active = selectedGenres.includes(g);
          const gs = getGenreStyle([g]);
          return (
            <TouchableOpacity
              key={g}
              style={[
                styles.pill,
                {
                  backgroundColor: active ? gs.grad[0] : "#f3f4f6",
                  borderColor: active ? gs.grad[1] : "#e5e7eb",
                },
              ]}
              onPress={() => toggleGenre(g)}
            >
              <Text
                style={[
                  styles.pillText,
                  { color: active ? COLORS.text : COLORS.sub },
                ]}
              >
                {g}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.sortRow}>
        {SORT_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.key}
            style={[
              styles.sortBtn,
              sortBy === opt.key && styles.sortBtnActive,
            ]}
            onPress={() => setSortBy(opt.key)}
          >
            <Text
              style={[
                styles.sortText,
                sortBy === opt.key && styles.sortTextActive,
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
        <Text style={styles.countText}>{filteredGames.length}개</Text>
      </View>
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
  filterRow: {
    paddingHorizontal: PADDING,
    paddingBottom: 10,
    gap: 8,
    flexDirection: "row",
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  pillClear: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  pillText: { fontSize: 12, fontWeight: "600" },
  sortRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: PADDING,
    paddingBottom: 12,
    gap: 8,
  },
  sortBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: "#f3f4f6",
  },
  sortBtnActive: { backgroundColor: COLORS.accent },
  sortText: { fontSize: 12, fontWeight: "600", color: COLORS.sub },
  sortTextActive: { color: "#fff" },
  countText: { marginLeft: "auto", fontSize: 12, color: COLORS.subLight },
  listContent: { paddingHorizontal: PADDING, paddingBottom: 24 },
  columnWrapper: { gap: GAP, marginBottom: GAP },
  center: { flex: 1, alignItems: "center", paddingTop: 60 },
  loadingText: { fontSize: 14, color: COLORS.subLight },
  emptyText: { fontSize: 15, color: COLORS.sub },
});
