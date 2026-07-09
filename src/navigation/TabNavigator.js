import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/colors";
import HomeScreen from "../screens/HomeScreen";
import SearchScreen from "../screens/SearchScreen";
import MyPageScreen from "../screens/MyPageScreen";
import AdminScreen from "../screens/AdminScreen";

const Tab = createBottomTabNavigator();

function CustomTabBar({ state, descriptors, navigation, isAdmin }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.tabBar, { paddingBottom: insets.bottom }]}>
      {state.routes.map((route, index) => {
        if (route.name === "Admin" && !isAdmin) return null;

        const isFocused = state.index === index;

        const iconName = {
          Home: isFocused ? "home" : "home-outline",
          Search: isFocused ? "search" : "search-outline",
          MyPage: isFocused ? "person" : "person-outline",
          Admin: isFocused ? "construct" : "construct-outline",
        }[route.name];

        const label = {
          Home: "홈",
          Search: "검색",
          MyPage: "마이",
          Admin: "검토",
        }[route.name];

        return (
          <TouchableOpacity
            key={route.key}
            onPress={() => navigation.navigate(route.name)}
            style={styles.tabBtn}
            activeOpacity={0.7}
          >
            <Ionicons
              name={iconName}
              size={22}
              color={isFocused ? COLORS.accent : COLORS.subLight}
            />
            <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>
              {label}
            </Text>
            <View style={[styles.tabDot, isFocused && styles.tabDotActive]} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function TabNavigator({ session, profile }) {
  const isAdmin = profile?.is_admin ?? false;

  return (
    <Tab.Navigator
      tabBar={(props) => (
        <CustomTabBar
          {...props}
          isAdmin={isAdmin}
        />
      )}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home">
        {() => <HomeScreen session={session} />}
      </Tab.Screen>
      <Tab.Screen name="Search">
        {() => <SearchScreen session={session} />}
      </Tab.Screen>
      <Tab.Screen name="MyPage">
        {() => (
          <MyPageScreen
            session={session}
            profile={profile}
            isOwnPage={true}
          />
        )}
      </Tab.Screen>
      {isAdmin && (
        <Tab.Screen name="Admin">
          {() => <AdminScreen session={session} profile={profile} />}
        </Tab.Screen>
      )}
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: "row",
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    minHeight: 46,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 8,
  },
  tabBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 5,
    gap: 2,
  },
  tabLabel: { fontSize: 11, fontWeight: "600", color: COLORS.subLight, marginTop: 2 },
  tabLabelActive: { color: COLORS.accent },
  tabDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "transparent",
    marginTop: 2,
  },
  tabDotActive: { backgroundColor: COLORS.accent },
});
