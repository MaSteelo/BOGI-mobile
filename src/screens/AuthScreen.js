import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";
import { COLORS } from "../constants/colors";

// mode: "signin" | "signup" | "reset"
export default function AuthScreen() {
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [focusedField, setFocusedField] = useState(null);

  const switchMode = (next) => {
    setMode(next);
    setMessage("");
  };

  const handleSubmit = async () => {
    setLoading(true);
    setMessage("");
    try {
      if (mode === "signup") {
        if (!nickname.trim()) {
          setMessage("닉네임을 입력해주세요");
          setLoading(false);
          return;
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { nickname: nickname.trim() } },
        });
        if (error) throw error;
        setMessage("✅ 가입 성공! 로그인됩니다...");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        console.log("[Auth] 로그인 성공, keepSignedIn:", keepSignedIn);
        // keepSignedIn=false 이면 앱 세션만 유지 (SecureStore에 저장은 됨)
        // 네이티브에서는 beforeunload 없으므로 별도 처리 없음
      }
    } catch (err) {
      console.log("[Auth] 오류:", err.message);
      setMessage("❌ " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setLoading(true);
    setMessage("");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      if (error) throw error;
      setMessage("✅ 이메일을 확인해주세요! 재설정 링크를 보냈어요");
    } catch (err) {
      console.log("[Auth] 비밀번호 재설정 오류:", err.message);
      setMessage("❌ " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const headerTitle =
    mode === "signin" ? "로그인" :
    mode === "signup" ? "회원가입" :
    "비밀번호 재설정";

  const headerSub =
    mode === "reset"
      ? "가입한 이메일을 입력하면 재설정 링크를 보내드려요"
      : "보드게임을 기록하고, 취향을 발견하세요";

  const inputStyle = (field) => [
    styles.input,
    focusedField === field && styles.inputFocused,
  ];

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── 브랜드 ── */}
        <View style={styles.brand}>
          <View style={styles.brandRow}>
            <Text style={styles.brandEmoji}>🎲</Text>
            <Text style={styles.brandName}>BOGI</Text>
          </View>
          <Text style={styles.brandTitle}>{headerTitle}</Text>
          <Text style={styles.brandSub}>{headerSub}</Text>
        </View>

        {/* ── 카드 ── */}
        <View style={styles.card}>
          {/* 비밀번호 재설정 폼 */}
          {mode === "reset" ? (
            <>
              <Text style={styles.label}>이메일</Text>
              <TextInput
                style={inputStyle("email")}
                value={email}
                onChangeText={setEmail}
                onFocus={() => setFocusedField("email")}
                onBlur={() => setFocusedField(null)}
                placeholder="가입 시 사용한 이메일"
                placeholderTextColor={COLORS.subLight}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              {!!message && <MessageBox message={message} />}
              <TouchableOpacity
                style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
                onPress={handleReset}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.submitBtnText}>재설정 메일 보내기</Text>}
              </TouchableOpacity>
            </>
          ) : (
            /* 로그인 / 회원가입 폼 */
            <>
              {mode === "signup" && (
                <>
                  <Text style={styles.label}>닉네임</Text>
                  <TextInput
                    style={inputStyle("nickname")}
                    value={nickname}
                    onChangeText={setNickname}
                    onFocus={() => setFocusedField("nickname")}
                    onBlur={() => setFocusedField(null)}
                    placeholder="다른 사용자에게 표시될 이름"
                    placeholderTextColor={COLORS.subLight}
                    autoCorrect={false}
                  />
                </>
              )}

              <Text style={styles.label}>이메일</Text>
              <TextInput
                style={inputStyle("email")}
                value={email}
                onChangeText={setEmail}
                onFocus={() => setFocusedField("email")}
                onBlur={() => setFocusedField(null)}
                placeholder="you@example.com"
                placeholderTextColor={COLORS.subLight}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <View style={styles.passwordLabelRow}>
                <Text style={styles.label}>비밀번호</Text>
                {mode === "signin" && (
                  <TouchableOpacity onPress={() => switchMode("reset")}>
                    <Text style={styles.forgotText}>비밀번호를 잊으셨나요?</Text>
                  </TouchableOpacity>
                )}
              </View>
              <TextInput
                style={inputStyle("password")}
                value={password}
                onChangeText={setPassword}
                onFocus={() => setFocusedField("password")}
                onBlur={() => setFocusedField(null)}
                placeholder="최소 6자"
                placeholderTextColor={COLORS.subLight}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />

              {/* 로그인 상태 유지 */}
              {mode === "signin" && (
                <TouchableOpacity
                  style={styles.checkRow}
                  onPress={() => setKeepSignedIn((v) => !v)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.checkbox, keepSignedIn && styles.checkboxActive]}>
                    {keepSignedIn && <Text style={styles.checkmark}>✓</Text>}
                  </View>
                  <Text style={styles.checkLabel}>로그인 상태 유지</Text>
                </TouchableOpacity>
              )}

              {!!message && <MessageBox message={message} />}

              <TouchableOpacity
                style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
                onPress={handleSubmit}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.submitBtnText}>
                      {mode === "signin" ? "로그인" : "가입하기"}
                    </Text>}
              </TouchableOpacity>
            </>
          )}

          {/* ── 소셜 로그인 (signin/signup 전용) ── */}
          {mode !== "reset" && (
            <>
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>또는</Text>
                <View style={styles.dividerLine} />
              </View>

              <View style={styles.socialRow}>
                <TouchableOpacity
                  style={styles.googleBtn}
                  onPress={() => Alert.alert("준비 중입니다")}
                  activeOpacity={0.8}
                >
                  <Text style={styles.googleG}>G</Text>
                  <Text style={styles.socialBtnText}>Google</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.kakaoBtn}
                  onPress={() => Alert.alert("준비 중입니다")}
                  activeOpacity={0.8}
                >
                  <Text style={styles.kakaoK}>K</Text>
                  <Text style={styles.socialBtnText}>Kakao</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* ── 모드 전환 ── */}
          <View style={styles.modeSwitchRow}>
            {mode === "reset" ? (
              <TouchableOpacity onPress={() => switchMode("signin")}>
                <Text style={styles.modeSwitchAccent}>← 로그인으로 돌아가기</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.modeSwitchInline}>
                <Text style={styles.modeSwitchSub}>
                  {mode === "signin" ? "계정이 없으신가요? " : "이미 가입했나요? "}
                </Text>
                <TouchableOpacity onPress={() => switchMode(mode === "signin" ? "signup" : "signin")}>
                  <Text style={styles.modeSwitchAccent}>
                    {mode === "signin" ? "회원가입" : "로그인"}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>

        {/* ── 푸터 ── */}
        <Text style={styles.footer}>© 2025 BOGI</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function MessageBox({ message }) {
  const isSuccess = message.startsWith("✅");
  return (
    <View style={[styles.messageBox, isSuccess ? styles.messageBoxSuccess : styles.messageBoxError]}>
      <Text style={[styles.messageText, isSuccess ? styles.messageTextSuccess : styles.messageTextError]}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: COLORS.bg,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  brand: {
    alignItems: "center",
    marginBottom: 28,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10,
  },
  brandEmoji: {
    fontSize: 22,
  },
  brandName: {
    fontSize: 28,
    fontWeight: "900",
    color: COLORS.accent,
    letterSpacing: 6,
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: COLORS.text,
    marginBottom: 6,
  },
  brandSub: {
    fontSize: 13,
    color: COLORS.sub,
    textAlign: "center",
  },
  card: {
    width: "100%",
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 4,
  },
  label: {
    fontSize: 12,
    color: COLORS.sub,
    fontWeight: "600",
    marginBottom: 6,
  },
  input: {
    width: "100%",
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: COLORS.text,
    marginBottom: 14,
  },
  inputFocused: {
    borderColor: COLORS.accent,
    shadowColor: COLORS.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  passwordLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  forgotText: {
    fontSize: 12,
    color: COLORS.subLight,
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.surface,
  },
  checkboxActive: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accent,
  },
  checkmark: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  checkLabel: {
    fontSize: 12,
    color: COLORS.sub,
  },
  submitBtn: {
    backgroundColor: COLORS.accent,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  messageBox: {
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  messageBoxSuccess: {
    backgroundColor: "#dcfce7",
  },
  messageBoxError: {
    backgroundColor: "#fee2e2",
  },
  messageText: {
    fontSize: 13,
  },
  messageTextSuccess: {
    color: "#166534",
  },
  messageTextError: {
    color: COLORS.error,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    fontSize: 12,
    color: COLORS.subLight,
  },
  socialRow: {
    flexDirection: "row",
    gap: 10,
  },
  googleBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingVertical: 11,
  },
  googleG: {
    fontSize: 15,
    fontWeight: "900",
    color: "#4285F4",
  },
  kakaoBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    backgroundColor: "#FEE500",
    borderRadius: 10,
    paddingVertical: 11,
  },
  kakaoK: {
    fontSize: 15,
    fontWeight: "900",
    color: COLORS.text,
  },
  socialBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
  },
  modeSwitchRow: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    alignItems: "center",
  },
  modeSwitchInline: {
    flexDirection: "row",
    alignItems: "center",
  },
  modeSwitchSub: {
    fontSize: 13,
    color: COLORS.sub,
  },
  modeSwitchAccent: {
    fontSize: 13,
    color: COLORS.accent,
    fontWeight: "700",
  },
  footer: {
    marginTop: 24,
    fontSize: 11,
    color: COLORS.subLight,
  },
});
