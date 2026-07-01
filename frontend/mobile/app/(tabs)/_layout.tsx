import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { useColorScheme, Pressable, View } from "react-native";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import Animated, { useAnimatedStyle, withSpring, useSharedValue } from "react-native-reanimated";

function TabBarIconWithIndicator({ name, color, focused }: { name: any; color: string; focused: boolean }) {
  const scale = useSharedValue(focused ? 1.15 : 1);
  const indicatorWidth = useSharedValue(focused ? 18 : 0);

  React.useEffect(() => {
    scale.value = withSpring(focused ? 1.15 : 1, { damping: 12, stiffness: 150 });
    indicatorWidth.value = withSpring(focused ? 18 : 0, { damping: 10, stiffness: 120 });
  }, [focused]);

  const animatedIconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const animatedIndicatorStyle = useAnimatedStyle(() => ({
    width: indicatorWidth.value,
  }));

  return (
    <View style={{ alignItems: "center", justifyContent: "center", height: "100%", paddingTop: 6 }}>
      <Animated.View style={[animatedIconStyle, { marginBottom: 4 }]}>
        <Ionicons name={name} size={22} color={color} />
      </Animated.View>
      <Animated.View 
        style={[
          animatedIndicatorStyle, 
          { 
            height: 3, 
            borderRadius: 1.5, 
            backgroundColor: focused ? "#10B981" : "transparent" 
          }
        ]} 
      />
    </View>
  );
}

export default function TabsLayout() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#10B981",
        tabBarInactiveTintColor: "#6B7280",
        tabBarStyle: {
          backgroundColor: isDark ? "rgba(17, 17, 24, 0.85)" : "rgba(255, 255, 255, 0.85)",
          borderTopColor: isDark ? "#2A2A38" : "#e2e8f0",
          borderTopWidth: 1,
          height: 65,
          position: "absolute",
          elevation: 0,
        },
        tabBarBackground: () => (
          <BlurView 
            tint={isDark ? "dark" : "light"} 
            intensity={80} 
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} 
          />
        ),
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
          tabBarButton: (props) => (
            <Pressable
              {...props}
              onPress={(e) => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                props.onPress?.(e);
              }}
            />
          ),
          tabBarIcon: ({ color, focused }) => (
            <TabBarIconWithIndicator name={focused ? "home" : "home-outline"} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="counsel"
        options={{
          title: "Counseling Compass",
          tabBarLabel: "Counsel",
          tabBarButton: (props) => (
            <Pressable
              {...props}
              onPress={(e) => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                props.onPress?.(e);
              }}
            />
          ),
          tabBarIcon: ({ color, focused }) => (
            <TabBarIconWithIndicator name={focused ? "compass" : "compass-outline"} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="branch"
        options={{
          title: "Branch Comparison Matrix",
          tabBarLabel: "Branch",
          tabBarButton: (props) => (
            <Pressable
              {...props}
              onPress={(e) => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                props.onPress?.(e);
              }}
            />
          ),
          tabBarIcon: ({ color, focused }) => (
            <TabBarIconWithIndicator name={focused ? "git-compare" : "git-compare-outline"} color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: "RAG Chat Assistant",
          headerShown: false,
          tabBarLabel: "Chat",
          tabBarButton: (props) => (
            <Pressable
              {...props}
              onPress={(e) => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                props.onPress?.(e);
              }}
            />
          ),
          tabBarIcon: ({ color, focused }) => (
            <TabBarIconWithIndicator name={focused ? "chatbubble-ellipses" : "chatbubble-ellipses-outline"} color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}
