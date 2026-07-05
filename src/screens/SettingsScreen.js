import React, { useState, useEffect } from "react";
import {
  View, Text, TouchableOpacity, TextInput, ScrollView,
  Modal, Alert, StyleSheet, ActivityIndicator, Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/colors";
import { supabase } from "../lib/supabase";

const AVATAR_COLORS = ["#1e643c","#2563eb","#9333ea","#dc2626","#d97706","#0891b2","#db2777","#374151"];
const FEEDBACK_TYPES = [
  { value: "bug",     label: "🐛 버그 신고" },
  { value: "feature", label: "💡 기능 제안" },
  { value: "other",   label: "💬 기타" },
];
const PRIVACY_SECTIONS = [
  { title: "1. 수집하는 개인정보 항목", body: "• 계정 정보: 이메일 주소, 닉네임\n• 활동 정보: 보드게임 리뷰, 별점, 플레이 기록\n• 자동 수집 정보: 서비스 이용 기록 (Supabase 인증을 통해 처리)" },
  { title: "2. 개인정보 수집 및 이용 목적", body: "• 회원 식별 및 서비스 제공\n• 보드게임 리뷰·별점 기능 운영\n• 서비스 품질 개선 및 통계 분석\n• 공지사항 및 알림 발송" },
  { title: "3. 개인정보 보관 기간", body: "수집된 개인정보는 회원 탈퇴 시까지 보관하며, 탈퇴 요청 즉시 삭제합니다. 단, 관련 법령에 의해 보존이 필요한 경우 해당 기간 동안 보관합니다." },
  { title: "4. 개인정보의 제3자 제공", body: "BOGI는 이용자의 개인정보를 제3자에게 제공하지 않습니다. 단, 이용자가 사전에 동의한 경우 또는 법령의 규정에 따른 경우는 예외입니다." },
  { title: "5. 개인정보 처리 위탁", body: "서비스는 인증 및 데이터 저장을 위해 Supabase Inc.에 개인정보 처리를 위탁합니다. Supabase는 서비스 제공 목적 외로 개인정보를 활용하지 않습니다." },
  { title: "6. 이용자의 권리", body: "• 개인정보 열람 및 수정 요청\n• 개인정보 삭제 및 회원 탈퇴 요청\n• 개인정보 처리 정지 요청" },
  { title: "7. 개인정보 보호책임자 및 문의", body: "서비스명: BOGI\n담당자: 전준기\n이메일: talljoongi@gmail.com" },
];

export default function SettingsScreen({ visible, onClose, session, profile, onProfileUpdate }) {
  const [view, setView] = useState("main");

  // Edit profile
  const [editNickname, setEditNickname] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editPasswordConfirm, setEditPasswordConfirm] = useState("");
  const [editColor, setEditColor] = useState(COLORS.accent);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");
  const [editSuccess, setEditSuccess] = useState("");

  // Feedback
  const [fbType, setFbType] = useState("bug");
  const [fbTitle, setFbTitle] = useState("");
  const [fbDetail, setFbDetail] = useState("");
  const [fbSaving, setFbSaving] = useState(false);
  const [fbError, setFbError] = useState("");
  const [fbDone, setFbDone] = useState(false);

  useEffect(() => {
    if (visible) {
      setView("main");
      setEditNickname(profile?.nickname || "");
      setEditColor(profile?.avatar_color || COLORS.accent);
      setEditPassword("");
      setEditPasswordConfirm("");
      setEditError("");
      setEditSuccess("");
      setFbType("bug");
      setFbTitle("");
      setFbDetail("");
      setFbError("");
      setFbDone(false);
    }
  }, [visible, profile]);

  const handleSaveProfile = async () => {
    if (!editNickname.trim()) { setEditError("닉네임을 입력해주세요."); return; }
    if (editPassword && editPassword !== editPasswordConfirm) { setEditError("비밀번호가 일치하지 않아요."); return; }
    if (editPassword && editPassword.length < 6) { setEditError("비밀번호는 6자 이상이어야 해요."); return; }
    setEditSaving(true);
    setEditError("");
    setEditSuccess("");
    const { error: profErr } = await supabase.from("profiles")
      .update({ nickname: editNickname.trim(), avatar_color: editColor })
      .eq("id", session.user.id);
    if (profErr) { setEditSaving(false); setEditError(profErr.message); return; }
    if (editPassword) {
      const { error: pwErr } = await supabase.auth.updateUser({ password: editPassword });
      if (pwErr) { setEditSaving(false); setEditError(pwErr.message); return; }
    }
    setEditSaving(false);
    setEditSuccess("저장됐어요!");
    onProfileUpdate?.({ nickname: editNickname.trim(), avatar_color: editColor });
  };

  const handleFeedbackSubmit = async () => {
    if (!fbTitle.trim()) { setFbError("제목을 입력해주세요."); return; }
    setFbSaving(true);
    setFbError("");
    const { error } = await supabase.from("feedback").insert({
      user_id: session.user.id,
      type: fbType,
      title: fbTitle.trim(),
      detail: fbDetail.trim() || null,
      status: "pending",
    });
    setFbSaving(false);
    if (error) setFbError(error.message);
    else setFbDone(true);
  };

  const handleLogout = () => {
    Alert.alert("로그아웃", "정말 로그아웃 할까요?", [
      { text: "취소", style: "cancel" },
      { text: "로그아웃", style: "destructive", onPress: () => { supabase.auth.signOut(); onClose(); } },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert("회원탈퇴", "정말 탈퇴하시겠어요? 모든 데이터가 삭제됩니다.", [
      { text: "취소", style: "cancel" },
      {
        text: "탈퇴하기", style: "destructive", onPress: async () => {
          await supabase.from("reviews").delete().eq("user_id", session.user.id);
          await supabase.from("profiles").delete().eq("id", session.user.id);
          await supabase.auth.signOut();
          onClose();
        },
      },
    ]);
  };

  const goBack = () => {
    if (view !== "main") setView("main");
    else onClose();
  };

  const Header = ({ title }) => (
    <View style={s.header}>
      <TouchableOpacity onPress={goBack} hitSlop={8}>
        <Ionicons name="chevron-back" size={24} color={COLORS.text} />
      </TouchableOpacity>
      <Text style={s.headerTitle}>{title}</Text>
      <TouchableOpacity onPress={onClose} hitSlop={8}>
        <Ionicons name="close" size={24} color={COLORS.text} />
      </TouchableOpacity>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={s.container}>

        {/* ── 메인 설정 목록 ── */}
        {view === "main" && (
          <>
            <View style={s.header}>
              <View style={{ width: 24 }} />
              <Text style={s.headerTitle}>설정</Text>
              <TouchableOpacity onPress={onClose} hitSlop={8}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <ScrollView>
              <Text style={s.sectionLabel}>계정</Text>
              <TouchableOpacity style={s.row} onPress={() => setView("edit")}>
                <Text style={s.rowLabel}>회원정보 수정</Text>
                <Ionicons name="chevron-forward" size={18} color={COLORS.subLight} />
              </TouchableOpacity>

              <Text style={s.sectionLabel}>서비스</Text>
              <TouchableOpacity style={s.row} onPress={() => setView("privacy")}>
                <Text style={s.rowLabel}>개인정보처리방침</Text>
                <Ionicons name="chevron-forward" size={18} color={COLORS.subLight} />
              </TouchableOpacity>
              <View style={s.rowDivider} />
              <TouchableOpacity style={s.row} onPress={() => { setFbDone(false); setView("feedback"); }}>
                <Text style={s.rowLabel}>오류신고 / 피드백</Text>
                <Ionicons name="chevron-forward" size={18} color={COLORS.subLight} />
              </TouchableOpacity>

              <View style={[s.rowDivider, { marginTop: 16 }]} />
              <TouchableOpacity style={s.row} onPress={handleLogout}>
                <Text style={[s.rowLabel, { color: "#ef4444" }]}>로그아웃</Text>
              </TouchableOpacity>
              <View style={s.rowDivider} />
              <TouchableOpacity style={s.row} onPress={handleDeleteAccount}>
                <Text style={[s.rowLabel, { color: COLORS.subLight }]}>회원탈퇴</Text>
              </TouchableOpacity>

              <View style={s.bggContainer}>
                <TouchableOpacity onPress={() => Linking.openURL("https://boardgamegeek.com")}>
                  <Text style={s.bggText}>Powered by BoardGameGeek</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </>
        )}

        {/* ── 회원정보 수정 ── */}
        {view === "edit" && (
          <>
            <Header title="회원정보 수정" />
            <ScrollView contentContainerStyle={s.formContent} keyboardShouldPersistTaps="handled">
              <Text style={s.formLabel}>아바타 색상</Text>
              <View style={s.colorRow}>
                {AVATAR_COLORS.map((c) => (
                  <TouchableOpacity
                    key={c} onPress={() => setEditColor(c)}
                    style={[s.colorDot, { backgroundColor: c }, editColor === c && s.colorDotSelected]}
                  />
                ))}
              </View>

              <Text style={s.formLabel}>닉네임</Text>
              <TextInput value={editNickname} onChangeText={setEditNickname} style={s.input} placeholderTextColor={COLORS.subLight} />

              <Text style={s.formLabel}>새 비밀번호{" "}<Text style={s.optLabel}>선택</Text></Text>
              <TextInput
                value={editPassword} onChangeText={setEditPassword}
                secureTextEntry placeholder="변경하지 않으면 비워두세요"
                placeholderTextColor={COLORS.subLight} style={s.input}
              />

              {editPassword.length > 0 && (
                <>
                  <Text style={s.formLabel}>비밀번호 확인</Text>
                  <TextInput
                    value={editPasswordConfirm} onChangeText={setEditPasswordConfirm}
                    secureTextEntry style={s.input} placeholderTextColor={COLORS.subLight}
                  />
                </>
              )}

              {editError ? <Text style={s.errorText}>{editError}</Text> : null}
              {editSuccess ? <Text style={s.successText}>{editSuccess}</Text> : null}

              <TouchableOpacity onPress={handleSaveProfile} disabled={editSaving} style={[s.submitBtn, editSaving && { opacity: 0.5 }]}>
                {editSaving ? <ActivityIndicator color="#fff" /> : <Text style={s.submitText}>저장하기</Text>}
              </TouchableOpacity>
            </ScrollView>
          </>
        )}

        {/* ── 개인정보처리방침 ── */}
        {view === "privacy" && (
          <>
            <Header title="개인정보처리방침" />
            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 48 }}>
              <View style={{ backgroundColor: COLORS.accentLight, borderRadius: 10, padding: 14, marginBottom: 20 }}>
                <Text style={{ fontSize: 13, color: COLORS.accent, fontWeight: "600", lineHeight: 22 }}>
                  BOGI(이하 "서비스")는 이용자의 개인정보를 소중히 여깁니다. 본 방침은 서비스 이용 중 수집되는 개인정보의 처리 방법을 설명합니다.
                </Text>
              </View>
              {PRIVACY_SECTIONS.map(({ title, body }) => (
                <View key={title} style={{ marginBottom: 20 }}>
                  <Text style={{ fontSize: 14, fontWeight: "800", color: COLORS.accent, marginBottom: 8 }}>{title}</Text>
                  <Text style={{ fontSize: 13, color: COLORS.text, lineHeight: 22 }}>{body}</Text>
                </View>
              ))}
              <Text style={{ fontSize: 11, color: COLORS.subLight, textAlign: "center", marginTop: 8 }}>최종 업데이트: 2026년 6월</Text>
            </ScrollView>
          </>
        )}

        {/* ── 오류신고 / 피드백 ── */}
        {view === "feedback" && (
          <>
            <Header title="오류신고 / 피드백" />
            <ScrollView contentContainerStyle={s.formContent} keyboardShouldPersistTaps="handled">
              {fbDone ? (
                <View style={{ alignItems: "center", paddingVertical: 40 }}>
                  <Text style={{ fontSize: 48, marginBottom: 16 }}>✅</Text>
                  <Text style={{ fontSize: 18, fontWeight: "800", color: COLORS.text, marginBottom: 8 }}>피드백이 접수됐습니다!</Text>
                  <Text style={{ fontSize: 14, color: COLORS.sub, marginBottom: 32 }}>소중한 의견 감사합니다.</Text>
                  <TouchableOpacity onPress={() => setView("main")} style={s.submitBtn}>
                    <Text style={s.submitText}>닫기</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <Text style={s.formLabel}>유형</Text>
                  <View style={{ flexDirection: "row", gap: 8, marginBottom: 4 }}>
                    {FEEDBACK_TYPES.map(({ value, label }) => (
                      <TouchableOpacity
                        key={value} onPress={() => setFbType(value)}
                        style={[s.typeBtn, fbType === value && s.typeBtnActive]}
                      >
                        <Text style={[s.typeBtnText, fbType === value && s.typeBtnTextActive]}>{label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={s.formLabel}>제목 <Text style={{ color: COLORS.accent }}>*</Text></Text>
                  <TextInput
                    value={fbTitle} onChangeText={setFbTitle}
                    placeholder="간략하게 제목을 입력해주세요"
                    placeholderTextColor={COLORS.subLight} style={s.input}
                  />

                  <Text style={s.formLabel}>상세 내용{" "}<Text style={s.optLabel}>선택</Text></Text>
                  <TextInput
                    value={fbDetail} onChangeText={setFbDetail}
                    placeholder="자세한 내용을 입력해주세요"
                    placeholderTextColor={COLORS.subLight}
                    style={[s.input, { height: 100, textAlignVertical: "top" }]}
                    multiline
                  />

                  {fbError ? <Text style={s.errorText}>{fbError}</Text> : null}

                  <TouchableOpacity onPress={handleFeedbackSubmit} disabled={fbSaving} style={[s.submitBtn, fbSaving && { opacity: 0.5 }]}>
                    {fbSaving ? <ActivityIndicator color="#fff" /> : <Text style={s.submitText}>제출하기</Text>}
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </>
        )}

      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  headerTitle: { fontSize: 16, fontWeight: "800", color: COLORS.text, flex: 1, textAlign: "center" },
  sectionLabel: {
    fontSize: 11, fontWeight: "700", color: COLORS.subLight,
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 6, letterSpacing: 0.5,
  },
  row: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: COLORS.surface, paddingHorizontal: 20, paddingVertical: 16,
  },
  rowLabel: { fontSize: 15, color: COLORS.text, fontWeight: "500" },
  rowDivider: { height: 1, backgroundColor: COLORS.border, marginHorizontal: 20 },
  bggContainer: { paddingVertical: 24, alignItems: "center" },
  bggText: { fontSize: 11, color: COLORS.subLight },
  formContent: { padding: 20, paddingBottom: 48, gap: 2 },
  formLabel: { fontSize: 12, fontWeight: "700", color: COLORS.sub, marginBottom: 6, marginTop: 14 },
  optLabel: { fontSize: 11, color: COLORS.subLight, fontWeight: "400" },
  input: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 10,
    padding: 12, fontSize: 14, color: COLORS.text,
    backgroundColor: COLORS.surface,
  },
  colorRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 4, marginTop: 4 },
  colorDot: { width: 38, height: 38, borderRadius: 19, borderWidth: 3, borderColor: "transparent" },
  colorDotSelected: { borderColor: "#1a1a1a" },
  errorText: { fontSize: 12, color: COLORS.error, marginTop: 8 },
  successText: { fontSize: 12, color: COLORS.accent, marginTop: 8 },
  submitBtn: {
    backgroundColor: COLORS.accent, borderRadius: 12,
    paddingVertical: 15, alignItems: "center", marginTop: 20,
  },
  submitText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  typeBtn: {
    flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center",
    borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.bg,
  },
  typeBtnActive: { borderColor: COLORS.accent, backgroundColor: COLORS.accentLight },
  typeBtnText: { fontSize: 12, fontWeight: "700", color: COLORS.sub },
  typeBtnTextActive: { color: COLORS.accent },
});
