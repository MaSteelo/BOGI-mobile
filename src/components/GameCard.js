import React, { useState, useEffect, useRef } from "react";
import {
  View, Text, Image, TouchableOpacity, Modal,
  Animated, ScrollView, TextInput, StyleSheet,
  ActivityIndicator, Alert, Dimensions, Easing,
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

const EDIT_FIELDS = [
  { key: "name_en",      label: "영문 이름",       type: "text" },
  { key: "publisher",    label: "출판사",           type: "text" },
  { key: "min_players",  label: "최소 인원",        type: "number" },
  { key: "max_players",  label: "최대 인원",        type: "number" },
  { key: "play_minutes", label: "플레이 시간(분)",  type: "number" },
  { key: "min_age",      label: "권장 연령",        type: "number" },
  { key: "genre",        label: "장르 (쉼표 구분)", type: "text" },
  { key: "description",  label: "게임 설명",        type: "textarea" },
  { key: "image_url",    label: "이미지 URL",       type: "image" },
];

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

function EditModal({ game, session, visible, onClose, onSubmitted }) {
  const [selectedField, setSelectedField] = useState(EDIT_FIELDS[0]);
  const [newValue, setNewValue] = useState("");
  const [imagePreviewValid, setImagePreviewValid] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!visible) {
      setSelectedField(EDIT_FIELDS[0]);
      setNewValue("");
      setImagePreviewValid(null);
      setSaved(false);
      setSaving(false);
    }
  }, [visible]);

  const currentDisplay = () => {
    const val = game[selectedField.key];
    if (val == null) return "";
    if (Array.isArray(val)) return val.join(", ");
    return String(val);
  };

  const handleFieldSelect = (field) => {
    setSelectedField(field);
    setNewValue("");
    setImagePreviewValid(null);
  };

  const handleSubmit = async () => {
    const val = newValue.trim();
    if (!val) { Alert.alert("알림", "새 값을 입력해주세요"); return; }
    if (selectedField.key === "image_url") {
      if (!val.startsWith("https://")) { Alert.alert("알림", "https://로 시작하는 URL을 입력해주세요"); return; }
      if (!imagePreviewValid) { Alert.alert("알림", "유효한 이미지 URL이 아니에요"); return; }
    }
    setSaving(true);
    let error;
    if (selectedField.key === "image_url") {
      ({ error } = await supabase.from("image_proposals").insert({
        game_id: game.id,
        user_id: session.user.id,
        image_url: val,
      }));
    } else {
      const oldVal = game[selectedField.key];
      const serializedOld = oldVal == null ? null : Array.isArray(oldVal) ? JSON.stringify(oldVal) : String(oldVal);
      const serializedNew = selectedField.key === "genre"
        ? JSON.stringify(val.split(",").map((s) => s.trim()).filter(Boolean))
        : val;
      ({ error } = await supabase.from("game_edits").insert({
        game_id: game.id,
        user_id: session.user.id,
        field_name: selectedField.key,
        old_value: serializedOld,
        new_value: serializedNew,
      }));
    }
    setSaving(false);
    if (error) { Alert.alert("오류", error.message); }
    else { setSaved(true); onSubmitted?.(); }
  };

  return (
    <Modal visible={visible} transparent statusBarTranslucent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={em.backdrop} activeOpacity={1} onPress={onClose} />
      <View style={em.sheet}>
        <View style={em.header}>
          <View style={{ flex: 1 }}>
            <Text style={em.title}>게임 설정 편집</Text>
            <Text style={em.subtitle}>{game.name_ko}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={em.closeBtn}>
            <Text style={{ color: COLORS.sub, fontSize: 14 }}>✕</Text>
          </TouchableOpacity>
        </View>

        {saved ? (
          <View style={{ padding: 24, alignItems: "center" }}>
            <Text style={{ fontSize: 14, color: "#22c55e", fontWeight: "700", textAlign: "center", lineHeight: 22 }}>
              ✅ 수정 제안이 등록되었습니다.{"\n"}관리자 검토 후 반영됩니다.
            </Text>
            <TouchableOpacity onPress={onClose} style={[em.submitBtn, { marginTop: 16, width: "100%" }]}>
              <Text style={em.submitBtnText}>닫기</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
            <Text style={em.label}>수정할 항목</Text>
            <View style={em.chipRow}>
              {EDIT_FIELDS.map((f) => (
                <TouchableOpacity
                  key={f.key}
                  onPress={() => handleFieldSelect(f)}
                  style={[em.chip, selectedField.key === f.key && em.chipActive]}
                >
                  <Text style={[em.chipText, selectedField.key === f.key && em.chipTextActive]}>
                    {f.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[em.label, { marginTop: 14 }]}>현재 값</Text>
            <View style={em.currentValueBox}>
              <Text style={{ fontSize: 13, color: currentDisplay() ? COLORS.text : COLORS.subLight }}>
                {currentDisplay() || "값 없음"}
              </Text>
            </View>

            <Text style={[em.label, { marginTop: 14 }]}>새 값</Text>
            {selectedField.type === "textarea" ? (
              <TextInput
                value={newValue}
                onChangeText={setNewValue}
                placeholder="새 값을 입력하세요"
                placeholderTextColor={COLORS.subLight}
                style={[em.input, { minHeight: 80, textAlignVertical: "top" }]}
                multiline
              />
            ) : (
              <TextInput
                value={newValue}
                onChangeText={(t) => { setNewValue(t); if (selectedField.key === "image_url") setImagePreviewValid(null); }}
                placeholder={
                  selectedField.key === "image_url" ? "https://..." :
                  selectedField.key === "genre" ? "예: 전략, 협력" :
                  "새 값을 입력하세요"
                }
                placeholderTextColor={COLORS.subLight}
                style={em.input}
                keyboardType={selectedField.type === "number" ? "numeric" : "default"}
                autoCapitalize="none"
                autoCorrect={false}
              />
            )}

            {selectedField.key === "image_url" && newValue.startsWith("https://") && (
              <View style={{ marginTop: 10, alignItems: "center" }}>
                <Text style={[em.label, { alignSelf: "flex-start" }]}>미리보기</Text>
                <Image
                  source={{ uri: newValue }}
                  style={{ width: 120, height: 120, borderRadius: 10, backgroundColor: "#e5e7eb" }}
                  resizeMode="contain"
                  onLoad={() => setImagePreviewValid(true)}
                  onError={() => setImagePreviewValid(false)}
                />
                {imagePreviewValid === true && (
                  <Text style={{ fontSize: 12, color: "#22c55e", marginTop: 4, fontWeight: "600" }}>✓ 이미지 확인됨</Text>
                )}
                {imagePreviewValid === false && (
                  <Text style={{ fontSize: 12, color: COLORS.error, marginTop: 4 }}>이미지를 불러올 수 없어요</Text>
                )}
              </View>
            )}

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={saving || !newValue.trim() || (selectedField.key === "image_url" && !imagePreviewValid)}
              style={[
                em.submitBtn,
                { marginTop: 20 },
                (saving || !newValue.trim() || (selectedField.key === "image_url" && !imagePreviewValid)) && { opacity: 0.5 },
              ]}
            >
              {saving
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={em.submitBtnText}>제안 제출</Text>
              }
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

export default function GameCard({ game, session, reviewSummary, gameStat, onReviewSaved, cardWidth }) {
  const genreStyle = getGenreStyle(game.genre);
  const imageUrl = safeImageUrl(game.image_url);
  const [imgError, setImgError] = useState(false);

  const [expanded, setExpanded] = useState(false);
  const flipAnim = useRef(new Animated.Value(0)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  const [myReviews, setMyReviews] = useState(null);
  const [allReviews, setAllReviews] = useState(null);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [allReviewsLoading, setAllReviewsLoading] = useState(false);
  const [likesMap, setLikesMap] = useState({});
  const [reviewsShowCount, setReviewsShowCount] = useState(10);

  const [totalScore, setTotalScore] = useState(0);
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const [showEditModal, setShowEditModal] = useState(false);

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
      .select("id, user_id, total_score, memo, created_at")
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
    flipAnim.setValue(0);
    overlayAnim.setValue(0);
    loadMyReviews();
    loadAllReviews();
    requestAnimationFrame(() => {
      Animated.parallel([
        Animated.timing(overlayAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(flipAnim, { toValue: 180, duration: 600, easing: Easing.ease, useNativeDriver: true }),
      ]).start();
    });
  };

  const closeCard = () => {
    Animated.parallel([
      Animated.timing(overlayAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
      Animated.timing(flipAnim, { toValue: 0, duration: 500, easing: Easing.ease, useNativeDriver: true }),
    ]).start(() => {
      setExpanded(false);
      setMyReviews(null);
      setAllReviews(null);
      setAllReviewsLoading(false);
      setLikesMap({});
      setReviewsShowCount(10);
      setTotalScore(0);
      setMemo("");
      setEditingId(null);
      setShowForm(false);
      setConfirmDeleteId(null);
      setShowEditModal(false);
    });
  };

  const handleSave = async () => {
    if (!session || totalScore === 0) { Alert.alert("알림", "별점을 선택해주세요"); return; }
    setSaving(true);
    const payload = { total_score: totalScore, memo: memo.trim() || null, rating_mode: "total" };
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
          }]}>
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
              keyboardShouldPersistTaps="handled"
            >
              {/* 1. 헤더: 썸네일 + 게임 이름(한/영) + X */}
              <View style={s.backHeader}>
                <View style={[s.headerThumb, { backgroundColor: genreStyle.grad[0] }]}>
                  {!imgError && imageUrl ? (
                    <Image source={{ uri: imageUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
                  ) : (
                    <Text style={{ fontSize: 24 }}>{genreStyle.emoji}</Text>
                  )}
                </View>
                <View style={{ flex: 1, marginHorizontal: 12 }}>
                  <Text style={s.backTitle} numberOfLines={2}>{game.name_ko || game.name_en}</Text>
                  {game.name_en && game.name_ko && game.name_ko !== game.name_en && (
                    <Text style={s.backTitleEn} numberOfLines={1}>{game.name_en}</Text>
                  )}
                </View>
                <TouchableOpacity onPress={closeCard} style={s.closeBtn}>
                  <Text style={{ color: COLORS.sub, fontSize: 16 }}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* 2. 내 기록 섹션 */}
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
                                  onPress={() => { setEditingId(r.id); setTotalScore(r.total_score || 0); setMemo(r.memo || ""); setShowForm(true); }}
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

                      {/* 3. 새 기록 추가 버튼 (기존 기록이 있고 폼이 닫혀있을 때) */}
                      {!showForm && myReviews?.length > 0 && (
                        <TouchableOpacity
                          style={s.addRecordBtn}
                          onPress={() => { setEditingId(null); setTotalScore(0); setMemo(""); setShowForm(true); }}
                        >
                          <Text style={s.addRecordBtnText}>+ 새 기록 추가</Text>
                        </TouchableOpacity>
                      )}

                      {/* 기록 작성 폼 */}
                      {showForm && (
                        <View style={s.writeFormBox}>
                          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                            <Text style={{ fontSize: 13, fontWeight: "800", color: COLORS.text }}>
                              {editingId ? "기록 수정하기" : "새 기록 추가"}
                            </Text>
                            <TouchableOpacity onPress={() => { setShowForm(false); setEditingId(null); setTotalScore(0); setMemo(""); }}>
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

              {/* 4. 게임 정보 섹션 */}
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

              {/* 5. 게임 설정 편집 버튼 */}
              {session && (
                <TouchableOpacity style={s.editGameBtn} onPress={() => setShowEditModal(true)}>
                  <Text style={s.editGameBtnText}>✏️ 게임 설정 편집</Text>
                </TouchableOpacity>
              )}

              {/* 6. 다른 사람 리뷰 */}
              {(() => {
                if (allReviews === null) return null;
                const scores = allReviews.filter((r) => r.total_score > 0).map((r) => r.total_score);
                const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
                const others = session ? allReviews.filter((r) => r.user_id !== session.user.id) : allReviews;
                const visible = others.slice(0, reviewsShowCount);
                return (
                  <View style={[s.sectionBox, { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 16, marginTop: 4 }]}>
                    <View style={s.sectionHeaderRow}>
                      <Text style={s.sectionTitle}>다른 사람 리뷰</Text>
                      {avg !== null && (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                          <Text style={{ color: COLORS.accent, fontWeight: "700", fontSize: 12 }}>★ {avg.toFixed(1)}</Text>
                          <Text style={{ color: COLORS.subLight, fontSize: 11 }}>· {allReviews.length}개</Text>
                        </View>
                      )}
                    </View>
                    {allReviewsLoading ? (
                      <ActivityIndicator size="small" color={COLORS.accent} />
                    ) : others.length === 0 ? (
                      <Text style={s.emptyText}>다른 사람의 리뷰가 아직 없어요</Text>
                    ) : (
                      <>
                        {visible.map((r) => (
                          <View key={r.id} style={s.reviewItem}>
                            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4, flexWrap: "wrap", gap: 4 }}>
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                                <Text style={s.reviewNick}>{r.nickname}</Text>
                                {r.total_score > 0 && (
                                  <Text style={{ fontSize: 11, color: COLORS.accent, fontWeight: "700" }}>★ {Number(r.total_score).toFixed(1)}</Text>
                                )}
                              </View>
                              <Text style={{ fontSize: 11, color: COLORS.subLight }}>{r.created_at?.slice(0, 10)}</Text>
                            </View>
                            {r.memo ? <Text style={s.reviewMemoText}>{r.memo}</Text> : null}
                            {r.user_id !== session?.user.id && (
                              <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 6 }}>
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
        </View>
      </Modal>

      {/* 게임 설정 편집 모달 — visible prop으로 제어 */}
      {session && (
        <EditModal
          game={game}
          session={session}
          visible={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSubmitted={() => {}}
        />
      )}
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
    top: SH * 0.05,
    left: SW * 0.04,
    right: SW * 0.04,
    height: SH * 0.88,
  },
  face: {
    position: "absolute",
    top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 20,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },

  // 뒷면 헤더 (썸네일 + 이름 + X)
  backHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  headerThumb: {
    width: 56, height: 56,
    borderRadius: 10,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  backTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.text,
    lineHeight: 22,
  },
  backTitleEn: {
    fontSize: 11,
    color: COLORS.subLight,
    marginTop: 2,
  },
  closeBtn: {
    width: 32, height: 32, borderRadius: 8,
    borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },

  // 게임 정보 섹션
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
    borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 2,
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
    marginBottom: 16,
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

  // 내 기록 아이템
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

  // 새 기록 추가 버튼
  addRecordBtn: {
    backgroundColor: COLORS.accentLight,
    borderWidth: 1, borderColor: COLORS.accent,
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: "center",
    marginTop: 4,
    marginBottom: 4,
  },
  addRecordBtnText: { fontSize: 12, fontWeight: "700", color: COLORS.accent },

  // 삭제 확인
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

  // 기록 폼
  writeFormBox: {
    marginTop: 8,
    padding: 16,
    backgroundColor: COLORS.bg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelBtnText: {
    fontSize: 11, color: COLORS.sub, fontWeight: "600",
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3,
  },
  starBox: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    alignItems: "center",
    marginBottom: 12,
  },
  scoreDisplay: { marginTop: 8, fontSize: 14, fontWeight: "700" },
  memoInput: {
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 8, padding: 10,
    fontSize: 13, color: COLORS.text,
    minHeight: 60,
    backgroundColor: COLORS.surface,
    textAlignVertical: "top",
    marginBottom: 12,
  },
  saveBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  saveBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },
  firstRecordBtn: {
    backgroundColor: COLORS.accentLight,
    borderWidth: 1, borderColor: COLORS.accent,
    borderRadius: 10, paddingVertical: 12,
    alignItems: "center",
  },
  firstRecordBtnText: { fontSize: 13, fontWeight: "700", color: COLORS.accent },

  // 리뷰 아이템
  reviewItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  reviewNick: { fontSize: 12, fontWeight: "700", color: COLORS.text },
  reviewMemo: { fontSize: 11, color: COLORS.sub, lineHeight: 16, marginTop: 3 },
  reviewMemoText: { fontSize: 13, color: "#404040", lineHeight: 20 },
  likeBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6,
  },
  likeBtnActive: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accentLight,
  },
  loadMoreBtn: {
    marginTop: 8, paddingVertical: 8,
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 8, alignItems: "center",
  },
  loadMoreBtnText: { fontSize: 12, fontWeight: "600", color: COLORS.sub },
  emptyText: { fontSize: 13, color: COLORS.subLight, textAlign: "center", paddingVertical: 16 },
});

const em = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  sheet: {
    position: "absolute",
    bottom: 0, left: 0, right: 0,
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "88%",
    paddingBottom: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: { fontSize: 16, fontWeight: "800", color: COLORS.text },
  subtitle: { fontSize: 12, color: COLORS.sub, marginTop: 3 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 8,
    borderWidth: 1, borderColor: COLORS.border,
    backgroundColor: COLORS.bg,
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
  label: { fontSize: 12, fontWeight: "700", color: COLORS.sub, marginBottom: 6 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 8, borderWidth: 1,
    borderColor: COLORS.border, backgroundColor: COLORS.bg,
  },
  chipActive: { borderColor: COLORS.accent, backgroundColor: COLORS.accentLight },
  chipText: { fontSize: 11, fontWeight: "600", color: COLORS.sub },
  chipTextActive: { color: COLORS.accent },
  currentValueBox: {
    backgroundColor: "#f3f4f6",
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 8,
    paddingVertical: 9, paddingHorizontal: 12,
    minHeight: 38,
  },
  input: {
    borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 8,
    paddingVertical: 9, paddingHorizontal: 12,
    fontSize: 13, color: COLORS.text,
    backgroundColor: COLORS.bg,
  },
  submitBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 12, paddingVertical: 13,
    alignItems: "center",
  },
  submitBtnText: { color: "#fff", fontWeight: "800", fontSize: 14 },
});
