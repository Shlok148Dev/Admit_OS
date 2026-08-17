import React, { useState } from "react";
import { View, Text, ScrollView, Pressable, Modal } from "react-native";
import { useRouter } from "expo-router";
import { BRANCH_STATS_MOCK } from "../../src/lib/api";

export default function MobileBranchCompassScreen() {
  const router = useRouter();
  const [branch1, setBranch1] = useState("CS");
  const [branch2, setBranch2] = useState("EC");
  const [pickerOpen, setPickerOpen] = useState<"branch1" | "branch2" | null>(null);

  const b1 = BRANCH_STATS_MOCK[branch1] || BRANCH_STATS_MOCK["CS"];
  const b2 = BRANCH_STATS_MOCK[branch2] || BRANCH_STATS_MOCK["EC"];

  // Compute a simple insight summary
  const salaryDiff = b1.median_salary - b2.median_salary;
  const isB1Higher = salaryDiff > 0;
  const absDiffLakhs = (Math.abs(salaryDiff) / 100000).toFixed(1);

  const compInsight = `${b1.branch_name} (${b1.branch_code}) has a median package of ₹${(
    b1.median_salary / 100000
  ).toFixed(1)} LPA compared to ₹${(b2.median_salary / 100000).toFixed(1)} LPA for ${
    b2.branch_name
  } (${b2.branch_code}). This represents a difference of ${absDiffLakhs} LPA. ${
    isB1Higher ? b1.branch_code : b2.branch_code
  } offers a higher placement rate (${
    isB1Higher ? b1.placement_percentage : b2.placement_percentage
  }% vs ${isB1Higher ? b2.placement_percentage : b1.placement_percentage}%).`;

  return (
    <ScrollView className="flex-1 bg-slate-50 dark:bg-darkBg" contentContainerStyle={{ padding: 15, gap: 16 }}>
      
      {/* Intro Header */}
      <View className="bg-white dark:bg-darkSurface border border-slate-200 dark:border-darkBorder p-4 rounded-xl space-y-1">
        <Text className="text-sm font-bold text-slate-800 dark:text-darkHeading">Branch Comparison Matrix</Text>
        <Text className="text-[10px] text-slate-400 dark:text-darkMuted">Evaluate package stats and placement trends across choices.</Text>
      </View>

      {/* Selectors */}
      <View className="bg-white dark:bg-darkSurface border border-slate-200 dark:border-darkBorder p-4 rounded-xl space-y-4">
        <View className="flex-row justify-between space-x-3">
          {/* Branch 1 Selector */}
          <View className="flex-1 space-y-1">
            <Text className="text-[10px] font-bold text-slate-500 dark:text-darkMuted uppercase">Primary Branch</Text>
            <Pressable
              onPress={() => setPickerOpen("branch1")}
              className="bg-slate-50 dark:bg-darkSurfaceElevated border border-slate-200 dark:border-darkBorder p-3 rounded-xl flex-row justify-between items-center"
            >
              <Text className="text-xs text-slate-800 dark:text-darkHeading font-bold">{branch1}</Text>
              <Text className="text-slate-400 dark:text-darkMuted text-[10px]">▼</Text>
            </Pressable>
          </View>

          {/* Branch 2 Selector */}
          <View className="flex-1 space-y-1">
            <Text className="text-[10px] font-bold text-slate-500 dark:text-darkMuted uppercase">Comparison Branch</Text>
            <Pressable
              onPress={() => setPickerOpen("branch2")}
              className="bg-slate-50 dark:bg-darkSurfaceElevated border border-slate-200 dark:border-darkBorder p-3 rounded-xl flex-row justify-between items-center"
            >
              <Text className="text-xs text-slate-800 dark:text-darkHeading font-bold">{branch2}</Text>
              <Text className="text-slate-400 dark:text-darkMuted text-[10px]">▼</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* AI Compare Insight */}
      <View className="bg-gradient-to-br from-blue-900 to-indigo-950 dark:from-darkSurface dark:to-darkSurfaceElevated border border-slate-800 dark:border-darkBorder p-4 rounded-2xl shadow-sm space-y-2">
        <Text className="text-emerald-400 dark:text-darkSafe text-[10px] font-bold uppercase tracking-wider">AI Comparative Insight</Text>
        <Text className="text-blue-50 dark:text-darkBody text-[11px] leading-relaxed font-semibold">
          {compInsight}
        </Text>
      </View>

      {/* Stacked Comparative Metrics */}
      <View className="bg-white dark:bg-darkSurface border border-slate-200 dark:border-darkBorder rounded-xl overflow-hidden shadow-sm">
        <View className="bg-slate-50 dark:bg-darkSurfaceElevated px-4 py-2.5 border-b border-slate-100 dark:border-darkBorder flex-row justify-between">
          <Text className="text-[10px] font-bold text-slate-500 dark:text-darkMuted uppercase">Metric</Text>
          <Text className="text-[10px] font-bold text-slate-500 dark:text-darkMuted uppercase font-mono">{b1.branch_code}</Text>
          <Text className="text-[10px] font-bold text-slate-500 dark:text-darkMuted uppercase font-mono">{b2.branch_code}</Text>
        </View>

        {[
          { label: "Median Package", v1: `₹${(b1.median_salary / 100000).toFixed(1)} LPA`, v2: `₹${(b2.median_salary / 100000).toFixed(1)} LPA` },
          { label: "Highest Package", v1: `₹${(b1.highest_salary / 100000).toFixed(1)} LPA`, v2: `₹${(b2.highest_salary / 100000).toFixed(1)} LPA` },
          { label: "Placement Rate", v1: `${b1.placement_percentage}%`, v2: `${b2.placement_percentage}%` },
          { label: "NIRF Reputation", v1: `${b1.nirf_reputation_score}/10`, v2: `${b2.nirf_reputation_score}/10` },
          { label: "Growth Index", v1: `${b1.growth_index}/10`, v2: `${b2.growth_index}/10` }
        ].map((item, idx) => (
          <View key={idx} className="flex-row justify-between items-center px-4 py-3.5 border-b border-slate-100 dark:border-darkBorder last:border-0">
            <Text className="text-xs font-semibold text-slate-650 dark:text-darkBody flex-1">{item.label}</Text>
            <Text className="text-xs font-bold text-slate-800 dark:text-darkHeading w-24 text-center">{item.v1}</Text>
            <Text className="text-xs font-bold text-slate-800 dark:text-darkHeading w-24 text-center">{item.v2}</Text>
          </View>
        ))}
      </View>

      {/* Navigation Buttons to Profiles */}
      <View className="flex-row space-x-3">
        <Pressable
          onPress={() => router.push({ pathname: "/branch-details", params: { code: b1.branch_code } })}
          className="flex-1 bg-slate-900 dark:bg-darkSurfaceElevated active:bg-slate-800 dark:active:bg-darkSurface py-3 rounded-xl items-center justify-center border border-slate-900 dark:border-darkBorder"
        >
          <Text className="text-white dark:text-darkHeading font-bold text-xs">View {b1.branch_code} details</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push({ pathname: "/branch-details", params: { code: b2.branch_code } })}
          className="flex-1 bg-slate-900 dark:bg-darkSurfaceElevated active:bg-slate-800 dark:active:bg-darkSurface py-3 rounded-xl items-center justify-center border border-slate-900 dark:border-darkBorder"
        >
          <Text className="text-white dark:text-darkHeading font-bold text-xs">View {b2.branch_code} details</Text>
        </Pressable>
      </View>

      {/* Target recommended colleges */}
      <View className="bg-white dark:bg-darkSurface border border-slate-200 dark:border-darkBorder p-4 rounded-xl space-y-3">
        <Text className="text-xs font-bold text-slate-800 dark:text-darkHeading">Target Counseling Recommendations</Text>
        <View className="space-y-2">
          {[
            { name: "IIT Bombay", path: "CSE / ECE Core", fee: "₹2.3L/yr", ranking: "#3 NIRF" },
            { name: "NIT Surathkal", path: "IT / EEE Division", fee: "₹1.5L/yr", ranking: "#12 NIRF" }
          ].map((rec, i) => (
            <View key={i} className="bg-slate-50 dark:bg-darkSurfaceElevated border border-slate-200 dark:border-darkBorder rounded-lg p-2.5 flex-row justify-between items-center">
              <View>
                <Text className="text-xs font-bold text-slate-800 dark:text-darkHeading">{rec.name}</Text>
                <Text className="text-[9px] text-slate-500 dark:text-darkMuted">{rec.path} | Fees: {rec.fee}</Text>
              </View>
              <Text className="text-[9px] font-bold text-blue-900 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/40 px-2 py-0.5 rounded-full">{rec.ranking}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Selector Modal */}
      <Modal visible={pickerOpen !== null} transparent={true} animationType="slide">
        <View className="flex-1 justify-end bg-black/40 dark:bg-black/60">
          <View className="bg-white dark:bg-darkSurfaceElevated rounded-t-3xl p-6 max-h-[80%] space-y-4">
            <View className="flex-row justify-between items-center border-b border-slate-100 dark:border-darkBorder pb-3">
              <Text className="text-base font-bold text-slate-800 dark:text-darkHeading">
                Select {pickerOpen === "branch1" ? "Primary Branch" : "Comparison Branch"}
              </Text>
              <Pressable onPress={() => setPickerOpen(null)}>
                <Text className="text-blue-500 dark:text-blue-400 font-bold text-sm">Cancel</Text>
              </Pressable>
            </View>
            <ScrollView className="space-y-1">
              {Object.keys(BRANCH_STATS_MOCK).map((code) => {
                const isSelected = pickerOpen === "branch1" ? branch1 === code : branch2 === code;
                const isDisabled = pickerOpen === "branch1" ? branch2 === code : branch1 === code;
                return (
                  <Pressable
                    key={code}
                    disabled={isDisabled}
                    onPress={() => {
                      if (pickerOpen === "branch1") {
                        setBranch1(code);
                      } else {
                        setBranch2(code);
                      }
                      setPickerOpen(null);
                    }}
                    className={`p-3.5 rounded-xl flex-row justify-between items-center ${
                      isSelected ? "bg-blue-50 dark:bg-blue-950/40" : ""
                    } ${isDisabled ? "opacity-35" : ""}`}
                  >
                    <Text className={`text-xs ${isSelected ? "font-bold text-blue-900 dark:text-blue-400" : "text-slate-700 dark:text-darkBody"}`}>
                      {code} - {BRANCH_STATS_MOCK[code].branch_name}
                    </Text>
                    {isSelected && (
                      <Text className="text-blue-900 dark:text-blue-400 font-bold">✓</Text>
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

    </ScrollView>
  );
}
