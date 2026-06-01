import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Modal,
  TextInput,
  Alert,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "../constants/colors";
import { supabase } from "../lib/supabase";

const STATUS_TABS = [
  { key: "pending", label: "대기" },
  { key: "approved", label: "승인" },
  { key: "rejected", label: "거절" },
];

const MAIN_TABS = [
  { key: "edits", label: "게임 설정 편집" },
  { key: "submissions", label: "게임 추가" },
  { key: "images", label: "이미지 제안" },
];

function RejectModal({ visible, onClose, onSubmit }) {
  const [reason, setReason] = useState("");
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={rm.backdrop}>
        <View style={rm.sheet}>
          <Text style={rm.title}>거절 사유</Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="거절 사유를 입력하세요"
            placeholderTextColor={COLORS.subLight}
            style={rm.input}
            multiline
            autoFocus
          />
          <View style={rm.btnRow}>
            <TouchableOpacity
              style={[rm.btn, { backgroundColor: "#f3f4f6" }]}
              onPress={() => { setReason(""); onClose(); }}
            >
              <Text style={{ color: COLORS.sub, fontWeight: "700" }}>취소</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[rm.btn, { backgroundColor: COLORS.error }]}
              onPress={() => { onSubmit(reason.trim()); setReason(""); }}
            >
              <Text style={{ color: "#fff", fontWeight: "700" }}>거절</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function EditItem({ item, statusTab, onApprove, onReject }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.gameName}>
          {item.games?.name_ko ?? "알 수 없는 게임"}
        </Text>
        <Text style={styles.dateText}>{item.created_at?.slice(0, 10)}</Text>
      </View>
      <Text style={styles.submitterText}>
        제안자: {item.proposerNickname ?? "알 수 없음"}
      </Text>
      <View style={styles.fieldRow}>
        <Text style={styles.fieldLabel}>{item.field}</Text>
        <Text style={styles.fieldArrow}>→</Text>
        <Text style={styles.fieldValue} numberOfLines={2}>
          {item.new_value}
        </Text>
      </View>
      {item.old_value ? (
        <Text style={styles.oldValue} numberOfLines={1}>
          이전: {item.old_value}
        </Text>
      ) : null}
      {statusTab === "pending" && (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: COLORS.good }]}
            onPress={() => onApprove(item)}
          >
            <Text style={styles.actionText}>✓ 승인</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: COLORS.error }]}
            onPress={() => onReject(item)}
          >
            <Text style={styles.actionText}>✗ 거절</Text>
          </TouchableOpacity>
        </View>
      )}
      {item.status !== "pending" && (
        <View style={[styles.statusBadge, item.status === "approved" ? styles.badgeGood : styles.badgeError]}>
          <Text style={styles.statusBadgeText}>
            {item.status === "approved" ? "✓ 승인됨" : "✗ 거절됨"}
          </Text>
        </View>
      )}
    </View>
  );
}

function SubmissionItem({ item, statusTab, onApprove, onReject }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.gameName}>
          {item.name_ko || item.name_en || "이름 없음"}
        </Text>
        <Text style={styles.dateText}>{item.created_at?.slice(0, 10)}</Text>
      </View>
      <Text style={styles.submitterText}>
        제안자: {item.proposerNickname ?? "알 수 없음"}
      </Text>
      <View style={styles.gameDataRow}>
        {item.name_en ? (
          <Text style={styles.dataText}>영문명: {item.name_en}</Text>
        ) : null}
        {item.min_players ? (
          <Text style={styles.dataText}>
            인원: {item.min_players}~{item.max_players}인
          </Text>
        ) : null}
        {item.play_minutes ? (
          <Text style={styles.dataText}>시간: {item.play_minutes}분</Text>
        ) : null}
        {item.min_age ? (
          <Text style={styles.dataText}>나이: {item.min_age}세+</Text>
        ) : null}
        {item.genre?.length ? (
          <Text style={styles.dataText}>장르: {item.genre.join(", ")}</Text>
        ) : null}
        {item.publisher ? (
          <Text style={styles.dataText}>출판사: {item.publisher}</Text>
        ) : null}
        {item.description ? (
          <Text style={styles.dataText} numberOfLines={3}>
            설명: {item.description}
          </Text>
        ) : null}
      </View>
      {statusTab === "pending" && (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: COLORS.good }]}
            onPress={() => onApprove(item)}
          >
            <Text style={styles.actionText}>✓ 승인</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: COLORS.error }]}
            onPress={() => onReject(item)}
          >
            <Text style={styles.actionText}>✗ 거절</Text>
          </TouchableOpacity>
        </View>
      )}
      {item.status !== "pending" && (
        <View style={[styles.statusBadge, item.status === "approved" ? styles.badgeGood : styles.badgeError]}>
          <Text style={styles.statusBadgeText}>
            {item.status === "approved" ? "✓ 승인됨" : "✗ 거절됨"}
          </Text>
        </View>
      )}
    </View>
  );
}

