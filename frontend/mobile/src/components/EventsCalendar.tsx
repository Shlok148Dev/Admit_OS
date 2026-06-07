import React from "react";
import { View, Text, ActivityIndicator } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { getUpcomingEvents, UpcomingEvent } from "../lib/api";

export default function EventsCalendar() {
  const { data: events = [], isLoading, error } = useQuery<UpcomingEvent[]>({
    queryKey: ["upcomingEvents"],
    queryFn: getUpcomingEvents,
  });

  const getCategoryStyles = (category: UpcomingEvent["category"]) => {
    switch (category) {
      case "REGISTRATION":
        return { bg: "bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900/40", text: "text-blue-700 dark:text-blue-400" };
      case "RESULT":
        return { bg: "bg-purple-50 border-purple-200 dark:bg-purple-950/20 dark:border-purple-900/40", text: "text-purple-700 dark:text-purple-400" };
      case "COUNSELING":
        return { bg: "bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:border-emerald-900/40", text: "text-emerald-700 dark:text-emerald-400" };
      case "EXAM":
      default:
        return { bg: "bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900/40", text: "text-amber-700 dark:text-amber-400" };
    }
  };

  if (isLoading) {
    return (
      <View className="py-8 items-center justify-center bg-slate-50 dark:bg-darkBg">
        <ActivityIndicator size="small" color="#2563EB" />
      </View>
    );
  }

  if (error) {
    return (
      <View className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 p-4 rounded-xl">
        <Text className="text-xs font-bold text-rose-800 dark:text-rose-300">Timeline Error</Text>
        <Text className="text-[10px] text-rose-700 dark:text-rose-400 mt-0.5">{error.message || "Failed to load events calendar."}</Text>
      </View>
    );
  }

  return (
    <View className="space-y-3.5">
      <View className="flex-row justify-between items-center px-1">
        <Text className="text-sm font-bold text-slate-800 dark:text-darkHeading uppercase tracking-wide">Upcoming Milestones</Text>
        <View className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 px-2 py-0.5 rounded-full">
          <Text className="text-[9px] font-bold text-emerald-800 dark:text-emerald-400 font-mono">Live</Text>
        </View>
      </View>

      <View className="space-y-3">
        {events.map((event: UpcomingEvent) => {
          const styles = getCategoryStyles(event.category);
          const dateStr = new Date(event.date).toLocaleDateString("en-IN", {
            month: "short",
            day: "numeric",
            year: "numeric"
          });

          return (
            <View 
              key={event.id}
              className="bg-white dark:bg-darkSurface border border-slate-200 dark:border-darkBorder rounded-2xl p-4 flex-row justify-between items-center shadow-sm"
            >
              {/* Event Info */}
              <View className="flex-1 pr-4 space-y-1.5">
                <View className="flex-row items-center gap-1.5">
                  <View className={`px-2 py-0.5 border rounded-full ${styles.bg}`}>
                    <Text className={`text-[8px] font-bold uppercase ${styles.text}`}>
                      {event.category}
                    </Text>
                  </View>
                  <Text className="text-[8px] font-bold text-slate-450 dark:text-darkMuted uppercase font-mono">
                    {event.exam.replace("_", " ")}
                  </Text>
                </View>

                <Text className="font-bold text-slate-800 dark:text-darkHeading text-xs leading-snug">
                  {event.title}
                </Text>

                <Text className="text-[10px] font-semibold text-slate-400 dark:text-darkMuted font-medium">
                  Date: {dateStr}
                </Text>
              </View>

              {/* Countdown Card */}
              <View className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 px-3.5 py-2.5 rounded-xl items-center justify-center min-w-[70px]">
                <Text className="text-emerald-800 dark:text-emerald-400 font-extrabold text-sm">{event.countdownDays}</Text>
                <Text className="text-emerald-700 dark:text-emerald-300 font-bold text-[8px] uppercase">Days Left</Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
