import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, Modal } from "react-native";
import { useMutation } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, Layout } from "react-native-reanimated";
import { predictCollegesMobile, PredictionRequest, PredictionResponse, Prediction } from "../src/lib/api";
import { getSavedColleges, saveCollege, removeSavedCollege, SavedCollege } from "../src/lib/storage";
import RankRadarForm from "../src/components/RankRadarForm";
import PredictionCard from "../src/components/PredictionCard";
import SavedCollegesSheet from "../src/components/SavedCollegesSheet";
import { storage } from "../src/lib/storage";

export default function RankRadarScreen() {
  const [savedList, setSavedList] = useState<SavedCollege[]>([]);
  const [isWishlistVisible, setIsWishlistVisible] = useState(false);
  const [activeRank, setActiveRank] = useState<number | null>(null);
  const [activeExam, setActiveExam] = useState<string>("JEE_MAIN");

  // Load saved wishlist and profile on mount
  useEffect(() => {
    setSavedList(getSavedColleges());
    const rawProfile = storage.getString("student_profile_v1");
    if (rawProfile) {
      const parsed = JSON.parse(rawProfile);
      setActiveRank(parsed.rank);
      setActiveExam(parsed.primary_exam);
    } else {
      setActiveRank(12500);
    }
  }, []);

  const { mutate, data, isPending, error, isSuccess } = useMutation<PredictionResponse, Error, PredictionRequest>({
    mutationFn: predictCollegesMobile,
    onSuccess: (res, variables) => {
      setActiveRank(variables.rank);
      setActiveExam(variables.exam);
    }
  });

  const handleFormSubmit = (req: PredictionRequest) => {
    mutate(req);
  };

  const handleSave = (prediction: Prediction) => {
    const updated = saveCollege({
      college_code: prediction.college_code,
      college_name: prediction.college_name,
      branch_code: prediction.branch_code,
      branch_name: prediction.branch_name,
      admission_probability: prediction.admission_probability,
      nirf_rank: prediction.nirf_rank,
      fees_per_year: prediction.fees_per_year
    });
    setSavedList(updated);
  };

  const handleRemove = (collegeCode: string, branchCode: string) => {
    const updated = removeSavedCollege(collegeCode, branchCode);
    setSavedList(updated);
  };

  const hasLowerConfidence = data?.predictions.some(p => p.data_confidence !== "HIGH");

  // Calculate strategy distribution
  const predictions = data?.predictions || [];
  const safeCount = predictions.filter(p => p.admission_probability >= 0.8).length;
  const balancedCount = predictions.filter(p => p.admission_probability >= 0.45 && p.admission_probability < 0.8).length;
  const dreamCount = predictions.filter(p => p.admission_probability < 0.45).length;

  return (
    <View className="flex-1 bg-slate-50 dark:bg-[#111118]">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, gap: 20 }}>
        
        {/* Large Air India Rank Display */}
        {activeRank !== null && (
          <Animated.View entering={FadeInDown.duration(400)}>
            <LinearGradient
              colors={["#0F172A", "#1E293B"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{ borderRadius: 24, padding: 24, alignItems: "center", position: "relative", overflow: "hidden" }}
            >
              <View className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/10 rounded-full blur-2xl" />
              
              <Text className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-1">Active Credentials Coordinates</Text>
              <Text className="text-white text-4xl font-black tracking-tight">AIR #{activeRank.toLocaleString("en-IN")}</Text>
              
              <View className="flex-row items-center space-x-2 mt-2 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full">
                <Ionicons name="ribbon-outline" size={12} color="#10B981" />
                <Text className="text-emerald-400 text-[9px] font-extrabold uppercase tracking-wider">{activeExam?.replace("_", " ")} Stream Active</Text>
              </View>
            </LinearGradient>
          </Animated.View>
        )}

        {/* Action Header Widget Row */}
        <View className="flex-row justify-between items-center bg-white dark:bg-[#1A1A24] p-4 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <View>
            <Text className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">Prediction Engine</Text>
            <Text className="text-[9px] text-slate-450 dark:text-slate-400 font-bold">Multi-Model Admissions Inference</Text>
          </View>
          <Pressable 
            onPress={() => setIsWishlistVisible(true)}
            className="bg-emerald-500 active:bg-emerald-600 px-3 py-2 rounded-xl flex-row items-center space-x-1.5 shadow-sm"
          >
            <Ionicons name="star" size={12} color="white" />
            <Text className="text-white font-extrabold text-xs">Wishlist ({savedList.length})</Text>
          </Pressable>
        </View>

        {/* Input Form */}
        <RankRadarForm onSubmit={handleFormSubmit} isPending={isPending} />

        {/* Empty State Tutorial */}
        {!isSuccess && !isPending && (
          <Animated.View entering={FadeInDown.delay(200).duration(400)} className="bg-white dark:bg-[#1A1A24] border border-slate-200 dark:border-slate-850 p-5 rounded-2xl space-y-4 shadow-sm">
            <View className="border-b border-slate-100 dark:border-slate-800/80 pb-2.5">
              <Text className="text-xs font-black text-slate-850 dark:text-white uppercase tracking-wider">How to use Rank Radar</Text>
              <Text className="text-[10px] text-slate-450 dark:text-slate-400 font-bold mt-0.5">Understand matching seat allocations step-by-step.</Text>
            </View>

            <View className="space-y-3.5">
              <View className="flex-row items-start space-x-3">
                <View className="w-5 h-5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/40 justify-center items-center">
                  <Text className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">1</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-[11px] font-extrabold text-slate-850 dark:text-white">Enter Scores & Caste Tags</Text>
                  <Text className="text-[9px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                    Type your rank and select your category (Open, OBC, SC, ST, EWS). Check state parameters for correct quota calculations.
                  </Text>
                </View>
              </View>

              <View className="flex-row items-start space-x-3">
                <View className="w-5 h-5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/40 justify-center items-center">
                  <Text className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">2</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-[11px] font-extrabold text-slate-850 dark:text-white">Calibrate with Percentiles</Text>
                  <Text className="text-[9px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                    Percentiles help align score anomalies. Note that NEET uses absolute ranking coordinates instead.
                  </Text>
                </View>
              </View>

              <View className="flex-row items-start space-x-3">
                <View className="w-5 h-5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/40 justify-center items-center">
                  <Text className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">3</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-[11px] font-extrabold text-slate-855 dark:text-white">Evaluate via Strategy Badges</Text>
                  <Text className="text-[9px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                    We automatically classify projections as Safe, Balanced, or Dream target seats to optimize counseling filling lists.
                  </Text>
                </View>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Loading / Inference Status */}
        {isPending && (
          <View className="bg-white dark:bg-[#1A1A24] border border-slate-200 dark:border-slate-850 p-8 rounded-2xl items-center space-y-3">
            <ActivityIndicator size="large" color="#10B981" />
            <Text className="text-xs font-bold text-slate-850 dark:text-white">Running Multi-Model Inference</Text>
            <Text className="text-[10px] text-slate-400 dark:text-slate-500 text-center max-w-[80%]">
              Evaluating seat capacity records, quota criteria adjustments, and difficulty index calibration...
            </Text>
          </View>
        )}

        {/* Inference Error */}
        {error && (
          <View className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 p-4 rounded-xl space-y-1">
            <Text className="text-xs font-bold text-rose-800 dark:text-rose-300">Inference Failure</Text>
            <Text className="text-[10px] text-rose-700 dark:text-rose-455">{error.message || "Unable to contact prediction engine."}</Text>
          </View>
        )}

        {/* Prediction Results */}
        {isSuccess && data && (
          <View className="space-y-4">
            
            {/* Strategy Counts Summary Banner */}
            <View className="flex-row justify-between bg-slate-100 dark:bg-slate-900 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800" style={{ gap: 8 }}>
              <View className="flex-1 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1.5 rounded-xl items-center">
                <Text className="text-emerald-500 text-[10px] font-black">SAFE</Text>
                <Text className="text-emerald-600 dark:text-emerald-400 text-base font-black">{safeCount}</Text>
              </View>
              <View className="flex-1 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5 rounded-xl items-center">
                <Text className="text-amber-500 text-[10px] font-black">BALANCED</Text>
                <Text className="text-amber-600 dark:text-amber-400 text-base font-black">{balancedCount}</Text>
              </View>
              <View className="flex-1 bg-rose-500/10 border border-rose-500/20 px-2.5 py-1.5 rounded-xl items-center">
                <Text className="text-rose-500 text-[10px] font-black">DREAM</Text>
                <Text className="text-rose-600 dark:text-rose-400 text-base font-black">{dreamCount}</Text>
              </View>
            </View>

            {/* Warning for Lower Quality Data */}
            {hasLowerConfidence && (
              <View className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl p-3.5 space-y-1">
                <Text className="text-[10px] font-bold text-amber-900 dark:text-amber-300">Statistical Precision Notice</Text>
                <Text className="text-[9px] text-amber-805 dark:text-amber-400 leading-relaxed">
                  Some projections display MEDIUM or LOW data quality indicators. Match coordinates with the counseling archive before registering choices.
                </Text>
              </View>
            )}

            {/* Results Info Card */}
            <View className="bg-white dark:bg-[#1A1A24] border border-slate-200 dark:border-slate-800 px-4 py-3 rounded-xl flex-row justify-between items-center">
              <Text className="text-[10px] font-bold text-slate-700 dark:text-slate-300">Matches: {data.predictions.length}</Text>
              <Text className="text-[9px] text-slate-450 dark:text-slate-400 font-bold uppercase font-mono">Model: {data.metadata.model_version}</Text>
            </View>

            {/* Prediction Cards List */}
            <Animated.View layout={Layout.springify()}>
              {data.predictions.map((p, idx) => {
                const isSaved = savedList.some(
                  (item) => item.college_code === p.college_code && item.branch_code === p.branch_code
                );
                return (
                  <PredictionCard
                    key={`${p.college_code}-${p.branch_code}-${idx}`}
                    prediction={p}
                    onSave={() => handleSave(p)}
                    isSaved={isSaved}
                  />
                );
              })}
            </Animated.View>

            {/* Disclaimer */}
            <View className="bg-slate-100 dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800">
              <Text className="text-[9px] text-slate-500 dark:text-slate-450 leading-relaxed">
                Disclaimer: {data.metadata.disclaimer} Real allocations depend on registration pools and actual seat matrices.
              </Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Wishlist Sheet Modal */}
      <Modal visible={isWishlistVisible} animationType="slide" transparent={false}>
        <SavedCollegesSheet 
          savedList={savedList}
          onRemove={handleRemove}
          onClose={() => setIsWishlistVisible(false)}
        />
      </Modal>
    </View>
  );
}

