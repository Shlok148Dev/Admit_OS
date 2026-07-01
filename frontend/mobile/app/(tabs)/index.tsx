import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, Pressable, SafeAreaView, ActivityIndicator, FlatList } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import Animated, { FadeInDown, FadeInRight } from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { storage } from "../../src/lib/storage";
import { getUpcomingEvents, getNotifications, predictCollegesMobile } from "../../src/lib/api";
import EventsCalendar from "../../src/components/EventsCalendar";
import NotificationsFeed from "../../src/components/NotificationsFeed";
import NotificationSettings from "../../src/components/NotificationSettings";

type TabName = "dashboard" | "alerts" | "settings";

export default function HomeScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabName>("dashboard");
  const [checkingOnboard, setCheckingOnboard] = useState(true);
  const [profile, setProfile] = useState<any>(null);

  // Check onboarding status and load profile
  useEffect(() => {
    const hasOnboarded = storage.getString("has_onboarded_v1");
    if (hasOnboarded !== "true") {
      const timer = setTimeout(() => {
        router.replace("/onboarding");
      }, 0);
      return () => clearTimeout(timer);
    } else {
      const rawProfile = storage.getString("student_profile_v1");
      if (rawProfile) {
        setProfile(JSON.parse(rawProfile));
      } else {
        setProfile({
          name: "Shlok Gupta",
          primary_exam: "JEE_MAIN",
          rank: 12500,
          category: "OBC-NCL",
          home_state: "MH",
          gender: "M",
          percentile: 98.8
        });
      }
      setCheckingOnboard(false);
    }
  }, []);

  // Fetch notifications
  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: getNotifications,
    enabled: !checkingOnboard
  });
  const latestNotification = notifications?.[0];

  // Fetch upcoming milestones
  const { data: events = [] } = useQuery({
    queryKey: ["upcomingEvents"],
    queryFn: getUpcomingEvents,
    enabled: !checkingOnboard
  });

  // Fetch predictions for highlights
  const { data: predictionData, isLoading: loadingPredictions } = useQuery({
    queryKey: ["homePredictions", profile],
    queryFn: () => {
      if (!profile) return null;
      return predictCollegesMobile({
        exam: profile.primary_exam,
        rank: profile.rank,
        percentile: profile.percentile || 98.5,
        category: profile.category,
        home_state: profile.home_state,
        gender: profile.gender,
        year: 2026
      });
    },
    enabled: !!profile && !checkingOnboard
  });

  if (checkingOnboard) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 dark:bg-[#111118] justify-center items-center">
        <ActivityIndicator size="large" color="#10B981" />
      </SafeAreaView>
    );
  }

  // Calculate countdown
  const userEvent = events?.find((e: any) => e.exam === profile?.primary_exam) || events?.[0];
  let daysDiff = 0;
  if (userEvent) {
    const eventDate = new Date(userEvent.date);
    const today = new Date();
    daysDiff = Math.max(0, Math.ceil((eventDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
  }

  const topPredictions = predictionData?.predictions?.slice(0, 5) || [];

  const renderActiveContent = () => {
    switch (activeTab) {
      case "alerts":
        return <NotificationsFeed />;
      case "settings":
        return <NotificationSettings />;
      case "dashboard":
      default:
        return (
          <ScrollView className="flex-1" contentContainerStyle={{ gap: 20, paddingBottom: 80 }} showsVerticalScrollIndicator={false}>
            {/* Personal Header */}
            <Animated.View entering={FadeInDown.delay(100).duration(450)}>
              <LinearGradient
                colors={["#0F172A", "#1E293B"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ borderRadius: 24, padding: 20, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 10, elevation: 5 }}
              >
                <View className="flex-row justify-between items-center mb-4">
                  <View className="flex-row items-center space-x-3">
                    <View className="w-12 h-12 rounded-full bg-emerald-500 justify-center items-center">
                      <Text className="text-white font-black text-lg">{profile?.name ? profile.name.charAt(0) : "S"}</Text>
                    </View>
                    <View>
                      <Text className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Welcome back</Text>
                      <Text className="text-white text-base font-extrabold">{profile?.name || "Aspirant"}</Text>
                    </View>
                  </View>
                  <View className="bg-emerald-500/20 border border-emerald-500/30 px-3 py-1 rounded-full">
                    <Text className="text-emerald-400 text-[10px] font-black">{profile?.primary_exam?.replace("_", " ")}</Text>
                  </View>
                </View>
                
                <View className="flex-row justify-between pt-3 border-t border-slate-700/50">
                  <View>
                    <Text className="text-slate-400 text-[9px] uppercase font-bold">AIR Rank</Text>
                    <Text className="text-white text-base font-black">#{profile?.rank}</Text>
                  </View>
                  <View>
                    <Text className="text-slate-400 text-[9px] uppercase font-bold">Category</Text>
                    <Text className="text-white text-base font-black">{profile?.category}</Text>
                  </View>
                  <View>
                    <Text className="text-slate-400 text-[9px] uppercase font-bold">Quota State</Text>
                    <Text className="text-white text-base font-black">{profile?.home_state}</Text>
                  </View>
                </View>
              </LinearGradient>
            </Animated.View>

            {/* Countdown Milestone */}
            {userEvent && (
              <Animated.View entering={FadeInDown.delay(200).duration(450)}>
                <View className="bg-white dark:bg-[#1A1A24] border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm flex-row items-center justify-between">
                  <View className="flex-1 pr-4 space-y-1">
                    <Text className="text-red-500 dark:text-red-400 text-[9px] font-extrabold uppercase tracking-wider flex-row items-center">
                      <Ionicons name="time" size={10} /> Active Countdown
                    </Text>
                    <Text className="text-slate-850 dark:text-slate-100 text-xs font-black" numberOfLines={1}>
                      {userEvent.title}
                    </Text>
                    <Text className="text-slate-500 dark:text-slate-400 text-[9px]">
                      {new Date(userEvent.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </Text>
                  </View>
                  <View className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/40 p-3.5 rounded-2xl items-center justify-center min-w-[70px]">
                    <Text className="text-rose-600 dark:text-rose-450 text-2xl font-black">{daysDiff}</Text>
                    <Text className="text-rose-500 dark:text-rose-400 text-[8px] font-bold uppercase">Days Left</Text>
                  </View>
                </View>
              </Animated.View>
            )}

            {/* Quick Actions Grid */}
            <View className="space-y-3">
              <Text className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-1">Quick Actions Suite</Text>
              <View className="flex-row flex-wrap justify-between" style={{ gap: 12 }}>
                {[
                  {
                    title: "Rank Radar",
                    subtitle: "Full Prediction",
                    icon: "radar-outline",
                    route: "/rank-radar",
                    colors: ["#3B82F6", "#1D4ED8"]
                  },
                  {
                    title: "Compare Branches",
                    subtitle: "Placements & Fees",
                    icon: "git-compare-outline",
                    route: "/branch",
                    colors: ["#10B981", "#047857"]
                  },
                  {
                    title: "Compass Guide",
                    subtitle: "Preference Matrix",
                    icon: "compass-outline",
                    route: "/counsel",
                    colors: ["#8B5CF6", "#6D28D9"]
                  },
                  {
                    title: "Chat Assistant",
                    subtitle: "Admissions RAG",
                    icon: "chatbubbles-outline",
                    route: "/chat",
                    colors: ["#F59E0B", "#D97706"]
                  }
                ].map((act, idx) => (
                  <Pressable
                    key={idx}
                    onPress={() => router.push(act.route as any)}
                    style={{ width: "48%" }}
                  >
                    <LinearGradient
                      colors={act.colors as any}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={{ borderRadius: 20, padding: 14, minHeight: 110, justifyContent: "space-between" }}
                    >
                      <View className="bg-white/20 w-8 h-8 rounded-lg justify-center items-center">
                        <Ionicons name={act.icon as any} size={18} color="white" />
                      </View>
                      <View>
                        <Text className="text-white text-xs font-black leading-snug">{act.title}</Text>
                        <Text className="text-white/80 text-[8px] font-bold">{act.subtitle}</Text>
                      </View>
                    </LinearGradient>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Live Alerts Notice Banner */}
            {latestNotification && (
              <Animated.View entering={FadeInDown.delay(300).duration(450)}>
                <Pressable
                  onPress={() => setActiveTab("alerts")}
                  className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/40 rounded-2xl p-4 flex-row items-center space-x-3 active:opacity-90"
                >
                  <View className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <View className="flex-1">
                    <Text className="text-[9px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">LATEST OFFICIAL ALERT</Text>
                    <Text className="text-slate-800 dark:text-slate-100 text-xs font-bold mt-0.5" numberOfLines={1}>
                      {latestNotification.title}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={14} color="#10B981" />
                </Pressable>
              </Animated.View>
            )}

            {/* Top Recommended Colleges (Horizontal) */}
            <View className="space-y-3">
              <View className="flex-row justify-between items-center px-1">
                <Text className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Top College Matches</Text>
                <Pressable onPress={() => router.push("/rank-radar")}>
                  <Text className="text-[9px] font-bold text-emerald-500 uppercase">View All ({topPredictions.length})</Text>
                </Pressable>
              </View>

              {loadingPredictions ? (
                <View className="py-10 justify-center items-center bg-white dark:bg-[#1A1A24] border border-slate-200 dark:border-slate-850 rounded-2xl">
                  <ActivityIndicator size="small" color="#10B981" />
                </View>
              ) : topPredictions.length === 0 ? (
                <View className="py-10 justify-center items-center bg-white dark:bg-[#1A1A24] border border-slate-200 dark:border-slate-850 rounded-2xl">
                  <Text className="text-xs text-slate-400 dark:text-slate-500">No predictions found. Launch Radar to compute.</Text>
                </View>
              ) : (
                <FlatList
                  data={topPredictions}
                  keyExtractor={(item, idx) => `${item.college_code}-${item.branch_code}-${idx}`}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: 12, paddingHorizontal: 2 }}
                  renderItem={({ item, index }) => (
                    <Animated.View
                      entering={FadeInRight.delay(index * 100).duration(400)}
                      className="bg-white dark:bg-[#1A1A24] border border-slate-200 dark:border-slate-800 p-4 rounded-2xl w-56 space-y-3"
                    >
                      <View className="space-y-1">
                        <Text className="text-slate-800 dark:text-slate-100 text-xs font-black" numberOfLines={1}>
                          {item.college_name}
                        </Text>
                        <Text className="text-slate-500 dark:text-slate-400 text-[10px] font-bold" numberOfLines={1}>
                          {item.branch_name}
                        </Text>
                      </View>

                      <View className="flex-row justify-between items-center pt-2 border-t border-slate-100 dark:border-slate-800">
                        <View>
                          <Text className="text-slate-400 text-[8px] uppercase">Chance</Text>
                          <Text className="text-emerald-500 dark:text-emerald-400 text-xs font-black">{(item.admission_probability * 100).toFixed(0)}%</Text>
                        </View>
                        <View className="bg-slate-50 dark:bg-slate-850 px-2 py-0.5 rounded">
                          <Text className="text-slate-600 dark:text-slate-300 text-[8px] font-bold">#{item.nirf_rank ? `NIRF ${item.nirf_rank}` : "Govt"}</Text>
                        </View>
                      </View>
                    </Animated.View>
                  )}
                />
              )}
            </View>

            {/* Upcoming Events Calendar */}
            <EventsCalendar />
          </ScrollView>
        );
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-[#111118]">
      <View className="flex-1 px-5 pt-3 pb-2 justify-between">
        
        {/* Branding header */}
        <View className="flex-row justify-between items-center py-1 mb-2">
          <Text className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            ADMIT <Text className="text-emerald-500 font-black">OS</Text>
          </Text>
          <View className="flex-row bg-slate-200/60 dark:bg-slate-800 p-0.5 rounded-full">
            {(["dashboard", "alerts", "settings"] as TabName[]).map((tab) => (
              <Pressable
                key={tab}
                onPress={() => {
                  Haptics.selectionAsync();
                  setActiveTab(tab);
                }}
                className={`px-3 py-1 rounded-full ${
                  activeTab === tab ? "bg-white dark:bg-[#1A1A24] shadow-xs" : ""
                }`}
              >
                <Text
                  className={`text-[9px] font-bold uppercase ${
                    activeTab === tab
                      ? "text-emerald-500 font-black"
                      : "text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {tab === "settings" ? "Prefs" : tab}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Dynamic active view */}
        <View className="flex-1 py-2">
          {renderActiveContent()}
        </View>
      </View>
    </SafeAreaView>
  );
}
