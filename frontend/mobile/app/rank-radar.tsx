import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, Modal } from "react-native";
import { useMutation } from "@tanstack/react-query";
import { predictCollegesMobile, PredictionRequest, PredictionResponse, Prediction } from "../src/lib/api";
import { getSavedColleges, saveCollege, removeSavedCollege, SavedCollege } from "../src/lib/storage";
import RankRadarForm from "../src/components/RankRadarForm";
import PredictionCard from "../src/components/PredictionCard";
import SavedCollegesSheet from "../src/components/SavedCollegesSheet";

export default function RankRadarScreen() {
  const [savedList, setSavedList] = useState<SavedCollege[]>([]);
  const [isWishlistVisible, setIsWishlistVisible] = useState(false);

  // Load saved wishlist from MMKV on mount
  useEffect(() => {
    setSavedList(getSavedColleges());
  }, []);

  const { mutate, data, isPending, error, isSuccess } = useMutation<PredictionResponse, Error, PredictionRequest>({
    mutationFn: predictCollegesMobile,
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

  return (
    <View className="flex-1 bg-slate-50 dark:bg-darkBg">
      <ScrollView className="flex-1 dark:bg-darkBg" contentContainerStyle={{ padding: 20, gap: 20 }}>
        
        {/* Header Widget Row */}
        <View className="flex-row justify-between items-center bg-white dark:bg-darkSurface p-4 border border-slate-200 dark:border-darkBorder rounded-xl shadow-sm">
          <View>
            <Text className="text-sm font-bold text-slate-800 dark:text-darkHeading">Ensemble Predictor</Text>
            <Text className="text-[10px] text-slate-400 dark:text-darkMuted font-mono">Post-Exam Choice Optimizer</Text>
          </View>
          <Pressable 
            onPress={() => setIsWishlistVisible(true)}
            className="bg-blue-900 dark:bg-darkBrand px-3 py-2 rounded-xl flex-row items-center space-x-1"
          >
            <Text className="text-white dark:text-darkHeading font-bold text-xs">Wishlist ({savedList.length})</Text>
          </Pressable>
        </View>

        {/* Input Form */}
        <RankRadarForm onSubmit={handleFormSubmit} isPending={isPending} />

        {/* Empty State Tutorial */}
        {!isSuccess && !isPending && (
          <View className="bg-white dark:bg-darkSurface border border-slate-250 dark:border-darkBorder p-5 rounded-2xl space-y-4 shadow-sm">
            <View className="border-b border-slate-100 dark:border-darkBorder pb-2.5">
              <Text className="text-xs font-bold text-slate-800 dark:text-darkHeading uppercase tracking-wider">How to use Rank Radar</Text>
              <Text className="text-[10px] text-slate-450 dark:text-darkMuted mt-0.5">Let's walk through evaluating matching seat allocations.</Text>
            </View>

            <View className="space-y-3.5">
              <View className="flex-row items-start space-x-3">
                <View className="w-5 h-5 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/40 justify-center items-center">
                  <Text className="text-[10px] font-bold text-blue-900 dark:text-blue-400 font-mono">1</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-[11px] font-bold text-slate-700 dark:text-darkHeading">Enter Scores & Caste Tags</Text>
                  <Text className="text-[9px] text-slate-450 dark:text-darkMuted mt-0.5 leading-snug">
                    Type your rank and select your category (Open, OBC, SC, ST, EWS). Check state parameters for correct quota calculations.
                  </Text>
                </View>
              </View>

              <View className="flex-row items-start space-x-3">
                <View className="w-5 h-5 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/40 justify-center items-center">
                  <Text className="text-[10px] font-bold text-blue-900 dark:text-blue-400 font-mono">2</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-[11px] font-bold text-slate-700 dark:text-darkHeading">Calibrate with Percentiles</Text>
                  <Text className="text-[9px] text-slate-450 dark:text-darkMuted mt-0.5 leading-snug">
                    Percentiles help align score anomalies. Note that NEET uses absolute ranking coordinates instead.
                  </Text>
                </View>
              </View>

              <View className="flex-row items-start space-x-3">
                <View className="w-5 h-5 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/40 justify-center items-center">
                  <Text className="text-[10px] font-bold text-blue-900 dark:text-blue-400 font-mono">3</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-[11px] font-bold text-slate-700 dark:text-darkHeading">Identify High-Confidence Indicators</Text>
                  <Text className="text-[9px] text-slate-450 dark:text-darkMuted mt-0.5 leading-snug">
                    We flag projections with LOW/MEDIUM reliability. Make sure to consult counsel files for low confidence predictions.
                  </Text>
                </View>
              </View>

              <View className="flex-row items-start space-x-3">
                <View className="w-5 h-5 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/40 justify-center items-center">
                  <Text className="text-[10px] font-bold text-blue-900 dark:text-blue-400 font-mono">4</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-[11px] font-bold text-slate-700 dark:text-darkHeading">Save to Offline Wishlist</Text>
                  <Text className="text-[9px] text-slate-450 dark:text-darkMuted mt-0.5 leading-snug">
                    Star top college matches. They are cached locally in MMKV for offline choice list planning.
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Loading / Inference Status */}
        {isPending && (
          <View className="bg-white dark:bg-darkSurface border border-slate-200 dark:border-darkBorder p-8 rounded-2xl items-center space-y-3">
            <ActivityIndicator size="large" color="#2563EB" />
            <Text className="text-xs font-bold text-slate-850 dark:text-darkHeading">Running Multi-Model Inference</Text>
            <Text className="text-[10px] text-slate-400 dark:text-darkMuted text-center max-w-[80%]">
              Evaluating seat capacity records, quota criteria adjustments, and difficulty index calibration...
            </Text>
          </View>
        )}

        {/* Inference Error */}
        {error && (
          <View className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/40 p-4 rounded-xl space-y-1">
            <Text className="text-xs font-bold text-rose-800 dark:text-rose-300">Inference Failure</Text>
            <Text className="text-[10px] text-rose-700 dark:text-rose-400">{error.message || "Unable to contact prediction engine."}</Text>
          </View>
        )}

        {/* Prediction Results */}
        {isSuccess && data && (
          <View className="space-y-4">
            {/* Warning for Lower Quality Data */}
            {hasLowerConfidence && (
              <View className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl p-3.5 space-y-1">
                <Text className="text-[10px] font-bold text-amber-900 dark:text-amber-300">Statistical Precision Notice</Text>
                <Text className="text-[9px] text-amber-800 dark:text-amber-450 leading-relaxed">
                  Some projections display MEDIUM or LOW data quality indicators. Match coordinates with the counseling archive before registering choices.
                </Text>
              </View>
            )}

            {/* Results Info Card */}
            <View className="bg-white dark:bg-darkSurface border border-slate-200 dark:border-darkBorder px-4 py-3 rounded-xl flex-row justify-between items-center">
              <Text className="text-[11px] font-bold text-slate-700 dark:text-darkBody">Matches: {data.predictions.length}</Text>
              <Text className="text-[9px] text-slate-400 dark:text-darkMuted font-bold uppercase font-mono">Model: {data.metadata.model_version}</Text>
            </View>

            {/* Prediction Cards List */}
            <View>
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
            </View>

            {/* Disclaimer */}
            <View className="bg-slate-100 dark:bg-darkSurfaceElevated p-3.5 rounded-xl border border-slate-200 dark:border-darkBorder">
              <Text className="text-[9px] text-slate-500 dark:text-darkMuted leading-relaxed">
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
