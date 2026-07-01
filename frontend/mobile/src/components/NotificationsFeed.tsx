import React from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, Linking, Animated as RNAnimated } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Swipeable from "react-native-gesture-handler/Swipeable";
import { Ionicons } from "@expo/vector-icons";
import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead, Notification } from "../lib/api";

interface SwipeableNotificationItemProps {
  n: Notification;
  onDismiss: () => void;
  onMarkRead: () => void;
  formatTime: (isoString: string) => string;
}

function SwipeableNotificationItem({ n, onDismiss, onMarkRead, formatTime }: SwipeableNotificationItemProps) {
  const getCategoryDetails = (cat: Notification["category"]) => {
    switch (cat) {
      case "DEADLINE":
        return {
          bg: "bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40",
          text: "Urgent Deadline",
          icon: "time",
          badgeColor: "bg-rose-500",
          glow: "border-l-4 border-l-rose-500"
        };
      case "ALLOTMENT":
        return {
          bg: "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40",
          text: "Seat Allotment",
          icon: "ribbon",
          badgeColor: "bg-emerald-500",
          glow: "border-l-4 border-l-emerald-500"
        };
      case "ALERT":
        return {
          bg: "bg-amber-50/70 dark:bg-amber-950/20 border-amber-200 dark:border-amber-900/40",
          text: "Attention Required",
          icon: "warning",
          badgeColor: "bg-amber-500",
          glow: "border-l-4 border-l-amber-500"
        };
      case "SYSTEM":
      default:
        return {
          bg: "bg-white dark:bg-[#1A1A24] border-slate-200 dark:border-slate-800",
          text: "System Update",
          icon: "information-circle",
          badgeColor: "bg-blue-500",
          glow: n.unread ? "border-l-4 border-l-blue-500" : ""
        };
    }
  };

  const details = getCategoryDetails(n.category);

  // Swipe Action Background
  const renderRightActions = (
    _progress: RNAnimated.AnimatedInterpolation<number>,
    dragX: RNAnimated.AnimatedInterpolation<number>
  ) => {
    const scale = dragX.interpolate({
      inputRange: [-80, 0],
      outputRange: [1, 0],
      extrapolate: "clamp",
    });

    return (
      <Pressable
        onPress={onDismiss}
        className="bg-rose-600 justify-center items-center w-20 rounded-2xl mb-3 flex"
      >
        <RNAnimated.View style={{ transform: [{ scale }] }}>
          <Ionicons name="trash-outline" size={18} color="white" />
        </RNAnimated.View>
      </Pressable>
    );
  };

  return (
    <Swipeable
      renderRightActions={renderRightActions}
      onSwipeableOpen={(direction) => {
        if (direction === "right") {
          onDismiss();
        }
      }}
    >
      <View
        className={`p-4 rounded-2xl border mb-3 flex-row space-x-3 items-start ${details.bg} ${details.glow}`}
      >
        <View className={`w-8 h-8 rounded-full justify-center items-center ${details.badgeColor}20`}>
          <Ionicons name={details.icon as any} size={16} color={n.category === "SYSTEM" ? "#3B82F6" : undefined} />
        </View>
        <View className="flex-1 space-y-1.5">
          {/* Header */}
          <View className="flex-row justify-between items-center">
            <Text className="text-[8px] font-black text-slate-450 dark:text-slate-400 uppercase tracking-widest">
              {n.exam_relevance} • {details.text}
            </Text>
            <Text className="text-[8px] font-bold text-slate-400 dark:text-slate-500">
              {formatTime(n.timestamp)}
            </Text>
          </View>
          {/* Body */}
          <View className="space-y-0.5">
            <Text className={`text-xs text-slate-900 dark:text-white leading-snug ${n.unread ? "font-black" : "font-bold"}`}>
              {n.title}
            </Text>
            <Text className="text-[10px] text-slate-500 dark:text-slate-400 leading-normal font-medium">
              {n.body}
            </Text>
          </View>
          {/* Footer Action */}
          <View className="flex-row justify-between items-center pt-1">
            {n.source_url ? (
              <Pressable onPress={() => Linking.openURL(n.source_url!)}>
                <Text className="text-[9px] text-emerald-500 font-extrabold underline">Official Link</Text>
              </Pressable>
            ) : (
              <View />
            )}
            {n.unread && (
              <Pressable
                onPress={onMarkRead}
                className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-md"
              >
                <Text className="text-[8px] font-extrabold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Mark read</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Swipeable>
  );
}

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

  const handleDismiss = (id: string) => {
    // Treat dismiss as marking read and fading out
    markReadMutation.mutate(id);
  };

  const unreadCount = notifications.filter((n: Notification) => n.unread).length;

  // Prioritization sorting logic
  const getPriorityWeight = (cat: Notification["category"]) => {
    switch (cat) {
      case "DEADLINE": return 4;
      case "ALLOTMENT": return 3;
      case "ALERT": return 2;
      case "SYSTEM":
      default:
        return 1;
    }
  };

  const prioritizedNotifications = [...notifications].sort((a, b) => {
    // Unread notifications are prioritized
    if (a.unread !== b.unread) {
      return a.unread ? -1 : 1;
    }
    // High category weight first
    const weightA = getPriorityWeight(a.category);
    const weightB = getPriorityWeight(b.category);
    if (weightA !== weightB) {
      return weightB - weightA;
    }
    // Newest first
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center py-20 bg-slate-50 dark:bg-[#111118]">
        <ActivityIndicator size="large" color="#10B981" />
        <Text className="text-xs text-slate-450 dark:text-slate-400 mt-3 font-semibold">Gathering telemetry alerts...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 p-4 rounded-xl">
        <Text className="text-xs font-bold text-rose-800 dark:text-rose-300">Connection Error</Text>
        <Text className="text-[10px] text-rose-750 mt-0.5">{error.message || "Failed to load notifications."}</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 space-y-4">
      {/* Feed Controls */}
      <View className="flex-row justify-between items-center px-1">
        <View className="flex-row items-center space-x-2">
          <Text className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">Priority Signals</Text>
          {unreadCount > 0 && (
            <View className="bg-rose-500 px-2 py-0.5 rounded-full">
              <Text className="text-[8px] font-black text-white">{unreadCount} URGENT</Text>
            </View>
          )}
        </View>
        {unreadCount > 0 && (
          <Pressable 
            onPress={() => markAllReadMutation.mutate()}
            className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-3 py-1.5 rounded-xl active:opacity-75"
          >
            <Text className="text-[9px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider">Clear Inbox</Text>
          </Pressable>
        )}
      </View>

      {/* Feed List */}
      {prioritizedNotifications.length === 0 ? (
        <View className="flex-1 justify-center items-center py-20 space-y-2">
          <Text className="text-slate-400 dark:text-slate-500 text-sm font-semibold">All cleared</Text>
          <Text className="text-[10px] text-slate-450 dark:text-slate-400 text-center max-w-[80%]">
            No active counseling coordinates or allotment deadlines recorded.
          </Text>
        </View>
      ) : (
        <ScrollView className="flex-1">
          {prioritizedNotifications.map((n: Notification) => (
            <SwipeableNotificationItem
              key={n.id}
              n={n}
              onDismiss={() => handleDismiss(n.id)}
              onMarkRead={() => markReadMutation.mutate(n.id)}
              formatTime={formatTime}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}
