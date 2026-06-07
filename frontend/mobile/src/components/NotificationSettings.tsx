import React, { useState, useEffect } from "react";
import { View, Text, Pressable, ActivityIndicator, ScrollView, TextInput, Alert } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getNotificationPreferences, saveNotificationPreferences, NotificationPreferences, submitFeedback } from "../lib/api";

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
      <View className="flex-1 justify-center items-center py-20 bg-slate-50 dark:bg-darkBg">
        <ActivityIndicator size="small" color="#2563EB" />
        <Text className="text-xs text-slate-400 dark:text-darkMuted mt-2 font-semibold">Loading preferences...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 p-4 rounded-xl">
        <Text className="text-xs font-bold text-rose-800 dark:text-rose-305">Connection Error</Text>
        <Text className="text-[10px] text-rose-700 dark:text-rose-400 mt-0.5">{error.message || "Failed to load preferences."}</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 space-y-5 dark:bg-darkBg" contentContainerStyle={{ paddingBottom: 20 }}>
      {/* Channels Section */}
      <View className="space-y-3 bg-white dark:bg-darkSurface border border-slate-200 dark:border-darkBorder p-4 rounded-2xl shadow-sm">
        <View>
          <Text className="text-xs font-bold text-slate-800 dark:text-darkHeading uppercase tracking-wide">Communication Channels</Text>
          <Text className="text-[9px] text-slate-400 dark:text-darkMuted">Where should we deliver counseling alerts?</Text>
        </View>

        <View className="space-y-2 pt-1">
          {/* Push */}
          <Pressable
            onPress={() => handleToggleChannel("push")}
            className={`flex-row justify-between items-center p-3 rounded-xl border ${
              localPrefs.channels.push 
                ? "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/40" 
                : "bg-slate-50 dark:bg-darkSurfaceElevated border-slate-250 dark:border-darkBorder"
            }`}
          >
            <Text className="text-xs font-bold text-slate-700 dark:text-darkBody">Push Notifications</Text>
            <View className={`px-2 py-0.5 rounded ${localPrefs.channels.push ? "bg-blue-900 dark:bg-darkBrand" : "bg-slate-250 dark:bg-darkSurface"}`}>
              <Text className="text-[9px] font-bold text-white dark:text-darkHeading">{localPrefs.channels.push ? "ON" : "OFF"}</Text>
            </View>
          </Pressable>

          {/* Email */}
          <Pressable
            onPress={() => handleToggleChannel("email")}
            className={`flex-row justify-between items-center p-3 rounded-xl border ${
              localPrefs.channels.email 
                ? "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/40" 
                : "bg-slate-50 dark:bg-darkSurfaceElevated border-slate-250 dark:border-darkBorder"
            }`}
          >
            <Text className="text-xs font-bold text-slate-700 dark:text-darkBody">Email Alerts</Text>
            <View className={`px-2 py-0.5 rounded ${localPrefs.channels.email ? "bg-blue-900 dark:bg-darkBrand" : "bg-slate-250 dark:bg-darkSurface"}`}>
              <Text className="text-[9px] font-bold text-white dark:text-darkHeading">{localPrefs.channels.email ? "ON" : "OFF"}</Text>
            </View>
          </Pressable>

          {/* WhatsApp */}
          <Pressable
            onPress={() => handleToggleChannel("whatsapp")}
            className={`flex-row justify-between items-center p-3 rounded-xl border ${
              localPrefs.channels.whatsapp 
                ? "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/40" 
                : "bg-slate-50 dark:bg-darkSurfaceElevated border-slate-250 dark:border-darkBorder"
            }`}
          >
            <Text className="text-xs font-bold text-slate-700 dark:text-darkBody">WhatsApp Updates</Text>
            <View className={`px-2 py-0.5 rounded ${localPrefs.channels.whatsapp ? "bg-blue-900 dark:bg-darkBrand" : "bg-slate-250 dark:bg-darkSurface"}`}>
              <Text className="text-[9px] font-bold text-white dark:text-darkHeading">{localPrefs.channels.whatsapp ? "ON" : "OFF"}</Text>
            </View>
          </Pressable>

          {/* SMS */}
          <Pressable
            onPress={() => handleToggleChannel("sms")}
            className={`flex-row justify-between items-center p-3 rounded-xl border ${
              localPrefs.channels.sms 
                ? "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/40" 
                : "bg-slate-50 dark:bg-darkSurfaceElevated border-slate-250 dark:border-darkBorder"
            }`}
          >
            <Text className="text-xs font-bold text-slate-700 dark:text-darkBody">SMS Broadcasters</Text>
            <View className={`px-2 py-0.5 rounded ${localPrefs.channels.sms ? "bg-blue-900 dark:bg-darkBrand" : "bg-slate-250 dark:bg-darkSurface"}`}>
              <Text className="text-[9px] font-bold text-white dark:text-darkHeading">{localPrefs.channels.sms ? "ON" : "OFF"}</Text>
            </View>
          </Pressable>
        </View>
      </View>

      {/* Categories Section */}
      <View className="space-y-3 bg-white dark:bg-darkSurface border border-slate-200 dark:border-darkBorder p-4 rounded-2xl shadow-sm mt-4">
        <View>
          <Text className="text-xs font-bold text-slate-800 dark:text-darkHeading uppercase tracking-wide">Category Settings</Text>
          <Text className="text-[9px] text-slate-400 dark:text-darkMuted">Select what updates trigger active notifications.</Text>
        </View>

        <View className="space-y-2 pt-1">
          {/* Allotments */}
          <Pressable
            onPress={() => handleToggleCategory("allotments")}
            className="flex-row justify-between items-center p-2 rounded-lg"
          >
            <View className="flex-1 pr-4">
              <Text className="text-xs font-bold text-slate-700 dark:text-darkBody">Seat Allotment Results</Text>
              <Text className="text-[9px] text-slate-400 dark:text-darkMuted">Triggers when counseling authorities publish list releases.</Text>
            </View>
            <View className={`w-5 h-5 rounded border items-center justify-center ${localPrefs.categories.allotments ? "bg-blue-900 dark:bg-darkBrand border-blue-900 dark:border-darkBrand" : "border-slate-300 dark:border-darkBorder"}`}>
              {localPrefs.categories.allotments && <Text className="text-[10px] text-white dark:text-darkHeading font-extrabold">✓</Text>}
            </View>
          </Pressable>

          {/* Deadlines */}
          <Pressable
            onPress={() => handleToggleCategory("deadlines")}
            className="flex-row justify-between items-center p-2 rounded-lg border-t border-slate-100 dark:border-darkBorder"
          >
            <View className="flex-1 pr-4">
              <Text className="text-xs font-bold text-slate-700 dark:text-darkBody">Critical Deadlines</Text>
              <Text className="text-[9px] text-slate-400 dark:text-darkMuted">Triggers for form registration and choice locking dates.</Text>
            </View>
            <View className={`w-5 h-5 rounded border items-center justify-center ${localPrefs.categories.deadlines ? "bg-blue-900 dark:bg-darkBrand border-blue-900 dark:border-darkBrand" : "border-slate-300 dark:border-darkBorder"}`}>
              {localPrefs.categories.deadlines && <Text className="text-[10px] text-white dark:text-darkHeading font-extrabold">✓</Text>}
            </View>
          </Pressable>

          {/* Alerts */}
          <Pressable
            onPress={() => handleToggleCategory("alerts")}
            className="flex-row justify-between items-center p-2 rounded-lg border-t border-slate-100 dark:border-darkBorder"
          >
            <View className="flex-1 pr-4">
              <Text className="text-xs font-bold text-slate-700 dark:text-darkBody">CET & Board Announcements</Text>
              <Text className="text-[9px] text-slate-400 dark:text-darkMuted">Triggers for syllabus, eligibility, and answer key notices.</Text>
            </View>
            <View className={`w-5 h-5 rounded border items-center justify-center ${localPrefs.categories.alerts ? "bg-blue-900 dark:bg-darkBrand border-blue-900 dark:border-darkBrand" : "border-slate-300 dark:border-darkBorder"}`}>
              {localPrefs.categories.alerts && <Text className="text-[10px] text-white dark:text-darkHeading font-extrabold">✓</Text>}
            </View>
          </Pressable>

          {/* System */}
          <Pressable
            onPress={() => handleToggleCategory("system")}
            className="flex-row justify-between items-center p-2 rounded-lg border-t border-slate-100 dark:border-darkBorder"
          >
            <View className="flex-1 pr-4">
              <Text className="text-xs font-bold text-slate-700 dark:text-darkBody">OS Platform Updates</Text>
              <Text className="text-[9px] text-slate-400 dark:text-darkMuted">Triggers on ML model enhancements and data audit reviews.</Text>
            </View>
            <View className={`w-5 h-5 rounded border items-center justify-center ${localPrefs.categories.system ? "bg-blue-900 dark:bg-darkBrand border-blue-900 dark:border-darkBrand" : "border-slate-300 dark:border-darkBorder"}`}>
              {localPrefs.categories.system && <Text className="text-[10px] text-white dark:text-darkHeading font-extrabold">✓</Text>}
            </View>
          </Pressable>
        </View>
      </View>

      {/* Beta Feedback Channel Card */}
      <View className="space-y-4 bg-slate-900 dark:bg-darkSurface border border-slate-800 dark:border-darkBorder p-5 rounded-3xl shadow-lg mt-5">
        <View>
          <Text className="text-xs font-extrabold text-emerald-400 dark:text-darkSafe uppercase tracking-widest text-[10px]">Beta Feedback Channel</Text>
          <Text className="text-white dark:text-darkHeading text-base font-black mt-1 leading-snug">Spotted an issue or have an idea?</Text>
          <Text className="text-slate-400 dark:text-darkMuted text-[10px] mt-0.5">Your input goes directly to the ADMIT OS Engineering team.</Text>
        </View>

        <View className="space-y-3 pt-2">
          {/* Category Selector */}
          <View className="space-y-1.5">
            <Text className="text-[9px] font-bold text-slate-400 dark:text-darkMuted uppercase tracking-wider">Feedback Category</Text>
            <View className="flex-row flex-wrap gap-1.5">
              {["PREDICTOR", "COMPASS", "BUG", "IDEA"].map((cat) => {
                const active = feedbackCategory === cat;
                return (
                  <Pressable
                    key={cat}
                    onPress={() => setFeedbackCategory(cat)}
                    className={`px-3 py-1.5 rounded-full border ${
                      active 
                        ? "bg-emerald-500 border-emerald-500 dark:bg-darkSafe dark:border-darkSafe" 
                        : "bg-slate-800 border-slate-700 dark:bg-darkSurfaceElevated dark:border-darkBorder"
                    }`}
                  >
                    <Text className={`text-[9px] font-extrabold ${active ? "text-slate-955 dark:text-darkBg" : "text-slate-350 dark:text-darkBody"}`}>
                      {cat}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Message Input */}
          <View className="space-y-1.5">
            <Text className="text-[9px] font-bold text-slate-400 dark:text-darkMuted uppercase tracking-wider">Your Message</Text>
            <TextInput
              multiline
              numberOfLines={4}
              value={feedbackMessage}
              onChangeText={setFeedbackMessage}
              placeholder="Tell us what we can improve, which college cutoffs look inaccurate, or suggest a new feature..."
              placeholderTextColor="#64748b"
              className="bg-slate-800 dark:bg-darkSurfaceElevated border border-slate-700 dark:border-darkBorder text-slate-100 dark:text-darkBody rounded-xl p-3 text-xs font-semibold"
              style={{ minHeight: 80, textAlignVertical: "top" }}
            />
          </View>

          {/* Success Banner */}
          {feedbackSuccess && (
            <View className="bg-emerald-500/20 border border-emerald-500/45 p-3 rounded-xl">
              <Text className="text-[10px] text-emerald-400 font-extrabold text-center">✓ Thank you! Feedback submitted successfully.</Text>
            </View>
          )}

          {/* Submit button */}
          <Pressable
            disabled={submittingFeedback}
            onPress={handleFeedbackSubmit}
            className={`bg-emerald-500 active:bg-emerald-600 dark:bg-darkSafe dark:active:bg-emerald-600 p-3.5 rounded-xl items-center justify-center ${
              submittingFeedback ? "opacity-60" : ""
            }`}
          >
            {submittingFeedback ? (
              <ActivityIndicator size="small" color="#022c22" />
            ) : (
              <Text className="text-slate-950 dark:text-darkBg font-black text-xs">Submit Suggestion</Text>
            )}
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}
