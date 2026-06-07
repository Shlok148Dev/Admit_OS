import React, { useState, createContext, useContext, useEffect } from "react";
import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useColorScheme as useNativeColorScheme, View, Platform } from "react-native";
import { colors } from "../src/theme/tokens";
import "../global.css";

// Safe NativeWind dark mode configuration
// Only attempt CSS interop config on native platforms where the module exists
function configureDarkMode(): void {
  if (Platform.OS === "web") return;
  try {
    const cssInterop = require("react-native-css-interop");
    if (cssInterop?.StyleSheet?.setFlag) {
      cssInterop.StyleSheet.setFlag("darkMode", "class");
    }
  } catch {
    // Module not available — NativeWind dark mode via class won't work,
    // but the app won't crash
  }
}
configureDarkMode();

export const ThemeContext = createContext({
  colorScheme: "light" as "light" | "dark",
  isDark: false,
  colors: colors,
});

export const useAppTheme = () => useContext(ThemeContext);

// Safe useColorScheme hook that works on both web and native
function useSafeColorScheme() {
  try {
    const nw = require("nativewind");
    if (nw?.useColorScheme) {
      return nw.useColorScheme();
    }
  } catch {
    // nativewind not available
  }
  return { colorScheme: "light" as const, setColorScheme: () => {} };
}

export default function RootLayout() {
  const systemColorScheme = useNativeColorScheme();
  const { colorScheme, setColorScheme } = useSafeColorScheme();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  useEffect(() => {
    if (systemColorScheme && setColorScheme) {
      setColorScheme(systemColorScheme);
    }
  }, [systemColorScheme]);

  const isDark = colorScheme === "dark";

  const themeValue = {
    colorScheme: (colorScheme || "light") as "light" | "dark",
    isDark,
    colors,
  };

  return (
    <ThemeContext.Provider value={themeValue}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider>
          <StatusBar style={isDark ? "light" : "dark"} />
          <View
            className={isDark ? "dark" : ""}
            style={{ flex: 1, backgroundColor: isDark ? "#111118" : "#ffffff" }}
          >
            <Stack
              screenOptions={{
                headerStyle: {
                  backgroundColor: isDark ? "#111118" : "#ffffff",
                },
                headerTitleStyle: {
                  fontWeight: "bold",
                  color: isDark ? "#F8FAFC" : "#063670",
                },
                headerTintColor: isDark ? "#2563EB" : "#0c7eff",
                headerShadowVisible: true,
              }}
            >
              <Stack.Screen
                name="(tabs)"
                options={{
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="onboarding"
                options={{
                  title: "Setup Profile",
                  headerShown: false,
                }}
              />
              <Stack.Screen
                name="rank-radar"
                options={{
                  title: "Rank Radar Predictor",
                }}
              />
              <Stack.Screen
                name="branch-details"
                options={{
                  title: "Branch Career Profile",
                }}
              />
            </Stack>
          </View>
        </SafeAreaProvider>
      </QueryClientProvider>
    </ThemeContext.Provider>
  );
}
