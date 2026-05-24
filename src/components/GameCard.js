import React, { useState, useRef } from "react";
import {
  View, Text, Image, TouchableOpacity, Modal,
  Animated, ScrollView, TextInput, StyleSheet,
  ActivityIndicator, Alert, Dimensions,
} from "react-native";
import { supabase } from "../lib/supabase";
import { COLORS } from "../constants/colors";

const { width: SW, height: SH } = Dimensions.get("window");

function thumbToOriginal(url) {
  if (!url || !url.includes("__thumb")) return url;
  return url
    .replace("__thumb", "__original")
    .replace(/\/fit-in\/\d+x\d+\//g, "/")
    .replace(/filters:webp\(\)\//g, "")
    .replace(/filters:strip_icc\(\)\//g, "");
}

function safeImageUrl(url) {
  if (!url) return null;
  let u = url.trim();
  if (u.startsWith("http://")) u = "https://" + u.slice(7);
  if (u.startsWith("//")) u = "https:" + u;
  if (u.startsWith("cf.geekdo-images.com")) u = "https://" + u;
  if (/^pic\d+\.\w+$/i.test(u)) u = `https://cf.geekdo-images.com/${u}`;
  if (u.startsWith("/")) u = "https://cf.geekdo-images.com" + u;
  if (!u.startsWith("https://")) return null;
  return thumbToOriginal(u);
}

const GENRE_STYLE = {
  전략: { grad: ["#dbeafe", "#93c5fd"], emoji: "♟️" },
  가족: { grad: ["#fee2e2", "#fca5a5"], emoji: "👨‍👩‍👧" },
  파티: { grad: ["#fce7f3", "#f9a8d4"], emoji: "🎉" },
  협력: { grad: ["#dcfce7", "#86efac"], emoji: "🤝" },
  카드: { grad: ["#ede9fe", "#c4b5fd"], emoji: "🃏" },
  추상: { grad: ["#dbeafe", "#7dd3fc"], emoji: "🔷" },
  경제: { grad: ["#ffedd5", "#fdba74"], emoji: "💰" },
  추리: { grad: ["#e5e7eb", "#9ca3af"], emoji: "🔍" },
  덱빌딩: { grad: ["#ede9fe", "#a78bfa"], emoji: "🎴" },
  엔진빌딩: { grad: ["#d1fae5", "#6ee7b7"], emoji: "⚙️" },
  워커플레이스먼트: { grad: ["#fef3c7", "#fcd34d"], emoji: "👷" },
  타일배치: { grad: ["#e0f2fe", "#7dd3fc"], emoji: "🧩" },
  다이스: { grad: ["#fee2e2", "#f87171"], emoji: "🎲" },
  순발력: { grad: ["#fef9c3", "#fde047"], emoji: "⚡" },
  단어: { grad: ["#ede9fe", "#c4b5fd"], emoji: "📝" },
  상상력: { grad: ["#fce7f3", "#f0abfc"], emoji: "💭" },
  정체은닉: { grad: ["#e5e7eb", "#6b7280"], emoji: "🎭" },
  레거시: { grad: ["#fef3c7", "#f59e0b"], emoji: "📜" },
  던전크롤러: { grad: ["#fee2e2", "#dc2626"], emoji: "⚔️" },
  트릭테이킹: { grad: ["#cffafe", "#67e8f9"], emoji: "🎯" },
  영역지배: { grad: ["#ffedd5", "#fb923c"], emoji: "🗺️" },
  경매: { grad: ["#fef3c7", "#eab308"], emoji: "💎" },
  프로그래밍: { grad: ["#ccfbf1", "#5eead4"], emoji: "🤖" },
  솔로: { grad: ["#f3f4f6", "#9ca3af"], emoji: "🧘" },
  "2인": { grad: ["#fce7f3", "#ec4899"], emoji: "👥" },
  "4X": { grad: ["#dbeafe", "#3b82f6"], emoji: "🌌" },
  워게임: { grad: ["#fee2e2", "#ef4444"], emoji: "⚔️" },
  어드벤처: { grad: ["#d1fae5", "#34d399"], emoji: "🗺️" },
  액션: { grad: ["#fee2e2", "#f87171"], emoji: "💥" },
  어린이: { grad: ["#fef3c7", "#fcd34d"], emoji: "🧸" },
  협상: { grad: ["#ede9fe", "#a78bfa"], emoji: "🤝" },
  확장: { grad: ["#f3f4f6", "#9ca3af"], emoji: "➕" },
};
const FALLBACK = { grad: ["#f3f4f6", "#d4d4d8"], emoji: "🎲" };
export const getGenreStyle = (genres) => {
  if (!genres || genres.length === 0) return FALLBACK;
  return GENRE_STYLE[genres[0]] || FALLBACK;
};
export { safeImageUrl };

function StarInput({ value, onChange }) {
  return (
    <View style={{ flexDirection: "row", gap: 6 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <TouchableOpacity key={n} onPress={() => onChange(n === value ? 0 : n)} hitSlop={8}>
          <Text style={{ fontSize: 30, color: n <= value ? COLORS.accent : "#e5e7eb" }}>★</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

export default function GameCard({ game, session, reviewSummary, onReviewSaved, cardWidth }) {
  const genreStyle = getGenreStyle(game.genre);
  const imageUrl = safeImageUrl(game.image_url);
  const [imgError, setImgError] = useState(false);

  const [expanded, setExpanded] = useState(false);
  const flipAnim = useRef(new Animated.Value(0)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  const [myReviews, setMyReviews] = useState(null);
  const [allReviews, setAllReviews] = useState(null);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [likesMap, setLikesMap] = useState({});

  const [totalScore, setTotalScore] = useState(0);
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const frontRotateY = flipAnim.interpolate({
    inputRange: [0, 180],
    outputRange: ["0deg", "180deg"],
  });
  const backRotateY = flipAnim.interpolate({
    inputRange: [0, 180],
    outputRange: ["180deg", "360deg"],
  });
  const frontOpacity = flipAnim.interpolate({
    inputRange: [0, 89, 90, 180],
    outputRange: [1, 1, 0, 0],
  });
  const backOpacity = flipAnim.interpolate({
    inputRange: [0, 89, 90, 180],
    outputRange: [0, 0, 1, 1],
  });

  const loadMyReviews = async () => {
    if (!session || myReviews !== null) return;
    setLoadingReviews(true);
    const { data } = await supabase
      .from("reviews")
      .select("*")
      .eq("game_id", game.id)
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });
    const rows = data || [];
    setMyReviews(rows);
    setShowForm(rows.length === 0);
    setLoadingReviews(false);
  };

  const loadAllReviews = async () => {
    const { data: rows } = await supabase
      .from("reviews")
      .select("id, user_id, total_score, memo, created_at")
      .eq("game_id", game.id)
      .not("total_score", "is", null)
      .order("created_at", { ascending: false })
      .limit(30);

    if (!rows || rows.length === 0) { setAllReviews([]); return; }

    const userIds = [...new Set(rows.map((r) => r.user_id))];
    const reviewIds = rows.map((r) => r.id);

    const [{ data: profiles }, { data: likes }] = await Promise.all([
      supabase.from("profiles").select("id, nickname").in("id", userIds),
      supabase.from("review_likes").select("review_id, user_id").in("review_id", reviewIds),
    ]);

    const nickMap = {};
    profiles?.forEach((p) => { nickMap[p.id] = p.nickname || "익명"; });

    const lMap = {};
    reviewIds.forEach((id) => { lMap[id] = { count: 0, likedByMe: false }; });
    likes?.forEach((l) => {
      if (lMap[l.review_id]) {
        lMap[l.review_id].count++;
        if (session && l.user_id === session.user.id) lMap[l.review_id].likedByMe = true;
      }
    });

    setAllReviews(rows.map((r) => ({ ...r, nickname: nickMap[r.user_id] || "익명" })));
    setLikesMap(lMap);
  };

  const openCard = () => {
    setExpanded(true);
    flipAnim.setValue(0);
    overlayAnim.setValue(0);
    loadMyReviews();
    loadAllReviews();
    requestAnimationFrame(() => {
      Animated.parallel([
        Animated.timing(overlayAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(flipAnim, { toValue: 180, duration: 700, useNativeDriver: true }),
      ]).start();
    });
  };

  const closeCard = () => {
    Animated.parallel([
      Animated.timing(overlayAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
      Animated.timing(flipAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start(() => {
      setExpanded(false);
      setMyReviews(null);
      setAllReviews(null);
      setLikesMap({});
      setTotalScore(0);
      setMemo("");
      setEditingId(null);
      setShowForm(false);
    });
  };

  const handleSave = async () => {
    if (!session || totalScore === 0) {
      Alert.alert("알림", "별점을 선택해주세요");
      return;
    }
    setSaving(true);
    const payload = { total_score: totalScore, memo: memo.trim() || null, rating_mode: "total" };
    let error;
    if (editingId) {
      ({ error } = await supabase.from("reviews").update(payload).eq("id", editingId).eq("user_id", session.user.id));
    } else {
      ({ error } = await supabase.from("reviews").insert({ ...payload, game_id: game.id, user_id: session.user.id }));
    }
    setSaving(false);
    if (error) {
      Alert.alert("오류", error.message);
    } else {
      onReviewSaved?.();
      closeCard();
    }
  };

  const handleDelete = (reviewId) => {
    Alert.alert("기록 삭제", "정말 삭제할까요?", [
      { text: "취소", style: "cancel" },
      {
        text: "삭제", style: "destructive", onPress: async () => {
          const { error } = await supabase.from("reviews").delete().eq("id", reviewId).eq("user_id", session.user.id);
          if (!error) {
            setMyReviews((prev) => prev?.filter((r) => r.id !== reviewId) ?? []);
            setAllReviews((prev) => prev?.filter((r) => r.id !== reviewId) ?? null);
            if (editingId === reviewId) { setEditingId(null); setTotalScore(0); setMemo(""); }
            onReviewSaved?.();
          }
        },
      },
    ]);
  };

  const toggleLike = async (reviewId) => {
    if (!session) { Alert.alert("로그인이 필요합니다"); return; }
    const cur = likesMap[reviewId] || { count: 0, likedByMe: false };
    const wasLiked = cur.likedByMe;
    setLikesMap((prev) => ({
      ...prev,
      [reviewId]: { count: wasLiked ? Math.max(0, cur.count - 1) : cur.count + 1, likedByMe: !wasLiked },
    }));
    const { error } = wasLiked
      ? await supabase.from("review_likes").delete().eq("review_id", reviewId).eq("user_id", session.user.id)
      : await supabase.from("review_likes").insert({ review_id: reviewId, user_id: session.user.id });
    if (error) setLikesMap((prev) => ({ ...prev, [reviewId]: cur }));
  };

  const w = cardWidth || (SW - 24 - 16) / 3;
  const imgH = w * 1.3;

  return (
    <>
      <TouchableOpacity onPress={openCard} activeOpacity={0.85} style={[s.card, { width: w }]}>
        <View style={[s.imgContainer, { height: imgH, backgroundColor: genreStyle.grad[0] }]}>
          {!imgError && imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={StyleSheet.absoluteFillObject}
              resizeMode="cover"
              onError={() => { console.warn("[이미지 로딩 실패]", imageUrl); setImgError(true); }}
            />
          ) : (
            <Text style={{ fontSize: 28 }}>{genreStyle.emoji}</Text>
          )}
          {game.genre?.length > 0 && (
            <View style={s.genreBadge}>
              <Text style={s.genreBadgeText}>
                {game.genre[0].length > 4 ? game.genre[0].slice(0, 4) + "…" : game.genre[0]}
              </Text>
            </View>
          )}
          {reviewSummary && (
            <View style={s.scoreBadge}>
              <Text style={s.scoreBadgeText}>
                {reviewSummary.latestScore ? `⭐ ${reviewSummary.latestScore.toFixed(1)}` : `⭐ ${reviewSummary.count}회`}
              </Text>
            </View>
          )}
        </View>
        <View style={s.cardInfo}>
          <Text style={s.cardName} numberOfLines={1}>{game.name_ko || game.name_en}</Text>
          <Text style={s.cardSub} numberOfLines={1}>
            {[
              game.min_players ? `👥${game.min_players}~${game.max_players}` : null,
              game.play_minutes ? `⏱${game.play_minutes}분` : null,
            ].filter(Boolean).join(" ")}
          </Text>
        </View>
      </TouchableOpacity>

      <Modal visible={expanded} transparent statusBarTranslucent>
        <Animated.View style={[s.backdrop, { opacity: overlayAnim }]}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={closeCard} activeOpacity={1} />
        </Animated.View>

        <View style={s.modalWrapper} pointerEvents="box-none">
          {/* 앞면 */}
          <Animated.View style={[s.face, {
            transform: [{ perspective: 1200 }, { rotateY: frontRotateY }],
            opacity: frontOpacity,
            backgroundColor: genreStyle.grad[0],
          }]}>
            {!imgError && imageUrl ? (
              <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
            ) : (
              <Text style={{ fontSize: 100 }}>{genreStyle.emoji}</Text>
            )}
          </Animated.View>

          {/* 뒷면 */}
          <Animated.View style={[s.face, {
            transform: [{ perspective: 1200 }, { rotateY: backRotateY }],
            opacity: backOpacity,
            backgroundColor: COLORS.surface,
          }]}>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
              {/* 헤더 */}
              <View style={s.backHeader}>
                <Text style={s.backTitle} numberOfLines={1}>{game.name_ko || game.name_en}</Text>
                <TouchableOpacity onPress={closeCard} style={s.closeBtn}>
                  <Text style={{ color: COLORS.sub, fontSize: 16 }}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* 게임 정보 */}
              <View style={[s.gameInfoRow, { backgroundColor: genreStyle.grad[0] + "55" }]}>
                <View style={[s.gameThumb, { backgroundColor: genreStyle.grad[0] }]}>
                  {!imgError && imageUrl ? (
                    <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                  ) : (
                    <Text style={{ fontSize: 32 }}>{genreStyle.emoji}</Text>
                  )}
                </View>
                <View style={{ flex: 1, gap: 5 }}>
                  {game.name_en ? <Text style={s.nameEn} numberOfLines={1}>{game.name_en}</Text> : null}
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
                    {game.genre?.map((g) => (
                      <View key={g} style={s.genreChip}>
                        <Text style={s.genreChipText}>{g}</Text>
                      </View>
                    ))}
                  </View>
                  <Text style={s.gameMetaText}>
                    {[
                      game.min_players && `👥 ${game.min_players}~${game.max_players}인`,
                      game.play_minutes && `⏱ ${game.play_minutes}분`,
                    ].filter(Boolean).join("  ")}
                  </Text>
                </View>
              </View>

              {/* 내 기록 */}
              {session && (
                <View style={s.formSection}>
                  <View style={s.sectionHeaderRow}>
                    <Text style={s.sectionTitle}>내 기록</Text>
                    {myReviews?.length > 0 && !showForm && (
                      <TouchableOpacity onPress={() => setShowForm(true)}>
                        <Text style={{ fontSize: 12, color: COLORS.accent, fontWeight: "700" }}>+ 새 기록</Text>
                      </TouchableOpacity>
                    )}
                  </View>

                  {loadingReviews ? (
                    <ActivityIndicator size="small" color={COLORS.accent} />
                  ) : (
                    <>
                      {myReviews?.map((r) => (
                        <View key={r.id} style={s.myReviewItem}>
                          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                            <Text style={{ color: COLORS.accent, fontWeight: "700" }}>⭐ {Number(r.total_score).toFixed(1)}</Text>
                            <Text style={{ fontSize: 11, color: COLORS.subLight }}>{r.created_at?.slice(0, 10)}</Text>
                          </View>
                          {r.memo ? <Text style={s.reviewMemo}>{r.memo}</Text> : null}
                          <View style={{ flexDirection: "row", gap: 12, marginTop: 6 }}>
                            <TouchableOpacity onPress={() => {
                              setEditingId(r.id);
                              setTotalScore(r.total_score || 0);
                              setMemo(r.memo || "");
                              setShowForm(true);
                            }}>
                              <Text style={{ fontSize: 12, color: COLORS.sub }}>수정</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleDelete(r.id)}>
                              <Text style={{ fontSize: 12, color: COLORS.error }}>삭제</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ))}

                      {showForm && (
                        <View style={s.writeForm}>
                          <Text style={s.formLabel}>⭐ 별점 <Text style={{ color: COLORS.accent }}>필수</Text></Text>
                          <StarInput value={totalScore} onChange={setTotalScore} />
                          <Text style={[s.scoreDisplay, { color: totalScore > 0 ? COLORS.accent : COLORS.subLight }]}>
                            {totalScore > 0 ? `${totalScore}.0 / 5` : "별을 선택해주세요"}
                          </Text>
                          <TextInput
                            value={memo}
                            onChangeText={setMemo}
                            placeholder="한 줄 감상을 남겨보세요 (선택)"
                            placeholderTextColor={COLORS.subLight}
                            style={s.memoInput}
                            multiline
                          />
                          <TouchableOpacity
                            onPress={handleSave}
                            disabled={saving || totalScore === 0}
                            style={[s.saveBtn, (saving || totalScore === 0) && { opacity: 0.5 }]}
                          >
                            {saving ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <Text style={s.saveBtnText}>{editingId ? "수정 완료" : "기록하기"}</Text>
                            )}
                          </TouchableOpacity>
                        </View>
                      )}
                    </>
                  )}
                </View>
              )}

              {/* 전체 리뷰 */}
              <View style={{ marginTop: 8 }}>
                <Text style={[s.sectionTitle, { marginBottom: 8 }]}>모든 기록</Text>
                {allReviews === null ? (
                  <ActivityIndicator size="small" color={COLORS.accent} />
                ) : allReviews.length === 0 ? (
                  <Text style={s.emptyText}>아직 기록이 없어요</Text>
                ) : (
                  allReviews.map((r) => (
                    <View key={r.id} style={s.reviewItem}>
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <Text style={s.reviewNick}>{r.nickname}</Text>
                        <Text style={{ color: COLORS.accent, fontWeight: "700", fontSize: 13 }}>⭐ {Number(r.total_score).toFixed(1)}</Text>
                      </View>
                      {r.memo ? <Text style={s.reviewMemo}>{r.memo}</Text> : null}
                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
                        <Text style={{ fontSize: 11, color: COLORS.subLight }}>{r.created_at?.slice(0, 10)}</Text>
                        <TouchableOpacity onPress={() => toggleLike(r.id)} hitSlop={8}>
                          <Text style={{ color: likesMap[r.id]?.likedByMe ? COLORS.accent : COLORS.subLight, fontSize: 14 }}>
                            {likesMap[r.id]?.likedByMe ? "♥" : "♡"} {likesMap[r.id]?.count || 0}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  imgContainer: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  genreBadge: {
    position: "absolute",
    top: 5,
    left: 5,
    backgroundColor: "rgba(255,255,255,0.85)",
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  genreBadgeText: { fontSize: 8, fontWeight: "700", color: COLORS.text },
  scoreBadge: {
    position: "absolute",
    top: 5,
    right: 5,
    backgroundColor: "rgba(255,107,53,0.88)",
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  scoreBadgeText: { fontSize: 8, fontWeight: "700", color: "#fff" },
  cardInfo: { padding: 6 },
  cardName: { fontSize: 10, fontWeight: "700", color: COLORS.text, marginBottom: 2 },
  cardSub: { fontSize: 9, color: COLORS.sub },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)" },
  modalWrapper: {
    position: "absolute",
    top: SH * 0.07,
    left: SW * 0.04,
    right: SW * 0.04,
    height: SH * 0.86,
  },
  face: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 20,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  backHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  backTitle: { flex: 1, fontSize: 17, fontWeight: "800", color: COLORS.text, marginRight: 8 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 8,
    borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
    alignItems: "center", justifyContent: "center",
  },
  gameInfoRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  gameThumb: {
    width: 64, height: 64,
    borderRadius: 10,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  nameEn: { fontSize: 11, color: COLORS.subLight },
  genreChip: {
    backgroundColor: "rgba(0,0,0,0.07)",
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  genreChipText: { fontSize: 10, fontWeight: "700", color: COLORS.text },
  gameMetaText: { fontSize: 12, color: COLORS.sub },
  formSection: {
    marginBottom: 12,
    padding: 14,
    backgroundColor: COLORS.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 14, fontWeight: "800", color: COLORS.text },
  myReviewItem: {
    padding: 10,
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 8,
  },
  writeForm: { marginTop: 8, gap: 10 },
  formLabel: { fontSize: 13, fontWeight: "700", color: COLORS.text },
  scoreDisplay: { fontSize: 14, fontWeight: "700", textAlign: "center" },
  memoInput: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    padding: 10,
    fontSize: 13,
    color: COLORS.text,
    minHeight: 60,
    backgroundColor: COLORS.surface,
    textAlignVertical: "top",
  },
  saveBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  saveBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  reviewItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  reviewNick: { fontSize: 12, fontWeight: "700", color: COLORS.text },
  reviewMemo: { fontSize: 13, color: "#404040", lineHeight: 20, marginTop: 4 },
  emptyText: { fontSize: 13, color: COLORS.subLight, textAlign: "center", padding: 16 },
});
