import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, TextInput, FlatList, StyleSheet,
  ActivityIndicator, TouchableOpacity, Image, Dimensions,
  Modal, ScrollView, Alert,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";
import { COLORS } from "../constants/colors";
import GameCard, { getGenreStyle, safeImageUrl } from "../components/GameCard";
import NotificationBell from "../components/NotificationBell";

const { width: SW } = Dimensions.get("window");
const PADDING = 12;
const COL_GAP = 8;
const CARD_W = (SW - PADDING * 2 - COL_GAP * 2) / 3;
const RANK_CARD_W = 130;

const RANK_COLORS = ["#f59e0b", "#9ca3af", "#cd7f32"];

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

function RankedGameCard({ rank, game, session, reviewSummary, gameStat, onReviewSaved, badgeColor }) {
  return (
    <View>
      <GameCard
        game={game}
        session={session}
        reviewSummary={reviewSummary}
        gameStat={gameStat}
        onReviewSaved={onReviewSaved}
        cardWidth={RANK_CARD_W}
      />
      <View style={[s.rankBadge, { backgroundColor: badgeColor }]}>
        <Text style={s.rankBadgeText}>#{rank}</Text>
      </View>
    </View>
  );
}

function SubmitGameModal({ visible, onClose, session }) {
  const [nameKo, setNameKo] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [minPlayers, setMinPlayers] = useState("");
  const [maxPlayers, setMaxPlayers] = useState("");
  const [playMinutes, setPlayMinutes] = useState("");
  const [genre, setGenre] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) {
      setNameKo(""); setNameEn(""); setMinPlayers(""); setMaxPlayers("");
      setPlayMinutes(""); setGenre(""); setDescription(""); setSaving(false);
    }
  }, [visible]);

  const handleSubmit = async () => {
    if (!nameKo.trim()) {
      Alert.alert("알림", "한글 이름은 필수입니다");
      return;
    }
    setSaving(true);
    const game_data = {
      name_ko: nameKo.trim(),
      name_en: nameEn.trim() || null,
      min_players: minPlayers ? parseInt(minPlayers, 10) : null,
      max_players: maxPlayers ? parseInt(maxPlayers, 10) : null,
      play_minutes: playMinutes ? parseInt(playMinutes, 10) : null,
      genre: genre.trim() ? genre.split(",").map((g) => g.trim()).filter(Boolean) : null,
      description: description.trim() || null,
    };
    const { error } = await supabase.from("game_submissions").insert({
      user_id: session.user.id,
      game_data,
      status: "pending",
    });
    setSaving(false);
    if (error) {
      Alert.alert("오류", error.message);
    } else {
      Alert.alert("완료", "게임 제안이 접수되었어요! 관리자 검토 후 등록됩니다. 🎉");
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
      <SafeAreaView style={sg.container}>
        <View style={sg.header}>
          <View style={{ width: 32 }} />
          <Text style={sg.title}>새 게임 제안</Text>
          <TouchableOpacity onPress={onClose} hitSlop={8}>
            <Text style={{ fontSize: 20, color: COLORS.sub }}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={sg.content} keyboardShouldPersistTaps="handled">
          <View style={sg.field}>
            <Text style={sg.label}>한글 이름 <Text style={{ color: COLORS.accent }}>필수</Text></Text>
            <TextInput
              value={nameKo}
              onChangeText={setNameKo}
              style={sg.input}
              placeholder="예: 카탄"
              placeholderTextColor={COLORS.subLight}
            />
          </View>
          <View style={sg.field}>
            <Text style={sg.label}>영문 이름 (선택)</Text>
            <TextInput
              value={nameEn}
              onChangeText={setNameEn}
              style={sg.input}
              placeholder="예: Catan"
              placeholderTextColor={COLORS.subLight}
            />
          </View>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={[sg.field, { flex: 1 }]}>
              <Text style={sg.label}>최소 인원</Text>
              <TextInput
                value={minPlayers}
                onChangeText={setMinPlayers}
                style={sg.input}
                keyboardType="numeric"
                placeholder="2"
                placeholderTextColor={COLORS.subLight}
              />
            </View>
            <View style={[sg.field, { flex: 1 }]}>
              <Text style={sg.label}>최대 인원</Text>
              <TextInput
                value={maxPlayers}
                onChangeText={setMaxPlayers}
                style={sg.input}
                keyboardType="numeric"
                placeholder="4"
                placeholderTextColor={COLORS.subLight}
              />
            </View>
            <View style={[sg.field, { flex: 1 }]}>
              <Text style={sg.label}>시간(분)</Text>
              <TextInput
                value={playMinutes}
                onChangeText={setPlayMinutes}
                style={sg.input}
                keyboardType="numeric"
                placeholder="60"
                placeholderTextColor={COLORS.subLight}
              />
            </View>
          </View>
          <View style={sg.field}>
            <Text style={sg.label}>장르 (쉼표로 구분)</Text>
            <TextInput
              value={genre}
              onChangeText={setGenre}
              style={sg.input}
              placeholder="예: 전략, 카드"
              placeholderTextColor={COLORS.subLight}
            />
          </View>
          <View style={sg.field}>
            <Text style={sg.label}>게임 설명 (선택)</Text>
            <TextInput
              value={description}
              onChangeText={setDescription}
              style={[sg.input, { minHeight: 80, textAlignVertical: "top" }]}
              multiline
              placeholder="게임에 대한 간단한 설명을 적어주세요"
              placeholderTextColor={COLORS.subLight}
            />
          </View>
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={saving || !nameKo.trim()}
            style={[sg.submitBtn, (saving || !nameKo.trim()) && { opacity: 0.5 }]}
          >
            {saving
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={sg.submitText}>제안하기</Text>
            }
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

export default function HomeScreen({ session }) {
  const insets = useSafeAreaInsets();

  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [reviewSummary, setReviewSummary] = useState({});
  const [gameStats, setGameStats] = useState({});
  const [bogiTop, setBogiTop] = useState([]);
  const [bggTop, setBggTop] = useState([]);
  const [showSubmitModal, setShowSubmitModal] = useState(false);

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
      console.log("[HomeScreen] 데이터 로딩 시작");
      try {
        const [gamesRes, reviewsRes] = await Promise.all([
          supabase
            .from("games")
            .select("id, name_ko, name_en, bgg_rank, image_url, min_players, max_players, play_minutes, genre")
            .eq("status", "approved")
            .order("name_ko"),
          supabase.from("reviews").select("game_id, total_score").not("total_score", "is", null),
        ]);

        console.log("[HomeScreen] games 응답:", {
          count: gamesRes.data?.length ?? 0,
          error: gamesRes.error?.message ?? null,
          status: gamesRes.status,
        });

        if (gamesRes.error) {
          setLoadError(`games 조회 오류: ${gamesRes.error.message} (code: ${gamesRes.error.code})`);
          setLoading(false);
          return;
        }

        if (!gamesRes.data || gamesRes.data.length === 0) {
          console.warn("[HomeScreen] games 결과 0개 — status 필터 없이 재시도");
          const fallback = await supabase.from("games").select("id, name_ko").limit(3);
          if (fallback.error) {
            setLoadError(`RLS 차단 가능성: ${fallback.error.message}`);
          } else if (!fallback.data?.length) {
            setLoadError("games 테이블이 비어 있거나 RLS가 비로그인 조회를 차단하고 있습니다.");
          } else {
            setLoadError("status='approved'인 게임이 없습니다.");
          }
          setLoading(false);
          return;
        }

        const allGames = gamesRes.data;
        console.log("[HomeScreen] 게임 로드:", allGames.length, "개");
        setGames(allGames);

        const bgg = allGames
          .filter((g) => g.bgg_rank != null)
          .sort((a, b) => a.bgg_rank - b.bgg_rank)
          .slice(0, 10);
        setBggTop(bgg);

        if (reviewsRes.data?.length > 0) {
          const gamesById = {};
          allGames.forEach((g) => { gamesById[g.id] = g; });
          const agg = {};
          reviewsRes.data.forEach((r) => {
            if (!agg[r.game_id]) agg[r.game_id] = { sum: 0, count: 0 };
            agg[r.game_id].sum += r.total_score;
            agg[r.game_id].count += 1;
          });
          const stats = {};
          Object.entries(agg).forEach(([id, { sum, count }]) => {
            stats[id] = { avg: sum / count, count };
          });
          setGameStats(stats);
          const top = Object.entries(agg)
            .filter(([id]) => gamesById[id])
            .map(([id, { sum, count }]) => ({ game: gamesById[id], avg: sum / count, count }))
            .sort((a, b) => b.avg - a.avg || b.count - a.count)
            .slice(0, 10);
          setBogiTop(top);
        }

        setLoading(false);
      } catch (e) {
        console.error("[HomeScreen] 예외 발생:", e);
        setLoadError(`예외: ${e.message}`);
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (session) refreshReviewSummary();
    else setReviewSummary({});
  }, [session, refreshReviewSummary]);

  const Header = (
    <View style={[s.homeHeader, { paddingTop: insets.top }]}>
      <Text style={s.logoText}>BOGI</Text>
      <View style={s.headerRight}>
        {session && (
          <TouchableOpacity onPress={() => setShowSubmitModal(true)} style={s.submitGameBtn}>
            <Text style={s.submitGameBtnText}>+ 게임 제안</Text>
          </TouchableOpacity>
        )}
        {session && <NotificationBell session={session} />}
      </View>
    </View>
  );

  const ListHeader = (
    <View style={{ paddingTop: 8 }}>
      {!loading && bggTop.length > 0 && (
        <View style={s.section}>
          <SectionHeader title="🌍 BGG 글로벌 TOP" sub={`bgg_rank 기준 TOP ${bggTop.length}`} />
          <FlatList
            data={bggTop}
            horizontal
            showsHorizontalScrollIndicator={false}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={{ gap: 10, paddingRight: 4 }}
            renderItem={({ item, index }) => (
              <RankedGameCard
                rank={index + 1}
                game={item}
                session={session}
                reviewSummary={reviewSummary[item.id] || null}
                gameStat={gameStats[item.id] || null}
                onReviewSaved={refreshReviewSummary}
                badgeColor={index < 3 ? RANK_COLORS[index] : "#9ca3af"}
              />
            )}
          />
        </View>
      )}

      {!loading && (
        <View style={s.section}>
          <SectionHeader
            title="🏆 BOGI 유저 평점 TOP"
            sub={bogiTop.length > 0 ? `멤버 평점 기준 TOP ${bogiTop.length}` : null}
          />
          {bogiTop.length > 0 ? (
            <FlatList
              data={bogiTop}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.game.id.toString()}
              contentContainerStyle={{ gap: 10, paddingRight: 4 }}
              renderItem={({ item, index }) => (
                <RankedGameCard
                  rank={index + 1}
                  game={item.game}
                  session={session}
                  reviewSummary={reviewSummary[item.game.id] || null}
                  gameStat={{ avg: item.avg, count: item.count }}
                  onReviewSaved={refreshReviewSummary}
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

      <View style={[s.section, { marginBottom: 8 }]}>
        <SectionHeader title="📚 전체 게임" sub={`전체 ${games.length}개`} />
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={s.container}>
        {Header}
        <View style={s.center}>
          <ActivityIndicator size="large" color={COLORS.accent} />
          <Text style={{ marginTop: 12, color: COLORS.sub, fontSize: 14 }}>게임 불러오는 중...</Text>
        </View>
      </View>
    );
  }

  if (loadError) {
    return (
      <View style={s.container}>
        {Header}
        <View style={[s.center, { paddingHorizontal: 24 }]}>
          <Text style={{ fontSize: 32, marginBottom: 12 }}>⚠️</Text>
          <Text style={{ fontSize: 14, fontWeight: "700", color: COLORS.error, marginBottom: 8 }}>데이터 로딩 실패</Text>
          <Text style={{ fontSize: 12, color: COLORS.sub, textAlign: "center", lineHeight: 20 }}>{loadError}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={s.container}>
      {Header}

      <FlatList
        data={games}
        numColumns={3}
        keyExtractor={(item) => item.id.toString()}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={{ paddingHorizontal: PADDING, paddingBottom: insets.bottom + 20 }}
        columnWrapperStyle={{ gap: COL_GAP, marginBottom: COL_GAP }}
        ListEmptyComponent={
          <View style={s.center}>
            <Text style={{ fontSize: 40, marginBottom: 10 }}>🎲</Text>
            <Text style={s.emptyTitle}>등록된 게임이 없어요</Text>
          </View>
        }
        renderItem={({ item }) => (
          <GameCard
            game={item}
            session={session}
            reviewSummary={reviewSummary[item.id] || null}
            gameStat={gameStats[item.id] || null}
            onReviewSaved={refreshReviewSummary}
            cardWidth={CARD_W}
          />
        )}
      />

      <SubmitGameModal
        visible={showSubmitModal}
        onClose={() => setShowSubmitModal(false)}
        session={session}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 60 },

  homeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: PADDING,
    paddingBottom: 10,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  logoText: {
    fontSize: 22,
    fontWeight: "900",
    color: COLORS.accent,
    letterSpacing: -0.5,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  submitGameBtn: {
    backgroundColor: COLORS.accentLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  submitGameBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.accent,
  },

  section: { marginBottom: 24 },
  accentBar: { width: 3, height: 20, borderRadius: 2, backgroundColor: COLORS.accent, marginRight: 8 },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: COLORS.text, letterSpacing: -0.3 },
  sectionSub: { fontSize: 12, color: COLORS.sub, marginTop: 3, marginLeft: 11 },

  rankBadge: {
    position: "absolute",
    top: 7,
    left: 7,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  rankBadgeText: { color: "#fff", fontSize: 11, fontWeight: "800" },

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

const sg = StyleSheet.create({
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
  title: { fontSize: 16, fontWeight: "800", color: COLORS.text, flex: 1, textAlign: "center" },
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: "700", color: COLORS.text },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: COLORS.text,
    backgroundColor: COLORS.surface,
  },
  submitBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 8,
  },
  submitText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
