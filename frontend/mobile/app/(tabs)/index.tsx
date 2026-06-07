import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, Pressable, SafeAreaView, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import Animated, { FadeInDown } from "react-native-reanimated";
import EventsCalendar from "../../src/components/EventsCalendar";
import NotificationsFeed from "../../src/components/NotificationsFeed";
import NotificationSettings from "../../src/components/NotificationSettings";
import ShareableCard from "../../src/components/ShareableCard";
import { storage } from "../../src/lib/storage";
import { getUpcomingEvents, getNotifications, predictCollegesMobile } from "../../src/lib/api";

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
      }
      setCheckingOnboard(false);
    }
  }, []);

  // Fetch notifications
  const { data: notifications } = useQuery({
    queryKey: ["notifications"],
    queryFn: getNotifications,
    enabled: !checkingOnboard
  });
  const latestNotification = notifications?.[0];

  // Fetch upcoming milestones
  const { data: events } = useQuery({
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
        percentile: profile.percentile,
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
      <SafeAreaView className="flex-1 bg-slate-50 dark:bg-darkBg justify-center items-center">
        <ActivityIndicator size="large" color="#2563EB" />
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

  const topPredictions = predictionData?.predictions?.slice(0, 3) || [];

  const renderActiveContent = () => {
    switch (activeTab) {
      case "alerts":
        return <NotificationsFeed />;
      case "settings":
        return <NotificationSettings />;
      case "dashboard":
      default:
        return (
          <ScrollView className="flex-1" contentContainerStyle={{ gap: 24 }} showsVerticalScrollIndicator={false}>
            
            {/* What's New alert pill */}
            {latestNotification && (
              <Animated.View entering={FadeInDown.delay(100).duration(400)}>
                <Pressable 
                  onPress={() => setActiveTab("alerts")}
                  className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 rounded-xl p-3.5 flex-row items-center space-x-2.5 shadow-sm active:opacity-90"
                >
                  <Text className="text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-900 px-2 py-0.5 rounded uppercase">NEW</Text>
                  <Text className="text-[10px] font-bold text-emerald-800 dark:text-emerald-200 flex-1" numberOfLines={1}>
                    {latestNotification.title}
                  </Text>
                  <Text className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400">View →</Text>
                </Pressable>
              </Animated.View>
            )}

            {/* Personalized Countdown Card */}
            {userEvent && (
              <Animated.View entering={FadeInDown.delay(200).duration(400)}>
                <View className="bg-slate-900 dark:bg-darkSurface border border-slate-800 dark:border-darkBorder rounded-3xl p-5 shadow-lg relative overflow-hidden">
                  {/* Glow bubble background */}
                  <View className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl" />
                  
                  <View className="space-y-4">
                    <View className="flex-row justify-between items-center">
                      <Text className="text-[10px] font-black text-emerald-400 dark:text-darkSafe uppercase tracking-widest">NEXT MILESTONE ALERT</Text>
                      <View className="bg-slate-800 dark:bg-darkSurfaceElevated px-2 py-0.5 rounded">
                        <Text className="text-[8px] text-white dark:text-darkHeading font-bold">{profile?.primary_exam?.replace("_", " ")}</Text>
                      </View>
                    </View>

                    <View className="space-y-1">
                      <Text className="text-white dark:text-darkHeading text-base font-extrabold leading-snug">
                        {userEvent.title}
                      </Text>
                      <Text className="text-slate-400 dark:text-darkMuted text-[10px]">
                        Scheduled on {new Date(userEvent.date).toLocaleDateString("en-IN", { day: "numeric", month: "long" })}
                      </Text>
                    </View>

                    <View className="flex-row items-center justify-between pt-2 border-t border-slate-800 dark:border-darkBorder">
                      <View className="flex-row items-baseline space-x-1">
                        <Text className="text-emerald-400 dark:text-darkSafe text-3xl font-black">{daysDiff}</Text>
                        <Text className="text-slate-400 dark:text-darkMuted text-xs font-bold">days left</Text>
                      </View>
                      <View className="bg-emerald-500/20 px-3 py-1.5 rounded-xl">
                        <Text className="text-emerald-400 dark:text-emerald-300 text-[10px] font-bold">Prepare Documents</Text>
                      </View>
                    </View>
                  </View>
                </View>
              </Animated.View>
            )}

            {/* Prediction Highlights Panel */}
            {profile && (
              <Animated.View entering={FadeInDown.delay(350).duration(400)}>
                <View className="bg-white dark:bg-darkSurface border border-slate-200 dark:border-darkBorder rounded-3xl p-5 space-y-4 shadow-sm">
                  <View className="flex-row justify-between items-center border-b border-slate-100 dark:border-darkBorder pb-2.5">
                    <View>
                      <Text className="text-xs font-bold text-slate-800 dark:text-darkHeading uppercase tracking-wider">Top Admission Matches</Text>
                      <Text className="text-[9px] text-slate-400 dark:text-darkMuted font-semibold mt-0.5">Based on AIR Rank: {profile.rank}</Text>
                    </View>
                    <Pressable 
                      onPress={() => router.push("/rank-radar")}
                      className="bg-blue-50 dark:bg-blue-950/40 px-2.5 py-1.5 rounded-lg"
                    >
                      <Text className="text-blue-900 dark:text-blue-400 text-[9px] font-bold">Open Radar</Text>
                    </Pressable>
                  </View>

                  {loadingPredictions ? (
                    <View className="py-6 justify-center items-center">
                      <ActivityIndicator size="small" color="#2563EB" />
                    </View>
                  ) : topPredictions.length === 0 ? (
                    <View className="py-6 justify-center items-center">
                      <Text className="text-xs text-slate-450 dark:text-darkMuted font-bold">No matching predictions. Try adjusting settings.</Text>
                    </View>
                  ) : (
                    <View className="space-y-3">
                      {topPredictions.map((p: any, idx: number) => (
                        <Animated.View 
                          key={idx} 
                          entering={FadeInDown.delay(idx * 80).springify()}
                          className="space-y-1.5"
                        >
                          <View className="flex-row justify-between items-center">
                            <View className="flex-1 pr-4">
                              <Text className="text-[11px] font-extrabold text-slate-800 dark:text-darkHeading" numberOfLines={1}>
                                {p.college_name}
                              </Text>
                              <Text className="text-[9px] text-slate-455 dark:text-darkMuted font-bold">{p.branch_name}</Text>
                            </View>
                            <Text className="text-[10px] font-black text-blue-900 dark:text-blue-400">{(p.admission_probability * 100).toFixed(0)}% Match</Text>
                          </View>
                          <View className="w-full bg-slate-100 dark:bg-darkSurfaceElevated h-1.5 rounded-full overflow-hidden">
                            <View 
                              className={`h-full rounded-full ${
                                p.admission_probability > 0.8 ? "bg-emerald-500 dark:bg-darkSafe" : "bg-blue-500 dark:bg-darkBrand"
                              }`} 
                              style={{ width: `${p.admission_probability * 100}%` }} 
                            />
                          </View>
                        </Animated.View>
                      ))}
                    </View>
                  )}
                </View>
              </Animated.View>
            )}

            {/* Launch Card (Hero) */}
            <Animated.View entering={FadeInDown.delay(500).duration(400)}>
              <View className="bg-slate-900 dark:bg-darkSurface border border-slate-800 dark:border-darkBorder rounded-3xl p-5 shadow-lg space-y-4">
                <View className="space-y-1">
                  <View className="bg-emerald-500/20 px-2 py-0.5 rounded-md self-start">
                    <Text className="text-emerald-400 dark:text-darkSafe text-[10px] font-black uppercase tracking-wider">Rank Radar</Text>
                  </View>
                  <Text className="text-base font-black text-white dark:text-darkHeading">Full Prediction Engine</Text>
                  <Text className="text-slate-400 dark:text-darkMuted text-[10px] leading-relaxed font-semibold">
                    Query complete state categories and filter by seat quotas, fee budgets, or college types.
                  </Text>
                </View>

                <Pressable
                  onPress={() => router.push("/rank-radar")}
                  className="bg-emerald-500 active:bg-emerald-600 dark:bg-darkSafe dark:active:bg-emerald-600 py-3.5 rounded-xl items-center justify-center shadow"
                >
                  <Text className="text-white font-bold text-xs">Launch Predictor</Text>
                </Pressable>
              </View>
            </Animated.View>

            {/* Spotify Wrapped Card (Task 4) */}
            {profile && topPredictions.length > 0 && (
              <Animated.View entering={FadeInDown.delay(650).duration(400)}>
                <View className="space-y-3">
                  <Text className="text-[10px] font-bold text-slate-400 dark:text-darkMuted uppercase tracking-wider">Share your credentials</Text>
                  <ShareableCard
                    collegeName={topPredictions[0].college_name}
                    branchName={topPredictions[0].branch_name}
                    probability={topPredictions[0].admission_probability}
                    rank={profile.rank}
                    exam={profile.primary_exam}
                    category={profile.category}
                  />
                </View>
              </Animated.View>
            )}

            {/* Upcoming Milestones Feed */}
            <Animated.View entering={FadeInDown.delay(800).duration(400)}>
              <EventsCalendar />
            </Animated.View>

            {/* Compass Toolset Section */}
            <Animated.View entering={FadeInDown.delay(950).duration(400)}>
              <View className="space-y-3 mt-2">
                <Text className="text-[10px] font-bold text-slate-400 dark:text-darkMuted uppercase tracking-wider">Compass Suites</Text>
                
                <View className="flex-row space-x-3">
                  {/* Counseling Compass Card */}
                  <Pressable
                    onPress={() => router.push("/counsel")}
                    className="flex-1 bg-white dark:bg-darkSurface border border-slate-200 dark:border-darkBorder rounded-2xl p-4 space-y-2 active:bg-slate-50 dark:active:bg-darkSurfaceElevated"
                  >
                    <View className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/40 px-2 py-0.5 rounded self-start">
                      <Text className="text-blue-900 dark:text-blue-400 text-[8px] font-bold uppercase">Counseling</Text>
                    </View>
                    <Text className="text-xs font-bold text-slate-800 dark:text-darkHeading">Counseling Compass</Text>
                    <Text className="text-[9px] text-slate-500 dark:text-darkMuted leading-snug">Optimize preference lists and check regulations.</Text>
                  </Pressable>

                  {/* Branch Compass Card */}
                  <Pressable
                    onPress={() => router.push("/branch")}
                    className="flex-1 bg-white dark:bg-darkSurface border border-slate-200 dark:border-darkBorder rounded-2xl p-4 space-y-2 active:bg-slate-50 dark:active:bg-darkSurfaceElevated"
                  >
                    <View className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/40 px-2 py-0.5 rounded self-start">
                      <Text className="text-emerald-900 dark:text-emerald-400 text-[8px] font-bold uppercase">Careers</Text>
                    </View>
                    <Text className="text-xs font-bold text-slate-800 dark:text-darkHeading">Branch Compass</Text>
                    <Text className="text-[9px] text-slate-500 dark:text-darkMuted leading-snug">Compare placements, wages, and trends.</Text>
                  </Pressable>
                </View>
              </View>
            </Animated.View>

            {/* Compliance notice */}
            <Animated.View entering={FadeInDown.delay(1100).duration(400)}>
              <View className="bg-slate-100 dark:bg-darkSurface border border-slate-200 dark:border-darkBorder rounded-xl p-3.5 flex-row items-center space-x-3">
                <View className="w-2 h-2 bg-emerald-500 dark:bg-darkSafe rounded-full" />
                <View className="flex-1">
                  <Text className="text-[10px] font-bold text-slate-850 dark:text-darkHeading">DPDP Act 2023 Compliant</Text>
                  <Text className="text-[9px] text-slate-500 dark:text-darkMuted">
                    Data is processed anonymously in memory.
                  </Text>
                </View>
              </View>
            </Animated.View>
          </ScrollView>
        );
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-darkBg">
      <View className="flex-1 px-5 pt-3 pb-2 justify-between">
        
        {/* Branding header */}
        <View className="flex-row justify-between items-center py-1 mb-2">
          <Text className="text-xl font-extrabold text-slate-900 dark:text-darkHeading tracking-tight">
            ADMIT <Text className="text-emerald-500 dark:text-darkSafe font-black">OS</Text>
          </Text>
          <View className="flex-row bg-slate-200/60 dark:bg-darkSurfaceElevated p-0.5 rounded-full">
            {(["dashboard", "alerts", "settings"] as TabName[]).map((tab) => (
              <Pressable
                key={tab}
                onPress={() => setActiveTab(tab)}
                className={`px-3 py-1 rounded-full ${
                  activeTab === tab ? "bg-white dark:bg-darkSurface shadow-xs" : ""
                }`}
              >
                <Text
                  className={`text-[9px] font-bold uppercase ${
                    activeTab === tab
                      ? "text-blue-900 dark:text-blue-400"
                      : "text-slate-650 dark:text-darkMuted"
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
