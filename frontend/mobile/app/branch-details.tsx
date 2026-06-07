import React from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { BRANCH_STATS_MOCK } from "../src/lib/api";

export default function MobileBranchDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const branchCode = (params.code as string || "CS").toUpperCase();
  
  const bStats = BRANCH_STATS_MOCK[branchCode] || BRANCH_STATS_MOCK["CS"];

  const salaryLevels = [
    { label: "Entry Level (0-2 yrs)", val: Math.round(bStats.median_salary * 0.7) },
    { label: "Mid Career (3-7 yrs)", val: Math.round(bStats.median_salary * 1.5) },
    { label: "Senior Leader (8+ yrs)", val: Math.round(bStats.median_salary * 2.8) }
  ];

  const maxVal = Math.max(...salaryLevels.map(s => s.val));

  return (
    <View className="flex-1 bg-slate-50 dark:bg-darkBg">
      <ScrollView className="flex-1 dark:bg-darkBg" contentContainerStyle={{ padding: 15, gap: 16 }}>
        
        {/* Header Widget */}
        <View className="bg-white dark:bg-darkSurface border border-slate-200 dark:border-darkBorder p-4 rounded-xl space-y-1">
          <View className="flex-row items-center space-x-2">
            <Text className="text-[9px] font-bold text-blue-900 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/40 px-2 py-0.5 rounded-full font-mono uppercase">
              {bStats.branch_code} Profile
            </Text>
            <Text className="text-[9px] font-bold text-slate-400 dark:text-darkMuted font-mono">NIRF verified</Text>
          </View>
          <Text className="text-base font-extrabold text-slate-800 dark:text-darkHeading mt-1">{bStats.branch_name}</Text>
          <Text className="text-[10px] text-slate-500 dark:text-darkMuted">Placement Rate: {bStats.placement_percentage}% | Growth Index: {bStats.growth_index}/10</Text>
        </View>

        {/* Custom Salary Experience bars */}
        <View className="bg-white dark:bg-darkSurface border border-slate-200 dark:border-darkBorder p-4 rounded-xl space-y-3.5 shadow-sm">
          <Text className="text-xs font-bold text-slate-800 dark:text-darkHeading border-b border-slate-100 dark:border-darkBorder pb-2">Experience Compensation Projections</Text>
          {salaryLevels.map((item, idx) => {
            const widthPct = (item.val / maxVal) * 100;
            return (
              <View key={idx} className="space-y-1">
                <View className="flex-row justify-between">
                  <Text className="text-[11px] font-semibold text-slate-700 dark:text-darkBody">{item.label}</Text>
                  <Text className="text-[11px] font-bold text-slate-900 dark:text-darkHeading">₹{(item.val / 100000).toFixed(1)} LPA</Text>
                </View>
                <View className="bg-slate-100 dark:bg-darkSurfaceElevated h-2 rounded-full overflow-hidden">
                  <View className="bg-emerald-500 dark:bg-darkSafe h-full" style={{ width: `${widthPct}%` }} />
                </View>
              </View>
            );
          })}
        </View>

        {/* Alumni Career Transitions */}
        <View className="bg-white dark:bg-darkSurface border border-slate-200 dark:border-darkBorder p-4 rounded-xl space-y-3.5 shadow-sm">
          <Text className="text-xs font-bold text-slate-800 dark:text-darkHeading border-b border-slate-100 dark:border-darkBorder pb-2 font-mono uppercase">Career Transitions</Text>
          {bStats.career_transitions.map((item, idx) => (
            <View key={idx} className="border-b border-slate-100 dark:border-darkBorder last:border-0 pb-3 last:pb-0 space-y-1.5">
              <View className="flex-row justify-between items-center">
                <Text className="text-xs font-bold text-slate-800 dark:text-darkHeading">{item.role}</Text>
                <View className="bg-slate-100 dark:bg-darkSurfaceElevated px-2 py-0.5 rounded">
                  <Text className="text-[9px] font-bold text-slate-600 dark:text-darkBody">{item.percentage}%</Text>
                </View>
              </View>
              <View className="flex-row flex-wrap gap-1">
                {item.skills.map((skill) => (
                  <View key={skill} className="bg-slate-50 dark:bg-darkSurfaceElevated border border-slate-200 dark:border-darkBorder rounded px-1.5 py-0.5">
                    <Text className="text-[8px] text-slate-505 dark:text-darkMuted font-semibold">{skill}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>

        {/* Recommended institutions */}
        <View className="bg-white dark:bg-darkSurface border border-slate-200 dark:border-darkBorder p-4 rounded-xl space-y-3 shadow-sm">
          <Text className="text-xs font-bold text-slate-800 dark:text-darkHeading border-b border-slate-100 dark:border-darkBorder pb-2">Recommended Institutions</Text>
          {[
            { name: "IIT Madras", location: "Chennai, TN", type: "IIT", fee: "₹2.2L/yr" },
            { name: "NIT Surathkal", location: "Surathkal, KA", type: "NIT", fee: "₹1.4L/yr" }
          ].map((col, idx) => (
            <View key={idx} className="flex-row justify-between items-center py-1">
              <View>
                <Text className="text-xs font-bold text-slate-800 dark:text-darkHeading">{col.name}</Text>
                <Text className="text-[9px] text-slate-500 dark:text-darkMuted">{col.location} | Type: {col.type}</Text>
              </View>
              <Text className="text-[10px] font-bold text-slate-650 dark:text-darkBody">{col.fee}</Text>
            </View>
          ))}
        </View>

        {/* Back navigation */}
        <Pressable
          onPress={() => router.push("/branch")}
          className="bg-blue-900 dark:bg-darkBrand active:bg-blue-805 dark:active:bg-blue-950 py-3 rounded-xl items-center justify-center shadow-sm"
        >
          <Text className="text-white dark:text-darkHeading font-bold text-xs">Back to Comparison</Text>
        </Pressable>

      </ScrollView>
    </View>
  );
}
