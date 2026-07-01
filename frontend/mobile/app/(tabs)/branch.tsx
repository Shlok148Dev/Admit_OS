import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, Pressable, Modal } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeInUp } from "react-native-reanimated";
import { BRANCH_STATS_MOCK } from "../../src/lib/api";

function AnimatedCountUp({ value, prefix = "", suffix = "", decimals = 0, duration = 800 }: { value: number; prefix?: string; suffix?: string; decimals?: number; duration?: number }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let startTime: number | null = null;
    let frameId: number;

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 3); // Cubic ease out
      setDisplayValue(easeProgress * value);

      if (progress < 1) {
        frameId = requestAnimationFrame(step);
      }
    };

    frameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frameId);
  }, [value]);

  return (
    <Text>
      {prefix}
      {displayValue.toFixed(decimals)}
      {suffix}
    </Text>
  );
}

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
    <ScrollView className="flex-1 bg-slate-50 dark:bg-[#111118]" contentContainerStyle={{ padding: 15, paddingBottom: 100, gap: 16 }}>
      
      {/* Intro Header */}
      <View className="bg-white dark:bg-[#1A1A24] border border-slate-200 dark:border-slate-800 p-4 rounded-xl space-y-1">
        <Text className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">Comparison Matrix</Text>
        <Text className="text-[10px] text-slate-450 dark:text-slate-400 font-bold">Compare key salary packages, growth indices, and market trends.</Text>
      </View>

      {/* Selectors */}
      <View className="bg-white dark:bg-[#1A1A24] border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm">
        <View className="flex-row items-center justify-between" style={{ gap: 12 }}>
          {/* Branch 1 Selector */}
          <View className="flex-1 space-y-1">
            <Text className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Primary Choice</Text>
            <Pressable
              onPress={() => setPickerOpen("branch1")}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-xl flex-row justify-between items-center"
            >
              <Text className="text-xs text-slate-900 dark:text-white font-extrabold">{branch1}</Text>
              <Ionicons name="chevron-down" size={10} color="#10B981" />
            </Pressable>
          </View>

          {/* VS Divider */}
          <View className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 justify-center items-center mt-3 border border-slate-200 dark:border-slate-650 shadow-xs">
            <Text className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">vs</Text>
          </View>

          {/* Branch 2 Selector */}
          <View className="flex-1 space-y-1">
            <Text className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Compare Target</Text>
            <Pressable
              onPress={() => setPickerOpen("branch2")}
              className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3 rounded-xl flex-row justify-between items-center"
            >
              <Text className="text-xs text-slate-900 dark:text-white font-extrabold">{branch2}</Text>
              <Ionicons name="chevron-down" size={10} color="#10B981" />
            </Pressable>
          </View>
        </View>
      </View>

      {/* Side-by-Side VS Columns */}
      <Animated.View entering={FadeInUp.duration(500)} className="bg-white dark:bg-[#1A1A24] border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm space-y-4">
        {/* Median Packages Countup comparison */}
        <View className="flex-row justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800">
          <View className="flex-1 items-center">
            <Text className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Median Package</Text>
            <View className="text-lg font-black text-emerald-500 dark:text-emerald-450 mt-1 flex-row">
              <AnimatedCountUp value={b1.median_salary / 100000} suffix=" LPA" decimals={1} />
            </View>
          </View>
          <View className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
            <Text className="text-[8px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">MEDIAN</Text>
          </View>
          <View className="flex-1 items-center">
            <Text className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Median Package</Text>
            <View className="text-lg font-black text-emerald-500 dark:text-emerald-450 mt-1 flex-row">
              <AnimatedCountUp value={b2.median_salary / 100000} suffix=" LPA" decimals={1} />
            </View>
          </View>
        </View>

        {/* Placement Rates */}
        <View className="flex-row justify-between items-center pb-4 border-b border-slate-100 dark:border-slate-800">
          <View className="flex-1 items-center">
            <Text className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Placement Rate</Text>
            <View className="text-base font-black text-slate-800 dark:text-white mt-1 flex-row">
              <AnimatedCountUp value={b1.placement_percentage} suffix="%" decimals={0} />
            </View>
          </View>
          <View className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
            <Text className="text-[8px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">RATE</Text>
          </View>
          <View className="flex-1 items-center">
            <Text className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Placement Rate</Text>
            <View className="text-base font-black text-slate-800 dark:text-white mt-1 flex-row">
              <AnimatedCountUp value={b2.placement_percentage} suffix="%" decimals={0} />
            </View>
          </View>
        </View>

        {/* Growth index */}
        <View className="flex-row justify-between items-center">
          <View className="flex-1 items-center">
            <Text className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Growth Index</Text>
            <View className="text-base font-black text-slate-800 dark:text-white mt-1 flex-row">
              <AnimatedCountUp value={b1.growth_index} suffix="/10" decimals={0} />
            </View>
          </View>
          <View className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
            <Text className="text-[8px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">GROWTH</Text>
          </View>
          <View className="flex-1 items-center">
            <Text className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">Growth Index</Text>
            <View className="text-base font-black text-slate-800 dark:text-white mt-1 flex-row">
              <AnimatedCountUp value={b2.growth_index} suffix="/10" decimals={0} />
            </View>
          </View>
        </View>
      </Animated.View>

      {/* AI Compare Insight Card */}
      <Animated.View entering={FadeInDown.delay(200).duration(450)}>
        <LinearGradient
          colors={["#1E1B4B", "#311042"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: 24, padding: 18, shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 8, elevation: 4 }}
        >
          <View className="flex-row items-center space-x-2 mb-2">
            <Ionicons name="sparkles" size={14} color="#10B981" />
            <Text className="text-emerald-400 text-[9px] font-black uppercase tracking-wider">AI Comparative Insight</Text>
          </View>
          <Text className="text-slate-100 text-xs font-bold leading-relaxed">
            {compInsight}
          </Text>
        </LinearGradient>
      </Animated.View>

      {/* Navigation buttons to details */}
      <View className="flex-row space-x-3" style={{ gap: 12 }}>
        <Pressable
          onPress={() => router.push({ pathname: "/branch-details", params: { code: b1.branch_code } })}
          className="flex-1 bg-slate-900 border border-slate-800 dark:bg-slate-800 dark:border-slate-700 py-3.5 rounded-xl items-center justify-center active:opacity-85"
        >
          <Text className="text-white font-extrabold text-xs">View {b1.branch_code} details</Text>
        </Pressable>
        <Pressable
          onPress={() => router.push({ pathname: "/branch-details", params: { code: b2.branch_code } })}
          className="flex-1 bg-slate-900 border border-slate-800 dark:bg-slate-800 dark:border-slate-700 py-3.5 rounded-xl items-center justify-center active:opacity-85"
        >
          <Text className="text-white font-extrabold text-xs">View {b2.branch_code} details</Text>
        </Pressable>
      </View>

      {/* Recommended Colleges List */}
      <View className="bg-white dark:bg-[#1A1A24] border border-slate-200 dark:border-slate-800 p-4 rounded-2xl shadow-sm space-y-3">
        <Text className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">Target Recommendations</Text>
        <View className="space-y-2">
          {[
            { name: "IIT Bombay", path: "CSE / ECE Core", fee: "₹2.3L/yr", ranking: "#3 NIRF" },
            { name: "NIT Surathkal", path: "IT / EEE Division", fee: "₹1.5L/yr", ranking: "#12 NIRF" }
          ].map((rec, i) => (
            <View key={i} className="bg-slate-50 dark:bg-slate-800/65 border border-slate-200 dark:border-slate-750 rounded-xl p-3 flex-row justify-between items-center">
              <View>
                <Text className="text-xs font-black text-slate-800 dark:text-white">{rec.name}</Text>
                <Text className="text-[9px] text-slate-500 dark:text-slate-450 font-bold">{rec.path} | Fees: {rec.fee}</Text>
              </View>
              <Text className="text-[9px] font-black text-blue-500 bg-blue-50 dark:bg-blue-950/45 border border-blue-150 dark:border-blue-900/40 px-2 py-0.5 rounded-full">{rec.ranking}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Picker Modal */}
      <Modal visible={pickerOpen !== null} transparent={true} animationType="slide">
        <View className="flex-1 justify-end bg-black/60">
          <View className="bg-white dark:bg-[#1A1A24] rounded-t-3xl p-6 max-h-[80%] space-y-4">
            <View className="flex-row justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
              <Text className="text-base font-black text-slate-800 dark:text-white uppercase tracking-wide">
                Select {pickerOpen === "branch1" ? "Primary Branch" : "Comparison Branch"}
              </Text>
              <Pressable onPress={() => setPickerOpen(null)}>
                <Text className="text-emerald-500 font-extrabold text-sm">Done</Text>
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
                      isSelected ? "bg-emerald-500/10" : ""
                    } ${isDisabled ? "opacity-30" : ""}`}
                  >
                    <Text className={`text-xs ${isSelected ? "font-black text-emerald-500" : "text-slate-700 dark:text-slate-300 font-bold"}`}>
                      {code} - {BRANCH_STATS_MOCK[code].branch_name}
                    </Text>
                    {isSelected && (
                      <Ionicons name="checkmark" size={14} color="#10B981" />
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
