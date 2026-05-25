import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/colors";
import { supabase } from "../lib/supabase";

const TYPE_ICON = {
  edit_approved: "✅",
  edit_rejected: "❌",
  submit_approved: "🎉",
  submit_rejected: "😞",
  review_like: "❤️",
  game_comment: "💬",
};

function timeAgo(ts) {
  if (!ts) return "";
  const diff = Date.now() - new Date(ts).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}일 전`;
  return new Date(ts).toLocaleDateString("ko-KR");
}

export default function NotificationBell({ session }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [visible, setVisible] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const intervalRef = useRef(null);

  const fetchUnread = async () => {
    if (!session?.user?.id) return;
    const { count } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", session.user.id)
      .eq("is_read", false);
    console.log("[NotificationBell] 미읽음:", count);
    setUnreadCount(count ?? 0);
  };

  useEffect(() => {
    fetchUnread();
    intervalRef.current = setInterval(fetchUnread, 30000);
    return () => clearInterval(intervalRef.current);
  }, [session?.user?.id]);

  const openModal = async () => {
    setVisible(true);
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false })
      .limit(30);
    console.log("[NotificationBell] 알림 로드:", data?.length);
    setNotifications(data ?? []);
    if (unreadCount > 0) {
      await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", session.user.id)
        .eq("is_read", false);
      setUnreadCount(0);
    }
  };

  return (
    <>
      <TouchableOpacity onPress={openModal} style={styles.bellBtn} hitSlop={8}>
        <Ionicons name="notifications-outline" size={24} color={COLORS.text} />
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {unreadCount > 99 ? "99+" : unreadCount}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={() => setVisible(false)}
        />
        <View style={styles.sheet}>
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>알림</Text>
            <TouchableOpacity onPress={() => setVisible(false)}>
              <Text style={{ color: COLORS.sub, fontSize: 16 }}>✕</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={notifications}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={[styles.notifItem, !item.is_read && styles.unread]}>
                <Text style={styles.notifIcon}>
                  {TYPE_ICON[item.type] ?? "🔔"}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.notifTitle}>{item.title}</Text>
                  {item.body ? (
                    <Text style={styles.notifBody}>{item.body}</Text>
                  ) : null}
                  <Text style={styles.notifTime}>
                    {timeAgo(item.created_at)}
                  </Text>
                </View>
              </View>
            )}
            ListEmptyComponent={
              <Text style={styles.emptyText}>알림이 없어요</Text>
            }
          />
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  bellBtn: { position: "relative", padding: 4 },
  badge: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: COLORS.error,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  badgeText: { color: "#fff", fontSize: 9, fontWeight: "800" },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    position: "absolute",
    top: 100,
    right: 16,
    width: 320,
    maxHeight: 480,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    overflow: "hidden",
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  sheetTitle: { fontSize: 15, fontWeight: "800", color: COLORS.text },
  notifItem: {
    flexDirection: "row",
    gap: 10,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  unread: { backgroundColor: "#fff8f5" },
  notifIcon: { fontSize: 20 },
  notifTitle: { fontSize: 13, fontWeight: "700", color: COLORS.text },
  notifBody: { fontSize: 12, color: COLORS.sub, marginTop: 2 },
  notifTime: { fontSize: 11, color: COLORS.subLight, marginTop: 4 },
  emptyText: {
    textAlign: "center",
    padding: 24,
    color: COLORS.subLight,
    fontSize: 13,
  },
});
