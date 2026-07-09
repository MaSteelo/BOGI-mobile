import React, { useState, useRef } from "react";
import {
  View, Text, Image, TouchableOpacity, Modal,
  Animated, ScrollView, TextInput, StyleSheet,
  ActivityIndicator, Alert, Dimensions, Easing,
  KeyboardAvoidingView, Platform,
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

const DETAIL_FIELDS = [
  { key: "story",         label: "스토리",  col: "story_rating"        },
  { key: "difficulty",    label: "난이도",  col: "difficulty_rating"   },
  { key: "replayability", label: "리플레이",col: "replay_rating"       },
  { key: "quality",       label: "품질",    col: "quality_rating"      },
  { key: "convenience",   label: "편의",    col: "convenience_rating"  },
];

const REPORT_REASONS = ["스팸/광고", "욕설/비하", "스포일러", "게임과 관련 없는 내용", "기타"];

function SmallStarInput({ value, onChange }) {
  return (
    <View style={{ flexDirection: "row", gap: 4 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <TouchableOpacity key={n} onPress={() => onChange(n === value ? 0 : n)} hitSlop={6}>
          <Text style={{ fontSize: 22, color: n <= value ? COLORS.accent : "#e5e7eb" }}>★</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function ReportModal({ reviewId, session, onClose }) {
  const [reason, setReason] = useState("");
  const [detail, setDetail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleReport = async () => {
    if (!reason) return;
    setSubmitting(true);
    const { error } = await supabase.from("reports").insert({
      review_id:   reviewId,
      reporter_id: session.user.id,
      reason,
      detail: detail.trim() || null,
    });
    setSubmitting(false);
    if (error && error.code !== "23505") {
      Alert.alert("오류", error.message);
    } else {
      setDone(true);
    }
  };

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "center", alignItems: "center", padding: 20 }}>
        <View style={{ backgroundColor: "#fff", borderRadius: 16, width: "100%", maxWidth: 340, padding: 24 }}>
          {done ? (
            <View style={{ alignItems: "center", paddingVertical: 16 }}>
              <Text style={{ fontSize: 36, marginBottom: 12 }}>✅</Text>
              <Text style={{ fontWeight: "800", fontSize: 15, color: COLORS.text, marginBottom: 6 }}>신고가 접수되었습니다</Text>
              <Text style={{ fontSize: 12, color: COLORS.sub, marginBottom: 20 }}>검토 후 조치가 이루어집니다.</Text>
              <TouchableOpacity onPress={onClose} style={{ backgroundColor: COLORS.accent, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 32 }}>
                <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>확인</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={{ fontWeight: "800", fontSize: 15, color: COLORS.text, marginBottom: 16 }}>리뷰 신고</Text>
              {REPORT_REASONS.map((r) => (
                <TouchableOpacity key={r} onPress={() => setReason(r)} style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 }}>
                  <View style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: reason === r ? COLORS.accent : COLORS.border, alignItems: "center", justifyContent: "center" }}>
                    {reason === r && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.accent }} />}
                  </View>
                  <Text style={{ fontSize: 13, color: COLORS.text }}>{r}</Text>
                </TouchableOpacity>
              ))}
              {reason === "기타" && (
                <TextInput
                  value={detail}
                  onChangeText={setDetail}
                  placeholder="기타 사유를 입력해주세요"
                  placeholderTextColor={COLORS.subLight}
                  multiline
                  style={{ backgroundColor: "#fafafa", borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, padding: 10, fontSize: 13, minHeight: 72, textAlignVertical: "top", marginBottom: 14 }}
                />
              )}
              <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                <TouchableOpacity onPress={onClose} style={{ flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, paddingVertical: 11, alignItems: "center" }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: COLORS.sub }}>취소</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleReport} disabled={!reason || submitting} style={{ flex: 2, backgroundColor: !reason || submitting ? "#e5e7eb" : COLORS.error, borderRadius: 10, paddingVertical: 11, alignItems: "center" }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: !reason || submitting ? COLORS.sub : "#fff" }}>
                    {submitting ? "처리 중..." : "신고하기"}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

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

function EditField({ label, value, onChangeText, placeholder, keyboardType, autoCapitalize, autoCorrect, multiline }) {
  return (
    <View style={s.editFieldBlock}>
      <Text style={s.editFieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder || ""}
        placeholderTextColor={COLORS.subLight}
        style={[s.editFieldInput, multiline && { minHeight: 72, textAlignVertical: "top" }]}
        keyboardType={keyboardType || "default"}
        autoCapitalize={autoCapitalize ?? "none"}
        autoCorrect={autoCorrect ?? false}
        multiline={multiline}
      />
    </View>
  );
}

