export default {
  expo: {
    name: "BOGI",
    slug: "bogi",
    version: "1.0.0",
    sdkVersion: "54.0.0",
    orientation: "portrait",
    icon: "./assets/icon.png",
    userInterfaceStyle: "light",
    splash: {
      image: "./assets/splash.png",
      backgroundColor: "#1e643c",
      resizeMode: "contain",
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.ibogi.bogiapp",
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/adaptive-icon.png",
        backgroundColor: "#1e643c",
      },
      package: "com.bogi.app",
      versionCode: 2,
    },
    web: {
      favicon: "./assets/favicon.png",
    },
    plugins: ["expo-secure-store", "expo-font"],
    extra: {
      eas: {
        projectId: "37b426cb-adb6-4229-8ccd-5fb755a964bf",
      },
      supabaseUrl:
        process.env.EXPO_PUBLIC_SUPABASE_URL ||
        "https://nwvyezccwzkpyqiqaejk.supabase.co",
      supabaseAnonKey:
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53dnllemNjd3prcHlxaXFhZWprIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgzNTA4MTUsImV4cCI6MjA5MzkyNjgxNX0.eHvEbiwJYdWADXeY30sMLcaXmoxO3CKTMsvmMoUh7bY",
    },
    owner: "ibogi",
  },
};
