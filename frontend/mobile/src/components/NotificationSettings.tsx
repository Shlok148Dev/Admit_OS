import React, { useState, useEffect } from "react";
import { View, Text, Pressable, ActivityIndicator, ScrollView, TextInput, Alert } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";
import { getNotificationPreferences, saveNotificationPreferences, NotificationPreferences, submitFeedback } from "../lib/api";

function AnimatedToggle({ active, onToggle }: { active: boolean; onToggle: () => void }) {
  const switchTranslate = useSharedValue(active ? 16 : 2);

  useEffect(() => {
    switchTranslate.value = withSpring(active ? 16 : 2, {
      damping: 15,
      stiffness: 150,
    });
  }, [active]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: withSpring(active ? "#10B981" : "#94A3B8", { damping: 15 }),
  }));

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: switchTranslate.value }],
  }));

  return (
    <Pressable onPress={onToggle} className="w-10 h-6 rounded-full justify-center relative">
      <Animated.View style={[trackStyle]} className="absolute inset-0 rounded-full" />
      <Animated.View style={[thumbStyle]} className="w-5 h-5 rounded-full bg-white shadow-sm" />
    </Pressable>
  );
}

export default function NotificationSettings() {
  const queryClient = useQueryClient();
  const [localPrefs, setLocalPrefs] = useState<NotificationPreferences | null>(null);

  const { data: preferences, isLoading, error } = useQuery<NotificationPreferences>({
    queryKey: ["notificationPreferences"],
    queryFn: getNotificationPreferences,
  });

  const saveMutation = useMutation({
    mutationFn: saveNotificationPreferences,
    onSuccess: (updated) => {
      queryClient.setQueryData(["notificationPreferences"], updated);
    }
  });

  const [feedbackCategory, setFeedbackCategory] = useState("PREDICTOR");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState(false);

  const handleFeedbackSubmit = async () => {
    if (!feedbackMessage.trim()) {
      Alert.alert("Empty Message", "Please type your suggestion or issue description.");
      return;
    }
    setSubmittingFeedback(true);
    try {
      const ok = await submitFeedback({
        category: feedbackCategory,
        message: feedbackMessage
      });
      if (ok) {
        setFeedbackSuccess(true);
        setFeedbackMessage("");
        setTimeout(() => setFeedbackSuccess(false), 3000);
      } else {
        Alert.alert("Submission Failed", "Please try again later.");
      }
    } catch (e) {
      Alert.alert("Error", "Could not submit feedback.");
    } finally {
      setSubmittingFeedback(false);
    }
  };

  useEffect(() => {
    if (preferences) {
      setLocalPrefs(JSON.parse(JSON.stringify(preferences)));
    }
  }, [preferences]);

  const handleToggleChannel = (channel: keyof NotificationPreferences["channels"]) => {
    if (!localPrefs) return;
    const updated = {
      ...localPrefs,
      channels: { ...localPrefs.channels, [channel]: !localPrefs.channels[channel] }
    };
    setLocalPrefs(updated);
    saveMutation.mutate(updated);
  };

  const handleToggleCategory = (category: keyof NotificationPreferences["categories"]) => {
    if (!localPrefs) return;
    const updated = {
      ...localPrefs,
      categories: { ...localPrefs.categories, [category]: !localPrefs.categories[category] }
    };
    setLocalPrefs(updated);
    saveMutation.mutate(updated);
  };

  if (isLoading || !localPrefs) {
    return (
      <View className="flex-1 justify-center items-center py-20 bg-slate-50 dark:bg-[#111118]">
        <ActivityIndicator size="small" color="#10B981" />
        <Text className="text-xs text-slate-450 dark:text-slate-400 mt-2 font-semibold">Loading preferences...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 p-4 rounded-xl">
        <Text className="text-xs font-bold text-rose-800 dark:text-rose-300">Connection Error</Text>
        <Text className="text-[10px] text-rose-700 mt-0.5">{error.message || "Failed to load preferences."}</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 space-y-5" contentContainerStyle={{ paddingBottom: 40, gap: 16 }}>
      {/* Channels Section */}
      <View className="space-y-3 bg-white dark:bg-[#1A1A24] border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
        <View>
          <Text className="text-xs font-black text-slate-850 dark:text-white uppercase tracking-wider">Communication Channels</Text>
          <Text className="text-[9px] text-slate-450 dark:text-slate-400 font-bold">Where should we deliver counseling alerts?</Text>
        </View>

        <View className="space-y-2.5 pt-1">
          {/* Push */}
          <View className="flex-row justify-between items-center p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40">
            <Text className="text-xs font-bold text-slate-700 dark:text-slate-300">Push Notifications</Text>
            <AnimatedToggle active={localPrefs.channels.push} onToggle={() => handleToggleChannel("push")} />
          </View>

          {/* Email */}
          <View className="flex-row justify-between items-center p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40">
            <Text className="text-xs font-bold text-slate-700 dark:text-slate-300">Email Alerts</Text>
            <AnimatedToggle active={localPrefs.channels.email} onToggle={() => handleToggleChannel("email")} />
          </View>

          {/* WhatsApp */}
          <View className="flex-row justify-between items-center p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40">
            <Text className="text-xs font-bold text-slate-700 dark:text-slate-300">WhatsApp Updates</Text>
            <AnimatedToggle active={localPrefs.channels.whatsapp} onToggle={() => handleToggleChannel("whatsapp")} />
          </View>

          {/* SMS */}
          <View className="flex-row justify-between items-center p-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/40">
            <Text className="text-xs font-bold text-slate-700 dark:text-slate-300">SMS Broadcasters</Text>
            <AnimatedToggle active={localPrefs.channels.sms} onToggle={() => handleToggleChannel("sms")} />
          </View>
        </View>
      </View>

      {/* Categories Section */}
      <View className="space-y-3 bg-white dark:bg-[#1A1A24] border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
        <View>
          <Text className="text-xs font-black text-slate-850 dark:text-white uppercase tracking-wider">Subscription Categories</Text>
          <Text className="text-[9px] text-slate-450 dark:text-slate-400 font-bold">Select what updates trigger active notifications.</Text>
        </View>

        <View className="space-y-2 pt-1">
          {/* Allotments */}
          <View className="flex-row justify-between items-center p-2.5">
            <View className="flex-1 pr-4">
              <Text className="text-xs font-bold text-slate-700 dark:text-slate-300">Seat Allotment Results</Text>
              <Text className="text-[9px] text-slate-450 dark:text-slate-400 mt-0.5 leading-snug">Triggers when counseling authorities publish list releases.</Text>
            </View>
            <AnimatedToggle active={localPrefs.categories.allotments} onToggle={() => handleToggleCategory("allotments")} />
          </View>

          {/* Deadlines */}
          <View className="flex-row justify-between items-center p-2.5 border-t border-slate-100 dark:border-slate-850">
            <View className="flex-1 pr-4">
              <Text className="text-xs font-bold text-slate-700 dark:text-slate-300">Critical Deadlines</Text>
              <Text className="text-[9px] text-slate-455 dark:text-slate-400 mt-0.5 leading-snug">Triggers for form registration and choice locking dates.</Text>
            </View>
            <AnimatedToggle active={localPrefs.categories.deadlines} onToggle={() => handleToggleCategory("deadlines")} />
          </View>

          {/* Alerts */}
          <View className="flex-row justify-between items-center p-2.5 border-t border-slate-100 dark:border-slate-850">
            <View className="flex-1 pr-4">
              <Text className="text-xs font-bold text-slate-700 dark:text-slate-300">CET & Board Announcements</Text>
              <Text className="text-[9px] text-slate-455 dark:text-slate-400 mt-0.5 leading-snug">Triggers for syllabus, eligibility, and answer key notices.</Text>
            </View>
            <AnimatedToggle active={localPrefs.categories.alerts} onToggle={() => handleToggleCategory("alerts")} />
          </View>

          {/* System */}
          <View className="flex-row justify-between items-center p-2.5 border-t border-slate-100 dark:border-slate-850">
            <View className="flex-1 pr-4">
              <Text className="text-xs font-bold text-slate-700 dark:text-slate-300">OS Platform Updates</Text>
              <Text className="text-[9px] text-slate-455 dark:text-slate-400 mt-0.5 leading-snug">Triggers on ML model enhancements and data audit reviews.</Text>
            </View>
            <AnimatedToggle active={localPrefs.categories.system} onToggle={() => handleToggleCategory("system")} />
          </View>
        </View>
      </View>

      {/* Beta Feedback Channel Card */}
      <View className="space-y-4 bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-lg">
        <View>
          <Text className="text-emerald-400 text-[10px] font-black uppercase tracking-widest">Beta Feedback Channel</Text>
          <Text className="text-white text-base font-black mt-1 leading-snug">Spotted an issue or have an idea?</Text>
          <Text className="text-slate-400 text-[10px] mt-0.5">Your input goes directly to the ADMIT OS Engineering team.</Text>
        </View>

        <View className="space-y-3 pt-2">
          {/* Category Selector */}
          <View className="space-y-1.5">
            <Text className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Feedback Category</Text>
            <View className="flex-row flex-wrap gap-1.5">
              {["PREDICTOR", "COMPASS", "BUG", "IDEA"].map((cat) => {
                const active = feedbackCategory === cat;
                return (
                  <Pressable
                    key={cat}
                    onPress={() => setFeedbackCategory(cat)}
                    className={`px-3 py-1.5 rounded-full border ${
                      active 
                        ? "bg-emerald-500 border-emerald-500" 
                        : "bg-slate-800 border-slate-700"
                    }`}
                  >
                    <Text className={`text-[9px] font-extrabold ${active ? "text-slate-950" : "text-slate-300"}`}>
                      {cat}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Message Input */}
          <View className="space-y-1.5">
            <Text className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Your Message</Text>
            <TextInput
              multiline
              numberOfLines={4}
              value={feedbackMessage}
              onChangeText={setFeedbackMessage}
              placeholder="Tell us what we can improve, which college cutoffs look inaccurate, or suggest a new feature..."
              placeholderTextColor="#64748b"
              className="bg-slate-850 border border-slate-700 text-slate-100 rounded-xl p-3 text-xs font-semibold"
              style={{ minHeight: 80, textAlignVertical: "top" }}
            />
          </View>

          {/* Success Banner */}
          {feedbackSuccess && (
            <View className="bg-emerald-500/20 border border-emerald-500/40 p-3 rounded-xl">
              <Text className="text-[10px] text-emerald-400 font-extrabold text-center">✓ Thank you! Feedback submitted successfully.</Text>
            </View>
          )}

          {/* Submit button */}
          <Pressable
            disabled={submittingFeedback}
            onPress={handleFeedbackSubmit}
            className={`bg-emerald-500 active:bg-emerald-600 p-3.5 rounded-xl items-center justify-center ${
              submittingFeedback ? "opacity-60" : ""
            }`}
          >
            {submittingFeedback ? (
              <ActivityIndicator size="small" color="#022c22" />
            ) : (
              <Text className="text-slate-950 font-black text-xs">Submit Suggestion</Text>
            )}
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}