function ImageProposalItem({ item, statusTab, onApprove, onReject }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.gameName}>{item.games?.name_ko ?? "알 수 없는 게임"}</Text>
        <Text style={styles.dateText}>{item.created_at?.slice(0, 10)}</Text>
      </View>
      <Text style={styles.submitterText}>제안자: {item.proposerNickname ?? "알 수 없음"}</Text>

      {/* 이미지 비교 */}
      <View style={styles.imgCompareRow}>
        <View style={styles.imgCompareCol}>
          <Text style={styles.imgCompareLabel}>현재 이미지</Text>
          {item.games?.image_url ? (
            <Image
              source={{ uri: item.games.image_url }}
              style={styles.imgCompareThumbnail}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.imgCompareThumbnail, styles.imgComparePlaceholder]}>
              <Text style={{ fontSize: 11, color: COLORS.subLight }}>없음</Text>
            </View>
          )}
        </View>
        <View style={styles.imgCompareArrow}>
          <Text style={{ color: COLORS.accent, fontSize: 20 }}>→</Text>
        </View>
        <View style={styles.imgCompareCol}>
          <Text style={[styles.imgCompareLabel, { color: COLORS.accent }]}>제안 이미지</Text>
          <Image
            source={{ uri: item.image_url }}
            style={styles.imgCompareThumbnail}
            resizeMode="cover"
          />
        </View>
      </View>

      {statusTab === "pending" && (
        <View style={styles.actionRow}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: COLORS.good }]}
            onPress={() => onApprove(item)}
          >
            <Text style={styles.actionText}>✓ 승인</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: COLORS.error }]}
            onPress={() => onReject(item)}
          >
            <Text style={styles.actionText}>✗ 거절</Text>
          </TouchableOpacity>
        </View>
      )}
      {item.status !== "pending" && (
        <View style={[styles.statusBadge, item.status === "approved" ? styles.badgeGood : styles.badgeError]}>
          <Text style={styles.statusBadgeText}>
            {item.status === "approved" ? "✓ 승인됨" : "✗ 거절됨"}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function AdminScreen({ session, profile }) {
  console.log("[AdminScreen] is_admin:", profile?.is_admin);

  const insets = useSafeAreaInsets();
  const [mainTab, setMainTab] = useState("edits");
  const [statusTab, setStatusTab] = useState("pending");
  const [edits, setEdits] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [imageProposals, setImageProposals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [rejectTarget, setRejectTarget] = useState(null);

  useEffect(() => {
    if (!profile?.is_admin) return;
    loadData();
  }, [mainTab, statusTab, profile?.is_admin]);

  const loadData = async () => {
    setLoading(true);
    if (mainTab === "edits") {
      const { data: rows, error } = await supabase
        .from("game_edits")
        .select("*, games(name_ko, name_en)")
        .eq("status", statusTab)
        .order("created_at", { ascending: false });
      console.log("[AdminScreen] game_edits SELECT — count:", rows?.length ?? 0, "error:", error?.message ?? "없음");
      if (error) console.error("[AdminScreen] game_edits 오류 상세:", error.code, error.details, error.hint);
      if (rows?.length > 0) {
        const userIds = [...new Set(rows.map((r) => r.proposed_by).filter(Boolean))];
        const { data: profileRows } = await supabase.from("profiles").select("id, nickname").in("id", userIds);
        const nickMap = {};
        profileRows?.forEach((p) => { nickMap[p.id] = p.nickname; });
        setEdits(rows.map((r) => ({ ...r, proposerNickname: nickMap[r.proposed_by] || "알 수 없음" })));
      } else {
        setEdits([]);
      }
    } else if (mainTab === "submissions") {
      const { data: rows, error } = await supabase
        .from("game_submissions")
        .select("*")
        .eq("status", statusTab)
        .order("created_at", { ascending: false });
      console.log("[AdminScreen] game_submissions SELECT — count:", rows?.length ?? 0, "error:", error?.message ?? "없음");
      if (error) console.error("[AdminScreen] game_submissions 오류 상세:", error.code, error.details, error.hint);
      if (rows?.length > 0) {
        const userIds = [...new Set(rows.map((r) => r.submitted_by).filter(Boolean))];
        const { data: profileRows } = await supabase.from("profiles").select("id, nickname").in("id", userIds);
        const nickMap = {};
        profileRows?.forEach((p) => { nickMap[p.id] = p.nickname; });
        setSubmissions(rows.map((r) => ({ ...r, proposerNickname: nickMap[r.submitted_by] || "알 수 없음" })));
      } else {
        setSubmissions([]);
      }
    } else if (mainTab === "images") {
      const { data, error } = await supabase
        .from("image_proposals")
        .select("*, games(id, name_ko, name_en, image_url)")
        .eq("status", statusTab)
        .order("created_at", { ascending: false });
      if (error) console.warn("[AdminScreen] image_proposals 오류:", error.message);
      const rows = data ?? [];
      if (rows.length > 0) {
        const userIds = [...new Set(rows.map((r) => r.user_id))];
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, nickname")
          .in("id", userIds);
        const nickMap = {};
        profilesData?.forEach((p) => { nickMap[p.id] = p.nickname; });
        setImageProposals(rows.map((r) => ({ ...r, proposerNickname: nickMap[r.user_id] || "알 수 없음" })));
      } else {
        setImageProposals([]);
      }
    }
    setLoading(false);
  };

  const approveEdit = async (item) => {
    console.log("[AdminScreen] 편집 승인:", item.id);
    const updates = [];

    updates.push(
      supabase
        .from("game_edits")
        .update({ status: "approved" })
        .eq("id", item.id)
    );

    if (item.game_id && item.field) {
      updates.push(
        supabase
          .from("games")
          .update({ [item.field]: item.new_value })
          .eq("id", item.game_id)
      );
    }

    updates.push(
      supabase.from("notifications").insert({
        user_id: item.proposed_by,
        type: "edit_approved",
        title: "편집 승인됨",
        body: `"${item.games?.name_ko}" 의 ${item.field} 편집이 승인되었어요.`,
        related_id: item.id,
      })
    );

    const results = await Promise.all(updates);
    const failed = results.find((r) => r.error);
    if (failed) {
      Alert.alert("오류", failed.error.message);
    } else {
      Alert.alert("완료", "편집이 승인되었어요.");
      loadData();
    }
  };

  const rejectEdit = async (item, reason) => {
    console.log("[AdminScreen] 편집 거절:", item.id, reason);
    const [editRes, notifRes] = await Promise.all([
      supabase
        .from("game_edits")
        .update({ status: "rejected" })
        .eq("id", item.id),
      supabase.from("notifications").insert({
        user_id: item.proposed_by,
        type: "edit_rejected",
        title: "편집 거절됨",
        body: reason
          ? `거절 사유: ${reason}`
          : `"${item.games?.name_ko}" 편집이 거절되었어요.`,
        related_id: item.id,
      }),
    ]);
    if (editRes.error) {
      Alert.alert("오류", editRes.error.message);
    } else {
      setRejectTarget(null);
      loadData();
    }
  };

  const approveSubmission = async (item) => {
    console.log("[AdminScreen] 등록 승인:", item.id);
    const [subRes, gameRes] = await Promise.all([
      supabase
        .from("game_submissions")
        .update({ status: "approved", reviewed_by: session.user.id, reviewed_at: new Date().toISOString() })
        .eq("id", item.id),
      supabase.from("games").insert({
        name_ko:      item.name_ko,
        name_en:      item.name_en      || null,
        min_players:  item.min_players  ?? null,
        max_players:  item.max_players  ?? null,
        play_minutes: item.play_minutes ?? null,
        min_age:      item.min_age      ?? null,
        genre:        item.genre        || null,
        publisher:    item.publisher    || null,
        description:  item.description  || null,
        status: "approved",
      }),
    ]);

    if (subRes.error || gameRes.error) {
      Alert.alert("오류", (subRes.error || gameRes.error).message);
      return;
    }

    await supabase.from("notifications").insert({
      user_id: item.submitted_by,
      type: "submit_approved",
      title: "게임 등록 승인됨",
      body: `"${item.name_ko || item.name_en}" 이(가) 등록되었어요!`,
      related_id: item.id,
    });

    Alert.alert("완료", "게임이 등록되었어요.");
    loadData();
  };

  const rejectSubmission = async (item, reason) => {
    console.log("[AdminScreen] 등록 거절:", item.id, reason);
    const [subRes] = await Promise.all([
      supabase
        .from("game_submissions")
        .update({ status: "rejected", reviewed_by: session.user.id, reviewed_at: new Date().toISOString() })
        .eq("id", item.id),
      supabase.from("notifications").insert({
        user_id: item.submitted_by,
        type: "submit_rejected",
        title: "게임 등록 거절됨",
        body: reason
          ? `거절 사유: ${reason}`
          : `"${item.name_ko || item.name_en}" 등록이 거절되었어요.`,
        related_id: item.id,
      }),
    ]);
    if (subRes.error) {
      Alert.alert("오류", subRes.error.message);
    } else {
      setRejectTarget(null);
      loadData();
    }
  };

  const approveImageProposal = async (item) => {
    const now = new Date().toISOString();
    const results = await Promise.all([
      supabase.from("games").update({ image_url: item.image_url }).eq("id", item.game_id),
      supabase.from("image_proposals").update({
        status: "approved",
        reviewed_at: now,
        reviewed_by: session.user.id,
      }).eq("id", item.id),
      supabase.from("notifications").insert({
        user_id: item.user_id,
        type: "image_approved",
        title: "이미지 제안 승인됨",
        body: `"${item.games?.name_ko}" 이미지 제안이 승인되었어요!`,
        related_id: item.id,
      }),
    ]);
    const failed = results.find((r) => r.error);
    if (failed) {
      Alert.alert("오류", failed.error.message);
    } else {
      Alert.alert("완료", "이미지가 업데이트되었어요.");
      loadData();
    }
  };

  const rejectImageProposal = async (item) => {
    const now = new Date().toISOString();
    const [proposalRes] = await Promise.all([
      supabase.from("image_proposals").update({
        status: "rejected",
        reviewed_at: now,
        reviewed_by: session.user.id,
      }).eq("id", item.id),
      supabase.from("notifications").insert({
        user_id: item.user_id,
        type: "image_rejected",
        title: "이미지 제안 반영 불가",
        body: `"${item.games?.name_ko}" 이미지 제안이 반영되지 않았어요.`,
        related_id: item.id,
      }),
    ]);
    if (proposalRes.error) {
      Alert.alert("오류", proposalRes.error.message);
    } else {
      setRejectTarget(null);
      loadData();
    }
  };

  if (!profile?.is_admin) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Text style={styles.noPermText}>🔒 권한이 없습니다</Text>
        <Text style={styles.noPermSub}>관리자만 접근할 수 있어요</Text>
      </View>
    );
  }

  const items =
    mainTab === "edits" ? edits :
    mainTab === "submissions" ? submissions :
    imageProposals;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🛠 관리자 검토</Text>
      </View>

      {/* Main tabs */}
      <View style={styles.mainTabRow}>
        {MAIN_TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[styles.mainTabBtn, mainTab === t.key && styles.mainTabBtnActive]}
            onPress={() => { setMainTab(t.key); setStatusTab("pending"); }}
          >
            <Text
              style={[
                styles.mainTabText,
                mainTab === t.key && styles.mainTabTextActive,
              ]}
            >
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Status sub-tabs */}
      <View style={styles.statusTabRow}>
        {STATUS_TABS.map((t) => (
          <TouchableOpacity
            key={t.key}
            style={[
              styles.statusTabBtn,
              statusTab === t.key && styles.statusTabBtnActive,
            ]}
            onPress={() => setStatusTab(t.key)}
          >
            <Text
              style={[
                styles.statusTabText,
                statusTab === t.key && styles.statusTabTextActive,
              ]}
            >
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.accent} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) =>
            mainTab === "edits" ? (
              <EditItem
                item={item}
                statusTab={statusTab}
                onApprove={approveEdit}
                onReject={(i) => setRejectTarget({ type: "edit", item: i })}
              />
            ) : mainTab === "submissions" ? (
              <SubmissionItem
                item={item}
                statusTab={statusTab}
                onApprove={approveSubmission}
                onReject={(i) => setRejectTarget({ type: "submission", item: i })}
              />
            ) : (
              <ImageProposalItem
                item={item}
                statusTab={statusTab}
                onApprove={approveImageProposal}
                onReject={(i) => setRejectTarget({ type: "image", item: i })}
              />
            )
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>항목이 없어요</Text>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      <RejectModal
        visible={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        onSubmit={(reason) => {
          if (!rejectTarget) return;
          if (rejectTarget.type === "edit") {
            rejectEdit(rejectTarget.item, reason);
          } else if (rejectTarget.type === "submission") {
            rejectSubmission(rejectTarget.item, reason);
          } else if (rejectTarget.type === "image") {
            rejectImageProposal(rejectTarget.item);
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 18, fontWeight: "800", color: COLORS.text },
  mainTabRow: {
    flexDirection: "row",
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  mainTabBtn: {
    flex: 1,
    paddingVertical: 13,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  mainTabBtnActive: { borderBottomColor: COLORS.accent },
  mainTabText: { fontSize: 14, fontWeight: "700", color: COLORS.subLight },
  mainTabTextActive: { color: COLORS.accent },
  statusTabRow: {
    flexDirection: "row",
    backgroundColor: "#f8f8f8",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  statusTabBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "#ececec",
  },
  statusTabBtnActive: { backgroundColor: COLORS.accent },
  statusTabText: { fontSize: 12, fontWeight: "600", color: COLORS.sub },
  statusTabTextActive: { color: "#fff" },
  listContent: { padding: 16, gap: 12 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 8,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  gameName: { fontSize: 15, fontWeight: "800", color: COLORS.text, flex: 1 },
  dateText: { fontSize: 11, color: COLORS.subLight },
  submitterText: { fontSize: 12, color: COLORS.sub },
  fieldRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    backgroundColor: "#f8f8f8",
    borderRadius: 8,
    padding: 10,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.accent,
    minWidth: 60,
  },
  fieldArrow: { fontSize: 12, color: COLORS.subLight },
  fieldValue: { flex: 1, fontSize: 13, color: COLORS.text },
  oldValue: { fontSize: 11, color: COLORS.subLight },
  gameDataRow: { gap: 4, backgroundColor: "#f8f8f8", borderRadius: 8, padding: 10 },
  dataText: { fontSize: 12, color: COLORS.text },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  actionText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeGood: { backgroundColor: "#dcfce7" },
  badgeError: { backgroundColor: "#fee2e2" },
  statusBadgeText: { fontSize: 12, fontWeight: "700", color: COLORS.text },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  noPermText: { fontSize: 20, fontWeight: "800", color: COLORS.text },
  noPermSub: { fontSize: 13, color: COLORS.subLight, marginTop: 8 },
  emptyText: { fontSize: 14, color: COLORS.sub },
  imgCompareRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#f8f8f8",
    borderRadius: 8,
    padding: 10,
  },
  imgCompareCol: { flex: 1, alignItems: "center", gap: 6 },
  imgCompareArrow: { width: 24, alignItems: "center" },
  imgCompareLabel: { fontSize: 10, fontWeight: "700", color: COLORS.sub },
  imgCompareThumbnail: { width: "100%", aspectRatio: 1, borderRadius: 8, backgroundColor: "#e5e7eb" },
  imgComparePlaceholder: { alignItems: "center", justifyContent: "center" },
});

const rm = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  sheet: {
    width: "100%",
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 20,
    gap: 14,
  },
  title: { fontSize: 16, fontWeight: "800", color: COLORS.text },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: COLORS.text,
    minHeight: 80,
    textAlignVertical: "top",
    backgroundColor: COLORS.bg,
  },
  btnRow: { flexDirection: "row", gap: 10 },
  btn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
});
