import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator,
  TouchableOpacity, Dimensions, Linking,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { supabase } from "../lib/supabase";
import { COLORS } from "../constants/colors";
import GameCard from "../components/GameCard";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const PADDING = 12;
const GAP = 8;
const CARD_WIDTH = (SCREEN_WIDTH - PADDING * 2 - GAP * 2) / 3;

export default function CollectionDetailScreen({ route, session }) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { slug } = route.params || {};

  const [collection, setCollection] = useState(null);
  const [items, setItems] = useState([]); // [{ game, note }]
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [reviewSummary, setReviewSummary] = useState({});

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
    if (session) refreshReviewSummary();
    else setReviewSummary({});
  }, [session, refreshReviewSummary]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setNotFound(false);

      const { data: col, error: colErr } = await supabase
        .from("collections")
        .select("*")
        .eq("slug", slug)
        .eq("is_published", true)
        .maybeSingle();

      if (colErr || !col) {
        setCollection(null);
        setItems([]);
        setNotFound(true);
        setLoading(false);
        return;
      }
      setCollection(col);

      const { data: cgRows } = await supabase
        .from("collection_games")
        .select("sort_order, note, games(*)")
        .eq("collection_id", col.id)
        .order("sort_order");

      setItems((cgRows || []).filter((r) => r.games).map((r) => ({ game: r.games, note: r.note })));
      setLoading(false);
    })();
  }, [slug]);

  const BackBtn = (
    <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} hitSlop={8}>
      <Text style={s.backBtnText}>← 뒤로</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={[s.container, { paddingTop: insets.top }]}>
        {BackBtn}
        <View style={s.center}>
          <ActivityIndicator size="large" color={COLORS.accent} />
        </View>
      </View>
    );
  }

  if (notFound || !collection) {
    return (
      <View style={[s.container, { paddingTop: insets.top }]}>
        {BackBtn}
        <View style={s.center}>
          <Text style={{ fontSize: 40, marginBottom: 10 }}>🔍</Text>
          <Text style={s.emptyText}>컬렉션을 찾을 수 없어요</Text>
        </View>
      </View>
    );
  }

  const ListHeader = (
    <View style={{ paddingBottom: 16 }}>
      <Text style={s.title}>{collection.title}</Text>
      {collection.subtitle ? <Text style={s.subtitle}>{collection.subtitle}</Text> : null}
      {collection.description ? <Text style={s.description}>{collection.description}</Text> : null}
      {collection.source_url ? (
        <TouchableOpacity
          onPress={() => Linking.openURL(collection.source_url)}
          style={s.sourcePill}
        >
          <Text style={s.sourcePillText}>🔗 출처 보기</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {BackBtn}
      <FlatList
        data={items}
        numColumns={3}
        keyExtractor={(item) => item.game.id.toString()}
        ListHeaderComponent={ListHeader}
        contentContainerStyle={{ paddingHorizontal: PADDING, paddingBottom: insets.bottom + 24 }}
        columnWrapperStyle={{ gap: GAP, marginBottom: GAP }}
        ListEmptyComponent={
          <View style={s.center}>
            <Text style={{ fontSize: 40, marginBottom: 10 }}>🎲</Text>
            <Text style={s.emptyText}>아직 등록된 게임이 없어요</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View>
            <GameCard
              game={item.game}
              session={session}
              reviewSummary={reviewSummary[item.game.id] || null}
              gameStat={null}
              onReviewSaved={refreshReviewSummary}
              cardWidth={CARD_WIDTH}
            />
            {item.note ? <Text style={s.note}>{item.note}</Text> : null}
          </View>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 80 },
  backBtn: { paddingHorizontal: PADDING, paddingVertical: 10 },
  backBtnText: { fontSize: 14, fontWeight: "600", color: COLORS.sub },
  title: { fontSize: 20, fontWeight: "800", color: COLORS.text, letterSpacing: -0.3, paddingHorizontal: PADDING },
  subtitle: { fontSize: 13, color: COLORS.sub, marginTop: 6, paddingHorizontal: PADDING },
  description: { fontSize: 14, color: COLORS.text, lineHeight: 21, marginTop: 12, paddingHorizontal: PADDING },
  sourcePill: {
    alignSelf: "flex-start",
    marginTop: 12,
    marginHorizontal: PADDING,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: COLORS.accentLight,
  },
  sourcePillText: { fontSize: 12, fontWeight: "700", color: COLORS.accent },
  emptyText: { fontSize: 14, color: COLORS.sub, textAlign: "center" },
  note: { fontSize: 11, color: COLORS.subLight, marginTop: 4, paddingHorizontal: 2, lineHeight: 15 },
});
