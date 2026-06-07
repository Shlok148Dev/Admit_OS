import React from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, Linking } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead, Notification } from "../lib/api";

export default function NotificationsFeed() {
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading, error } = useQuery<Notification[]>({
    queryKey: ["notifications"],
    queryFn: getNotifications,
  });

  const markReadMutation = useMutation({
    mutationFn: markNotificationAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  });

  const markAllReadMutation = useMutation({
    mutationFn: markAllNotificationsAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  });

  const getCategoryColor = (cat: Notification["category"]) => {
    switch (cat) {
      case "ALLOTMENT": return { bg: "bg-emerald-500", text: "Allotment" };
      case "DEADLINE": return { bg: "bg-rose-500", text: "Deadline" };
      case "ALERT": return { bg: "bg-amber-500", text: "Alert" };
      case "SYSTEM":
      default:
        return { bg: "bg-blue-500", text: "System" };
    }
  };

  const formatTime = (isoString: string) => {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffMins = Math.floor(diffMs / 1000 / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const unreadCount = notifications.filter((n: Notification) => n.unread).length;

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center py-20 bg-slate-50 dark:bg-darkBg">
        <ActivityIndicator size="large" color="#2563EB" />
        <Text className="text-xs text-slate-455 dark:text-darkMuted mt-3 font-semibold">Loading alerts feed...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 p-4 rounded-xl">
        <Text className="text-xs font-bold text-rose-800 dark:text-rose-300">Connection Error</Text>
        <Text className="text-[10px] text-rose-700 dark:text-rose-405 mt-0.5">{error.message || "Failed to load notifications."}</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 space-y-4">
      {/* Feed Controls */}
      <View className="flex-row justify-between items-center px-1">
        <View className="flex-row items-center space-x-2">
          <Text className="text-sm font-bold text-slate-800 dark:text-darkHeading uppercase tracking-wide">Live Feed</Text>
          {unreadCount > 0 && (
            <View className="bg-rose-500 px-1.5 py-0.5 rounded-full">
              <Text className="text-[8px] font-bold text-white">{unreadCount} New</Text>
            </View>
          )}
        </View>
        {unreadCount > 0 && (
          <Pressable 
            onPress={() => markAllReadMutation.mutate()}
            className="bg-slate-100 dark:bg-darkSurfaceElevated px-2.5 py-1.5 rounded-lg active:opacity-75"
          >
            <Text className="text-[10px] font-bold text-slate-600 dark:text-darkBody">Mark all read</Text>
          </Pressable>
        )}
      </View>

      {/* Feed List */}
      {notifications.length === 0 ? (
        <View className="flex-1 justify-center items-center py-20 space-y-2">
          <Text className="text-slate-400 dark:text-darkMuted text-sm font-semibold">Feed is empty</Text>
          <Text className="text-[10px] text-slate-450 dark:text-darkMuted text-center max-w-[80%]">
            You will receive real-time notifications about seat allocations and CET schedules here.
          </Text>
        </View>
      ) : (
        <ScrollView className="flex-1" contentContainerStyle={{ gap: 12 }}>
          {notifications.map((n: Notification) => {
            const catInfo = getCategoryColor(n.category);
            return (
              <View 
                key={n.id}
                className={`bg-white dark:bg-darkSurface border border-slate-200 dark:border-darkBorder rounded-2xl p-4 space-y-2.5 shadow-sm relative ${
                  n.unread ? "border-l-4 border-l-blue-900 dark:border-l-blue-500" : ""
                }`}
              >
                {/* Header row */}
                <View className="flex-row justify-between items-start">
                  <View className="flex-row items-center space-x-1.5">
                    <View className={`w-2 h-2 rounded-full ${catInfo.bg}`} />
                    <Text className="text-[8px] font-bold text-slate-450 dark:text-darkMuted uppercase font-mono">
                      {n.exam_relevance} • {catInfo.text}
                    </Text>
                  </View>
                  <Text className="text-[8px] font-bold text-slate-400 dark:text-darkMuted font-mono">
                    {formatTime(n.timestamp)}
                  </Text>
                </View>

                {/* Body Row */}
                <View className="space-y-1">
                  <Text className={`text-xs text-slate-800 dark:text-darkHeading leading-snug ${n.unread ? "font-bold" : "font-medium"}`}>
                    {n.title}
                  </Text>
                  <Text className="text-[10px] text-slate-500 dark:text-darkBody leading-normal">
                    {n.body}
                  </Text>
                </View>

                {/* Footer action link */}
                <View className="flex-row justify-between items-center pt-1.5 border-t border-slate-100 dark:border-darkBorder">
                  {n.source_url ? (
                    <Pressable onPress={() => Linking.openURL(n.source_url!)}>
                      <Text className="text-[9px] text-blue-900 dark:text-blue-400 font-bold underline">Official Portal</Text>
                    </Pressable>
                  ) : (
                    <View />
                  )}
                  {n.unread && (
                    <Pressable
                      onPress={() => markReadMutation.mutate(n.id)}
                      className="bg-blue-50 dark:bg-blue-950/45 border border-blue-200 dark:border-blue-900/40 px-2 py-0.5 rounded"
                    >
                      <Text className="text-[8px] font-bold text-blue-800 dark:text-blue-300">Mark read</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}
