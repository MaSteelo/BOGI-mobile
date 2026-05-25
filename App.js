import "react-native-gesture-handler";
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { supabase } from "./src/lib/supabase";
import { COLORS } from "./src/constants/colors";
import AuthScreen from "./src/screens/AuthScreen";
import TabNavigator from "./src/navigation/TabNavigator";
import UserProfileScreen from "./src/screens/UserProfileScreen";

const Stack = createStackNavigator();

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    // 초기 세션 확인
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("[App] 초기 세션:", session?.user?.email ?? "없음");
      setSession(session);
      setAuthLoading(false);
    });

    // 인증 상태 변경 구독
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      console.log("[App] 인증 상태 변경:", _event, session?.user?.email ?? "없음");
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 세션이 생기면 프로필 로드
  useEffect(() => {
    if (!session) {
      setProfile(null);
      return;
    }
    supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single()
      .then(({ data, error }) => {
        if (error) console.warn("[App] 프로필 로드 오류:", error.message);
        console.log("[App] 프로필:", data?.nickname);
        setProfile(data);
      });
  }, [session]);

  if (authLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>로딩 중...</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="dark" />
        {session ? (
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Main">
              {() => <TabNavigator session={session} profile={profile} />}
            </Stack.Screen>
            <Stack.Screen name="UserProfile">
              {(props) => <UserProfileScreen {...props} session={session} />}
            </Stack.Screen>
          </Stack.Navigator>
        ) : (
          <AuthScreen />
        )}
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: COLORS.bg,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.subLight,
  },
});