export default function GameCard({ game, session, reviewSummary, gameStat, onReviewSaved, cardWidth }) {
  const genreStyle = getGenreStyle(game.genre);
  const imageUrl = safeImageUrl(game.image_url);
  const [imgError, setImgError] = useState(false);

  const [expanded, setExpanded] = useState(false);
  const flipAnim = useRef(new Animated.Value(0)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.2)).current;

  const cardOpacity = scaleAnim.interpolate({
    inputRange: [0.2, 0.6],
    outputRange: [0, 1],
    extrapolate: "clamp",
  });

  // 기록 상태
  const [myReviews, setMyReviews] = useState(null);
  const [allReviews, setAllReviews] = useState(null);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [allReviewsLoading, setAllReviewsLoading] = useState(false);
  const [likesMap, setLikesMap] = useState({});
  const [reviewsShowCount, setReviewsShowCount] = useState(10);

  const [totalScore, setTotalScore] = useState(0);
  const [detailScores, setDetailScores] = useState({ story: 0, difficulty: 0, replayability: 0, quality: 0, convenience: 0 });
  const [detailExpanded, setDetailExpanded] = useState(false);
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [reportingReviewId, setReportingReviewId] = useState(null);

  // 편집 패널 상태 (별도 Modal 없이 플립 Modal 내부 오버레이로 렌더링)
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [editNameKo, setEditNameKo] = useState("");
  const [editNameEn, setEditNameEn] = useState("");
  const [editGenre, setEditGenre] = useState("");
  const [editPlayers, setEditPlayers] = useState("");
  const [editMinutes, setEditMinutes] = useState("");
  const [editMinAge, setEditMinAge] = useState("");
  const [editImageUrl, setEditImageUrl] = useState("");
  const [editImageValid, setEditImageValid] = useState(null);
  const [editSaving, setEditSaving] = useState(false);

  const frontRotateY = flipAnim.interpolate({ inputRange: [0, 180], outputRange: ["0deg", "180deg"] });
  const backRotateY = flipAnim.interpolate({ inputRange: [0, 180], outputRange: ["180deg", "360deg"] });
  const frontOpacity = flipAnim.interpolate({ inputRange: [0, 89, 90, 180], outputRange: [1, 1, 0, 0] });
  const backOpacity = flipAnim.interpolate({ inputRange: [0, 89, 90, 180], outputRange: [0, 0, 1, 1] });

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
    setAllReviewsLoading(true);
    const { data: rows } = await supabase
      .from("reviews")
      .select("id, user_id, total_score, memo, created_at, story_rating, difficulty_rating, replay_rating, quality_rating, convenience_rating")
      .eq("game_id", game.id)
      .not("total_score", "is", null)
      .order("created_at", { ascending: false })
      .limit(50);

    if (!rows || rows.length === 0) {
      setAllReviews([]);
      setAllReviewsLoading(false);
      return;
    }

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
    setAllReviewsLoading(false);
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

  const openCard = () => {
    setExpanded(true);
    scaleAnim.setValue(0.2);
    flipAnim.setValue(0);
    overlayAnim.setValue(0);
    loadMyReviews();
    loadAllReviews();
    requestAnimationFrame(() => {
      Animated.parallel([
        Animated.timing(overlayAnim, { toValue: 1, duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(scaleAnim, { toValue: 1, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(flipAnim, { toValue: 180, duration: 600, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]).start();
    });
  };

  const closeCard = () => {
    Animated.parallel([
      Animated.timing(overlayAnim, { toValue: 0, duration: 300, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 0.2, duration: 400, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(flipAnim, { toValue: 0, duration: 400, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
    ]).start(() => {
      setExpanded(false);
      scaleAnim.setValue(0.2);
      setMyReviews(null);
      setAllReviews(null);
      setAllReviewsLoading(false);
      setLikesMap({});
      setReviewsShowCount(10);
      setTotalScore(0);
      setDetailScores({ story: 0, difficulty: 0, replayability: 0, quality: 0, convenience: 0 });
      setDetailExpanded(false);
      setMemo("");
      setEditingId(null);
      setShowForm(false);
      setConfirmDeleteId(null);
      setShowEditPanel(false);
    });
  };

  const openEditPanel = () => {
    if (!session) { Alert.alert("알림", "로그인이 필요합니다"); return; }
    setEditNameKo(game.name_ko || "");
    setEditNameEn(game.name_en || "");
    setEditGenre(game.genre?.join(", ") || "");
    if (game.min_players != null) {
      setEditPlayers(
        game.min_players === game.max_players
          ? String(game.min_players)
          : `${game.min_players}~${game.max_players}`
      );
    } else {
      setEditPlayers("");
    }
    setEditMinutes(game.play_minutes != null ? String(game.play_minutes) : "");
    setEditMinAge(game.min_age != null ? String(game.min_age) : "");
    setEditImageUrl(game.image_url || "");
    setEditImageValid(null);
    setEditSaving(false);
    setShowEditPanel(true);
  };

  const closeEditPanel = () => setShowEditPanel(false);

  const submitEdit = async () => {
    if (!session) { Alert.alert("알림", "로그인이 필요합니다"); return; }
    setEditSaving(true);

    const rows = [];

    const push = (key, newVal, oldVal) => {
      const nv = String(newVal ?? "").trim();
      const ov = oldVal == null ? "" : String(oldVal).trim();
      if (nv && nv !== ov) {
        rows.push({
          game_id: game.id,
          proposed_by: session.user.id,
          field: key,
          old_value: ov || null,
          new_value: nv,
          status: "pending",
        });
      }
    };

    push("name_ko", editNameKo, game.name_ko);
    push("name_en", editNameEn, game.name_en);

    const genreVal = editGenre.trim();
    const genreOld = game.genre?.join(", ") ?? "";
    if (genreVal && genreVal !== genreOld) {
      const genreArr = genreVal.split(",").map((s) => s.trim()).filter(Boolean);
      rows.push({
        game_id: game.id,
        proposed_by: session.user.id,
        field: "genre",
        old_value: game.genre ? JSON.stringify(game.genre) : null,
        new_value: JSON.stringify(genreArr),
        status: "pending",
      });
    }

    const playerVal = editPlayers.trim();
    if (playerVal) {
      const match = playerVal.match(/^(\d+)(?:~(\d+))?$/);
      if (match) {
        push("min_players", match[1], game.min_players);
        push("max_players", match[2] || match[1], game.max_players);
      }
    }

    push("play_minutes", editMinutes, game.play_minutes);
    push("min_age", editMinAge, game.min_age);

    if (editImageUrl.trim() && editImageUrl.trim() !== (game.image_url ?? "")) {
      if (!editImageUrl.startsWith("https://")) {
        Alert.alert("알림", "이미지 URL은 https://로 시작해야 해요");
        setEditSaving(false);
        return;
      }
      rows.push({
        game_id: game.id,
        proposed_by: session.user.id,
        field: "image_url",
        old_value: game.image_url || null,
        new_value: editImageUrl.trim(),
        status: "pending",
      });
    }

    if (rows.length === 0) {
      Alert.alert("알림", "변경된 내용이 없어요");
      setEditSaving(false);
      return;
    }

    console.log("[GameCard] game_edits INSERT 시도 — rows:", rows.length, rows.map((r) => r.field));
    const { error } = await supabase.from("game_edits").insert(rows);
    console.log("[GameCard] game_edits INSERT 결과 — error:", error?.message ?? "없음", "code:", error?.code ?? "-");
    setEditSaving(false);
    if (error) {
      Alert.alert("오류", error.message);
    } else {
      Alert.alert("✅ 수정 제안이 등록되었습니다", "관리자 검토 후 반영됩니다");
      closeEditPanel();
    }
  };

  const handleSave = async () => {
    if (!session || totalScore === 0) { Alert.alert("알림", "별점을 선택해주세요"); return; }
    setSaving(true);
    const payload = {
      total_score:         totalScore,
      memo:                memo.trim() || null,
      rating_mode:         "total",
      story_rating:        detailScores.story        || null,
      difficulty_rating:   detailScores.difficulty   || null,
      replay_rating:       detailScores.replayability|| null,
      quality_rating:      detailScores.quality      || null,
      convenience_rating:  detailScores.convenience  || null,
    };
    let error;
    if (editingId) {
      ({ error } = await supabase.from("reviews").update(payload).eq("id", editingId).eq("user_id", session.user.id));
    } else {
      ({ error } = await supabase.from("reviews").insert({ ...payload, game_id: game.id, user_id: session.user.id }));
    }
    setSaving(false);
    if (error) { Alert.alert("오류", error.message); }
    else { onReviewSaved?.(); closeCard(); }
  };

  const handleDelete = async (reviewId) => {
    const { error } = await supabase.from("reviews").delete().eq("id", reviewId).eq("user_id", session.user.id);
    if (error) { Alert.alert("오류", error.message); return; }
    setConfirmDeleteId(null);
    const updated = (myReviews || []).filter((r) => r.id !== reviewId);
    setMyReviews(updated);
    setAllReviews((prev) => prev ? prev.filter((r) => r.id !== reviewId) : prev);
    if (editingId === reviewId) { setEditingId(null); setTotalScore(0); setMemo(""); }
    if (updated.length === 0) setShowForm(true);
    onReviewSaved?.();
  };

  const w = cardWidth || (SW - 24 - 16) / 3;
  const imgH = w * 1.3;

  return (
    <>
      {/* ── 그리드 카드 ── */}
      <TouchableOpacity onPress={openCard} activeOpacity={0.85} style={[s.card, { width: w }]}>
        <View style={[s.imgContainer, { height: imgH, backgroundColor: genreStyle.grad[0] }]}>
          {!imgError && imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={StyleSheet.absoluteFillObject}
              resizeMode="cover"
              onError={() => { setImgError(true); }}
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
          {gameStat ? (
            <View style={s.statRow}>
              <Text style={s.statAvg}>⭐ {gameStat.avg.toFixed(1)}</Text>
              <Text style={s.statCount}> ({gameStat.count})</Text>
            </View>
          ) : (
            <Text style={s.cardSub} numberOfLines={1}>
              {[
                game.min_players ? `👥${game.min_players}~${game.max_players}` : null,
                game.play_minutes ? `⏱${game.play_minutes}분` : null,
              ].filter(Boolean).join(" ")}
            </Text>
          )}
        </View>
      </TouchableOpacity>

      {/* ── 플립 모달 ── */}
      <Modal visible={expanded} transparent statusBarTranslucent>
        <Animated.View style={[s.backdrop, { opacity: overlayAnim }]}>
          <TouchableOpacity style={StyleSheet.absoluteFillObject} onPress={closeCard} activeOpacity={1} />
        </Animated.View>

        <View style={s.modalWrapper} pointerEvents="box-none">
          <Animated.View style={[
            StyleSheet.absoluteFillObject,
            { transform: [{ scale: scaleAnim }], opacity: cardOpacity },
          ]}>
            {/* 앞면 */}
            <Animated.View style={[s.face, {
              transform: [{ perspective: 1000 }, { rotateY: frontRotateY }],
              opacity: frontOpacity,
              backfaceVisibility: "hidden",
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
              transform: [{ perspective: 1000 }, { rotateY: backRotateY }],
              opacity: backOpacity,
              backfaceVisibility: "hidden",
              backgroundColor: COLORS.surface,
              alignItems: "stretch",
              justifyContent: "flex-start",
            }]}>
              {/* 상단 밴드 */}
              <View style={[s.backTopBand, { backgroundColor: genreStyle.grad[0] }]}>
                <View style={[s.backTopThumb, { backgroundColor: genreStyle.grad[1] }]}>
                  {!imgError && imageUrl ? (
                    <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                  ) : (
                    <Text style={{ fontSize: 36 }}>{genreStyle.emoji}</Text>
                  )}
                </View>
                <View style={s.backTopInfo}>
                  <Text style={s.backTopName} numberOfLines={2}>{game.name_ko || game.name_en}</Text>
                  {game.name_en && game.name_ko && game.name_ko !== game.name_en && (
                    <Text style={s.backTopNameEn} numberOfLines={1}>{game.name_en}</Text>
                  )}
                </View>
              </View>

              {/* 하단 스크롤 */}
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={s.backScrollContent}
                keyboardShouldPersistTaps="handled"
              >
                {/* 헤더 */}
                <View style={s.backContentHeader}>
                  <Text style={s.backContentTitle} numberOfLines={1}>{game.name_ko || game.name_en}</Text>
                  <TouchableOpacity onPress={closeCard} style={s.closeBtn}>
                    <Text style={{ color: COLORS.sub, fontSize: 16 }}>✕</Text>
                  </TouchableOpacity>
                </View>

                {/* 내 기록 섹션 */}
                {session && (
                  <View style={s.sectionBox}>
                    <View style={s.sectionHeaderRow}>
                      <Text style={s.sectionTitle}>내 기록</Text>
                    </View>

                    {loadingReviews ? (
                      <ActivityIndicator size="small" color={COLORS.accent} />
                    ) : (
                      <>
                        {myReviews?.map((r) => {
                          if (confirmDeleteId === r.id) {
                            return (
                              <View key={r.id} style={s.deleteConfirmBox}>
                                <Text style={s.deleteConfirmText}>정말 삭제할까요?{"\n"}되돌릴 수 없어요.</Text>
                                <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                                  <TouchableOpacity onPress={() => setConfirmDeleteId(null)} style={s.deleteCancelBtn}>
                                    <Text style={{ color: COLORS.sub, fontWeight: "700", fontSize: 12 }}>취소</Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity onPress={() => handleDelete(r.id)} style={s.deleteBtn}>
                                    <Text style={{ color: "#fff", fontWeight: "700", fontSize: 12 }}>삭제</Text>
                                  </TouchableOpacity>
                                </View>
                              </View>
                            );
                          }
                          return (
                            <View key={r.id} style={[s.myReviewItem, editingId === r.id && s.myReviewItemEditing]}>
                              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                                <Text style={{ fontSize: 11, color: COLORS.sub }}>{r.created_at?.slice(0, 10)}</Text>
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                  <Text style={{ color: COLORS.accent, fontWeight: "700", fontSize: 11 }}>★ {Number(r.total_score).toFixed(1)}</Text>
                                  <TouchableOpacity
                                    onPress={() => {
                                      setEditingId(r.id);
                                      setTotalScore(r.total_score || 0);
                                      setMemo(r.memo || "");
                                      setDetailScores({
                                        story:         r.story_rating        || 0,
                                        difficulty:    r.difficulty_rating   || 0,
                                        replayability: r.replay_rating       || 0,
                                        quality:       r.quality_rating      || 0,
                                        convenience:   r.convenience_rating  || 0,
                                      });
                                      setDetailExpanded(!!(r.story_rating || r.difficulty_rating || r.replay_rating || r.quality_rating || r.convenience_rating));
                                      setShowForm(true);
                                    }}
                                    hitSlop={6}
                                  >
                                    <Text style={{ fontSize: 13 }}>✏️</Text>
                                  </TouchableOpacity>
                                  <TouchableOpacity onPress={() => setConfirmDeleteId(r.id)} hitSlop={6}>
                                    <Text style={{ fontSize: 13 }}>🗑️</Text>
                                  </TouchableOpacity>
                                </View>
                              </View>
                              {r.memo ? <Text style={s.reviewMemo}>{r.memo}</Text> : null}
                            </View>
                          );
                        })}

                        {!showForm && myReviews?.length > 0 && (
                          <TouchableOpacity
                            style={s.addRecordBtn}
                            onPress={() => { setEditingId(null); setTotalScore(0); setMemo(""); setShowForm(true); }}
                          >
                            <Text style={s.addRecordBtnText}>+ 새 기록 추가</Text>
                          </TouchableOpacity>
                        )}

                        {showForm && (
                          <View style={s.writeFormBox}>
                            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                              <Text style={{ fontSize: 13, fontWeight: "800", color: COLORS.text }}>
                                {editingId ? "기록 수정하기" : "새 기록 추가"}
                              </Text>
                              <TouchableOpacity onPress={() => { setShowForm(false); setEditingId(null); setTotalScore(0); setMemo(""); setDetailScores({ story: 0, difficulty: 0, replayability: 0, quality: 0, convenience: 0 }); setDetailExpanded(false); }}>
                                <Text style={s.cancelBtnText}>취소</Text>
                              </TouchableOpacity>
                            </View>
                            <View style={s.starBox}>
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 }}>
                                <Text style={{ fontSize: 12, fontWeight: "700", color: COLORS.sub }}>⭐ 총점</Text>
                                <View style={{ backgroundColor: COLORS.accentLight, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4 }}>
                                  <Text style={{ fontSize: 10, color: COLORS.accent, fontWeight: "700" }}>필수</Text>
                                </View>
                              </View>
                              <StarInput value={totalScore} onChange={setTotalScore} />
                              <Text style={[s.scoreDisplay, { color: totalScore > 0 ? COLORS.accent : COLORS.subLight }]}>
                                {totalScore > 0 ? `${totalScore}.0 / 5` : "별을 선택해주세요"}
                              </Text>
                            </View>
                            {/* 세부 별점 */}
                            <View style={{ marginBottom: 12 }}>
                              <TouchableOpacity onPress={() => setDetailExpanded((v) => !v)} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4 }}>
                                <Text style={{ fontSize: 12, fontWeight: "600", color: COLORS.sub }}>세부 별점</Text>
                                <Text style={{ fontSize: 10, color: COLORS.subLight }}>선택</Text>
                                <Text style={{ fontSize: 10, color: COLORS.sub }}>{detailExpanded ? "▲" : "▼"}</Text>
                              </TouchableOpacity>
                              {detailExpanded && (
                                <View style={{ marginTop: 8, padding: 12, backgroundColor: "#fafafa", borderRadius: 10, borderWidth: 1, borderColor: COLORS.border }}>
                                  <Text style={{ fontSize: 11, color: COLORS.subLight, marginBottom: 10 }}>세부 별점은 통계에 반영되지 않습니다.</Text>
                                  {DETAIL_FIELDS.map(({ key, label }) => (
                                    <View key={key} style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 }}>
                                      <Text style={{ fontSize: 12, color: COLORS.sub, fontWeight: "600", width: 52 }}>{label}</Text>
                                      <SmallStarInput value={detailScores[key]} onChange={(v) => setDetailScores((prev) => ({ ...prev, [key]: v }))} />
                                    </View>
                                  ))}
                                </View>
                              )}
                            </View>
                            <TextInput
                              value={memo}
                              onChangeText={setMemo}
                              placeholder="후기, 전략, 감상을 자유롭게 기록해요"
                              placeholderTextColor={COLORS.subLight}
                              style={s.memoInput}
                              multiline
                            />
                            <TouchableOpacity
                              onPress={handleSave}
                              disabled={saving || totalScore === 0}
                              style={[s.saveBtn, (saving || totalScore === 0) && { opacity: 0.45 }]}
                            >
                              {saving
                                ? <ActivityIndicator size="small" color="#fff" />
                                : <Text style={s.saveBtnText}>{editingId ? "수정하기" : "기록 저장하기"}</Text>
                              }
                            </TouchableOpacity>
                          </View>
                        )}

                        {!showForm && (!myReviews || myReviews.length === 0) && (
                          <TouchableOpacity style={s.firstRecordBtn} onPress={() => setShowForm(true)}>
                            <Text style={s.firstRecordBtnText}>⭐ 이 게임의 첫 기록을 남겨보세요!</Text>
                          </TouchableOpacity>
                        )}
                      </>
                    )}
                  </View>
                )}

                {/* 게임 정보 섹션 */}
                <View style={s.gameInfoSection}>
                  {game.genre?.length > 0 && (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4, marginBottom: 10 }}>
                      {game.genre.map((g) => (
                        <View key={g} style={s.genreChip}>
                          <Text style={s.genreChipText}>{g}</Text>
                        </View>
                      ))}
                    </View>
                  )}
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 6 }}>
                    {game.min_players != null && (
                      <Text style={s.metaText}>👥 {game.min_players}~{game.max_players}인</Text>
                    )}
                    {game.play_minutes != null && (
                      <Text style={s.metaText}>⏱ {game.play_minutes}분</Text>
                    )}
                    {game.min_age != null && (
                      <Text style={s.metaText}>🔞 {game.min_age}세+</Text>
                    )}
                    {game.publisher && (
                      <Text style={s.metaText}>🏢 {game.publisher}</Text>
                    )}
                  </View>
                  {game.bgg_rank != null && (
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <View style={s.bggBadge}>
                        <Text style={s.bggBadgeText}>BGG #{game.bgg_rank}</Text>
                      </View>
                      {gameStat && (
                        <Text style={{ fontSize: 11, color: COLORS.accent, fontWeight: "700" }}>
                          ★ {gameStat.avg.toFixed(1)}
                        </Text>
                      )}
                    </View>
                  )}
                  {gameStat && game.bgg_rank == null && (
                    <View style={s.communityRatingRow}>
                      <Text style={s.communityRatingText}>★ {gameStat.avg.toFixed(1)}</Text>
                      <Text style={s.communityRatingCount}> · {gameStat.count}명 평가</Text>
                    </View>
                  )}
                  {game.description ? (
                    <Text style={s.descText} numberOfLines={4}>{game.description}</Text>
                  ) : null}
                </View>

                {/* 게임 설정 편집 버튼 */}
                {session && (
                  <TouchableOpacity
                    style={s.editGameBtn}
                    onPress={openEditPanel}
                    activeOpacity={0.7}
                  >
                    <Text style={s.editGameBtnText}>✏️ 게임 설정 편집</Text>
                  </TouchableOpacity>
                )}

                {/* 구분선 */}
                <View style={s.divider} />

                {/* 다른 사람 리뷰 */}
                {(() => {
                  if (allReviews === null) return null;
                  const scores = allReviews.filter((r) => r.total_score > 0).map((r) => r.total_score);
                  const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
                  const others = session ? allReviews.filter((r) => r.user_id !== session.user.id) : allReviews;
                  const visibleReviews = others.slice(0, reviewsShowCount);
                  return (
                    <View style={s.sectionBox}>
                      <View style={s.sectionHeaderRow}>
                        <Text style={s.sectionTitle}>다른 사람 리뷰</Text>
                        {avg !== null && (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                            <Text style={{ color: COLORS.accent, fontWeight: "700", fontSize: 12 }}>★ {avg.toFixed(1)}</Text>
                            <Text style={{ color: COLORS.subLight, fontSize: 11 }}>· {allReviews.length}개</Text>
                          </View>
                        )}
                      </View>
                      {(() => {
                        const hasAny = DETAIL_FIELDS.some(({ col }) => allReviews.some((r) => r[col]));
                        return (
                          <View style={{ backgroundColor: COLORS.bg, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, padding: 12, marginBottom: 12 }}>
                            <Text style={{ fontSize: 11, fontWeight: "700", color: COLORS.sub, marginBottom: 8 }}>세부 별점 평균</Text>
                            {!hasAny ? (
                              <Text style={{ fontSize: 12, color: COLORS.subLight, textAlign: "center" }}>세부 별점 데이터가 없습니다</Text>
                            ) : (
                              DETAIL_FIELDS.map(({ key, label, col }) => {
                                const vals = allReviews.map((r) => r[col]).filter(Boolean);
                                if (vals.length === 0) return null;
                                const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
                                return (
                                  <View key={key} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
                                    <Text style={{ fontSize: 11, color: COLORS.sub, width: 44 }}>{label}</Text>
                                    <View style={{ flex: 1, height: 5, backgroundColor: COLORS.border, borderRadius: 3, overflow: "hidden" }}>
                                      <View style={{ width: `${(avg / 5) * 100}%`, height: "100%", backgroundColor: COLORS.accent, borderRadius: 3 }} />
                                    </View>
                                    <Text style={{ fontSize: 11, color: COLORS.accent, fontWeight: "700", width: 26, textAlign: "right" }}>★{avg.toFixed(1)}</Text>
                                  </View>
                                );
                              })
                            )}
                          </View>
                        );
                      })()}
                      {allReviewsLoading ? (
                        <ActivityIndicator size="small" color={COLORS.accent} />
                      ) : others.length === 0 ? (
                        <Text style={s.emptyText}>다른 사람의 리뷰가 아직 없어요</Text>
                      ) : (
                        <>
                          {visibleReviews.map((r) => (
                            <View key={r.id} style={s.reviewItem}>
                              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4, flexWrap: "wrap", gap: 4 }}>
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                  <Text style={s.reviewNick}>{r.nickname}</Text>
                                  {r.total_score > 0 && (
                                    <Text style={{ fontSize: 11, color: COLORS.accent, fontWeight: "700" }}>★ {Number(r.total_score).toFixed(1)}</Text>
                                  )}
                                </View>
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                  <Text style={{ fontSize: 11, color: COLORS.subLight }}>{r.created_at?.slice(0, 10)}</Text>
                                  {session && r.user_id !== session?.user.id && (
                                    <TouchableOpacity onPress={() => setReportingReviewId(r.id)} hitSlop={8}>
                                      <Text style={{ fontSize: 13, color: COLORS.subLight, opacity: 0.7 }}>⚑</Text>
                                    </TouchableOpacity>
                                  )}
                                </View>
                              </View>
                              {r.memo ? <Text style={s.reviewMemoText}>{r.memo}</Text> : null}
                              {r.user_id !== session?.user.id && (
                                <View style={{ flexDirection: "row", justifyContent: "flex-end", alignItems: "center", marginTop: 6 }}>
                                  <TouchableOpacity
                                    onPress={() => toggleLike(r.id)}
                                    style={[s.likeBtn, likesMap[r.id]?.likedByMe && s.likeBtnActive]}
                                  >
                                    <Text style={{ fontSize: 14, color: likesMap[r.id]?.likedByMe ? COLORS.accent : COLORS.subLight }}>
                                      {likesMap[r.id]?.likedByMe ? "♥" : "♡"}
                                    </Text>
                                    {(likesMap[r.id]?.count || 0) > 0 && (
                                      <Text style={{ fontSize: 12, fontWeight: "600", color: likesMap[r.id]?.likedByMe ? COLORS.accent : COLORS.subLight }}>
                                        {likesMap[r.id].count}
                                      </Text>
                                    )}
                                  </TouchableOpacity>
                                </View>
                              )}
                            </View>
                          ))}
                          {others.length > reviewsShowCount && (
                            <TouchableOpacity style={s.loadMoreBtn} onPress={() => setReviewsShowCount((n) => n + 10)}>
                              <Text style={s.loadMoreBtnText}>더 보기 (+{others.length - reviewsShowCount}개)</Text>
                            </TouchableOpacity>
                          )}
                        </>
                      )}
                    </View>
                  );
                })()}
              </ScrollView>
            </Animated.View>

            {/* ── 신고 모달 ── */}
            {reportingReviewId && session && (
              <ReportModal reviewId={reportingReviewId} session={session} onClose={() => setReportingReviewId(null)} />
            )}

            {/* ── 편집 패널 오버레이 (별도 Modal 없이 여기서 렌더링) ── */}
            {showEditPanel && (
              <KeyboardAvoidingView
                style={s.editOverlay}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                keyboardVerticalOffset={0}
              >
                <View style={s.editHeader}>
                  <Text style={s.editHeaderTitle}>게임 설정 편집</Text>
                  <TouchableOpacity onPress={closeEditPanel} style={s.closeBtn}>
                    <Text style={{ color: COLORS.sub, fontSize: 16 }}>✕</Text>
                  </TouchableOpacity>
                </View>

                <ScrollView
                  style={{ flex: 1 }}
                  contentContainerStyle={s.editScrollContent}
                  keyboardShouldPersistTaps="handled"
                >
                  <Text style={s.editGameName}>{game.name_ko || game.name_en}</Text>

                  <EditField
                    label="게임 이름 (한글)"
                    value={editNameKo}
                    onChangeText={setEditNameKo}
                    autoCapitalize="none"
                  />
                  <EditField
                    label="게임 이름 (영문)"
                    value={editNameEn}
                    onChangeText={setEditNameEn}
                  />
                  <EditField
                    label="장르 (쉼표로 구분)"
                    value={editGenre}
                    onChangeText={setEditGenre}
                    placeholder="예: 전략, 협력"
                    autoCapitalize="none"
                  />
                  <EditField
                    label="인원"
                    value={editPlayers}
                    onChangeText={setEditPlayers}
                    placeholder="예: 2~4"
                    keyboardType="numbers-and-punctuation"
                  />
                  <EditField
                    label="플레이 시간 (분)"
                    value={editMinutes}
                    onChangeText={setEditMinutes}
                    placeholder="예: 30"
                    keyboardType="numeric"
                  />
                  <EditField
                    label="나이 제한 (세)"
                    value={editMinAge}
                    onChangeText={setEditMinAge}
                    placeholder="예: 10"
                    keyboardType="numeric"
                  />
                  <EditField
                    label="이미지 URL"
                    value={editImageUrl}
                    onChangeText={(t) => { setEditImageUrl(t); setEditImageValid(null); }}
                    placeholder="https://..."
                  />

                  {editImageUrl.startsWith("https://") && (
                    <View style={s.editImagePreview}>
                      <Image
                        source={{ uri: editImageUrl }}
                        style={s.editPreviewImg}
                        resizeMode="contain"
                        onLoad={() => setEditImageValid(true)}
                        onError={() => setEditImageValid(false)}
                      />
                      {editImageValid === true && (
                        <Text style={s.editImgOk}>✓ 이미지 확인됨</Text>
                      )}
                      {editImageValid === false && (
                        <Text style={s.editImgErr}>이미지를 불러올 수 없어요</Text>
                      )}
                    </View>
                  )}
                </ScrollView>

                <View style={s.editFooter}>
                  <TouchableOpacity style={s.editCancelBtn} onPress={closeEditPanel}>
                    <Text style={s.editCancelBtnText}>취소</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.editSubmitBtn, editSaving && { opacity: 0.5 }]}
                    onPress={submitEdit}
                    disabled={editSaving}
                  >
                    {editSaving
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={s.editSubmitBtnText}>제안하기</Text>
                    }
                  </TouchableOpacity>
                </View>
              </KeyboardAvoidingView>
            )}
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  // 그리드 카드
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
    position: "absolute", top: 5, left: 5,
    backgroundColor: "rgba(255,255,255,0.85)",
    borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2,
  },
  genreBadgeText: { fontSize: 8, fontWeight: "700", color: COLORS.text },
  scoreBadge: {
    position: "absolute", top: 5, right: 5,
    backgroundColor: "rgba(30,100,60,0.88)",
    borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2,
  },
  scoreBadgeText: { fontSize: 8, fontWeight: "700", color: "#fff" },
  cardInfo: { padding: 6 },
  cardName: { fontSize: 10, fontWeight: "700", color: COLORS.text, marginBottom: 2 },
  cardSub: { fontSize: 9, color: COLORS.sub },
  statRow: { flexDirection: "row", alignItems: "center" },
  statAvg: { fontSize: 10, fontWeight: "700", color: COLORS.accent },
  statCount: { fontSize: 9, color: COLORS.subLight },

  // 플립 모달
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)" },
  modalWrapper: {
    position: "absolute",
    top: SH * 0.04,
    left: SW * 0.025,
    right: SW * 0.025,
    height: SH * 0.92,
  },
  face: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 20,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },

  // 뒷면 상단 밴드
  backTopBand: {
    height: 120,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    flexShrink: 0,
  },
  backTopThumb: {
    width: 64,
    height: 64,
    borderRadius: 10,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  backTopInfo: { flex: 1, marginLeft: 14, minWidth: 0 },
  backTopName: { fontSize: 15, fontWeight: "800", color: COLORS.text, lineHeight: 20 },
  backTopNameEn: { fontSize: 11, color: COLORS.subLight, marginTop: 2 },

  // 뒷면 스크롤
  backScrollContent: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 40 },
  backContentHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  backContentTitle: {
    fontSize: 15, fontWeight: "800", color: COLORS.text,
    flex: 1, marginRight: 8,
  },
  closeBtn: {
    width: 32, height: 32, borderRadius: 8,
    borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 8 },

  // 게임 정보
  gameInfoSection: {
    backgroundColor: COLORS.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    marginBottom: 12,
  },
  genreChip: {
    backgroundColor: "rgba(0,0,0,0.07)", borderRadius: 8,
    paddingHorizontal: 7, paddingVertical: 3,
  },
  genreChipText: { fontSize: 10, fontWeight: "700", color: COLORS.text },
  metaText: { fontSize: 12, color: COLORS.sub },
  communityRatingRow: { flexDirection: "row", alignItems: "center", marginTop: 4, marginBottom: 4 },
  communityRatingText: { fontSize: 11, color: COLORS.accent, fontWeight: "700" },
  communityRatingCount: { fontSize: 11, color: COLORS.subLight },
  bggBadge: {
    backgroundColor: "rgba(29,78,216,0.12)",
    borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2,
  },
  bggBadgeText: { fontSize: 11, fontWeight: "700", color: "#1d4ed8" },
  descText: { fontSize: 12, color: COLORS.sub, lineHeight: 18, marginTop: 8 },

  // 게임 설정 편집 버튼
  editGameBtn: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    marginBottom: 4,
    backgroundColor: COLORS.surface,
  },
  editGameBtnText: { fontSize: 12, fontWeight: "700", color: COLORS.sub },

  // 섹션
  sectionBox: { marginBottom: 16 },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionTitle: { fontSize: 14, fontWeight: "800", color: COLORS.text },

  // 내 기록
  myReviewItem: {
    padding: 10,
    backgroundColor: COLORS.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 8,
  },
  myReviewItemEditing: {
    borderColor: COLORS.accent,
    backgroundColor: "#f0f9f4",
  },
  addRecordBtn: {
    backgroundColor: COLORS.accentLight,
    borderWidth: 1, borderColor: COLORS.accent,
    borderRadius: 8, paddingVertical: 8,
    alignItems: "center", marginTop: 4, marginBottom: 4,
  },
  addRecordBtnText: { fontSize: 12, fontWeight: "700", color: COLORS.accent },
  deleteConfirmBox: {
    backgroundColor: "#fee2e2",
    borderWidth: 1, borderColor: "#fca5a5",
    borderRadius: 8, padding: 12, marginBottom: 8,
  },
  deleteConfirmText: { fontSize: 12, fontWeight: "700", color: "#991b1b", lineHeight: 18 },
  deleteCancelBtn: {
    flex: 1, paddingVertical: 7,
    borderWidth: 1, borderColor: "#fca5a5",
    borderRadius: 8, alignItems: "center",
    backgroundColor: "#fff",
  },
  deleteBtn: {
    flex: 1, paddingVertical: 7,
    borderRadius: 8, alignItems: "center",
    backgroundColor: COLORS.error,
  },
  writeFormBox: {
    marginTop: 8, padding: 16,
    backgroundColor: COLORS.bg,
    borderRadius: 12, borderWidth: 1, borderColor: COLORS.border,
  },
  cancelBtnText: {
    fontSize: 11, color: COLORS.sub, fontWeight: "600",
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
  },
  starBox: {
    backgroundColor: COLORS.surface,
    borderRadius: 12, borderWidth: 1, borderColor: COLORS.border,
    padding: 16, alignItems: "center", marginBottom: 12,
  },
  scoreDisplay: { marginTop: 8, fontSize: 14, fontWeight: "700" },
  memoInput: {
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 8, padding: 10,
    fontSize: 13, color: COLORS.text,
    minHeight: 60, backgroundColor: COLORS.surface,
    textAlignVertical: "top", marginBottom: 12,
  },
  saveBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 10, paddingVertical: 12, alignItems: "center",
  },
  saveBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  firstRecordBtn: {
    backgroundColor: COLORS.accentLight,
    borderWidth: 1, borderColor: COLORS.accent,
    borderRadius: 10, paddingVertical: 12, alignItems: "center",
  },
  firstRecordBtnText: { fontSize: 13, fontWeight: "700", color: COLORS.accent },

  // 리뷰
  reviewItem: {
    paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  reviewNick: { fontSize: 12, fontWeight: "700", color: COLORS.text },
  reviewMemo: { fontSize: 11, color: COLORS.sub, lineHeight: 16, marginTop: 3 },
  reviewMemoText: { fontSize: 13, color: "#404040", lineHeight: 20 },
  likeBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
  },
  likeBtnActive: { borderColor: COLORS.accent, backgroundColor: COLORS.accentLight },
  loadMoreBtn: {
    marginTop: 8, paddingVertical: 8,
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 8, alignItems: "center",
  },
  loadMoreBtnText: { fontSize: 12, fontWeight: "600", color: COLORS.sub },
  emptyText: { fontSize: 13, color: COLORS.subLight, textAlign: "center", paddingVertical: 16 },

  // ── 편집 패널 오버레이 ──
  editOverlay: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    overflow: "hidden",
  },
  editHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  editHeaderTitle: { fontSize: 16, fontWeight: "800", color: COLORS.text },
  editScrollContent: { padding: 20, paddingBottom: 16 },
  editGameName: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.accent,
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  editFieldBlock: { marginBottom: 14 },
  editFieldLabel: {
    fontSize: 12, fontWeight: "700", color: COLORS.sub, marginBottom: 6,
  },
  editFieldInput: {
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 8, paddingVertical: 9, paddingHorizontal: 12,
    fontSize: 13, color: COLORS.text, backgroundColor: COLORS.bg,
  },
  editImagePreview: { alignItems: "center", marginTop: 8, marginBottom: 4 },
  editPreviewImg: {
    width: 100, height: 100, borderRadius: 8, backgroundColor: "#e5e7eb",
  },
  editImgOk: { fontSize: 11, color: "#22c55e", marginTop: 4, fontWeight: "600" },
  editImgErr: { fontSize: 11, color: COLORS.error, marginTop: 4 },
  editFooter: {
    flexDirection: "row",
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  editCancelBtn: {
    flex: 1, paddingVertical: 13,
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 12, alignItems: "center",
    backgroundColor: COLORS.bg,
  },
  editCancelBtnText: { fontSize: 14, fontWeight: "700", color: COLORS.sub },
  editSubmitBtn: {
    flex: 2, paddingVertical: 13,
    borderRadius: 12, alignItems: "center",
    backgroundColor: COLORS.accent,
  },
  editSubmitBtnText: { fontSize: 14, fontWeight: "800", color: "#fff" },
});
