import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { useColorScheme } from "react-native";

export default function TabsLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#2563EB",
        tabBarInactiveTintColor: "#6B7280",
        tabBarStyle: {
          backgroundColor: "#111118",
          borderTopColor: "#2A2A38",
          borderTopWidth: 1,
          paddingBottom: 5,
          paddingTop: 5,
          height: 60,
        },
        headerStyle: {
          backgroundColor: isDark ? "#111118" : "#ffffff",
          borderBottomColor: isDark ? "#2A2A38" : "#e2e8f0",
          borderBottomWidth: 1,
          shadowOpacity: 0,
          elevation: 0,
        },
        headerTitleStyle: {
          fontWeight: "bold",
          color: isDark ? "#F8FAFC" : "#063670",
        },
        headerTintColor: isDark ? "#2563EB" : "#0c7eff",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "ADMIT OS",
          headerShown: false,
          tabBarLabel: "Dashboard",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "home" : "home-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="counsel"
        options={{
          title: "Counseling Compass",
          tabBarLabel: "Counsel",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "compass" : "compass-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="branch"
        options={{
          title: "Branch Comparison Matrix",
          tabBarLabel: "Branch",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "git-compare" : "git-compare-outline"} size={22} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "RAG Chat Assistant",
          headerShown: false,
          tabBarLabel: "Chat",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? "chatbubble-ellipses" : "chatbubble-ellipses-outline"} size={22} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
