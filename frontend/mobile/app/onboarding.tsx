import React, { useState, useEffect } from "react";
import { View, Text, TextInput, Pressable, ScrollView, SafeAreaView, Dimensions, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { storage } from "../src/lib/storage";
import { predictCollegesMobile, Prediction, PredictionRequest } from "../src/lib/api";

const EXAMS = [
  { label: "JEE Main", value: "JEE_MAIN", desc: "For NITs, IIITs, and GFTIs" },
  { label: "JEE Advanced", value: "JEE_ADVANCED", desc: "For Indian Institutes of Technology (IITs)" },
  { label: "NEET-UG", value: "NEET", desc: "For Medical & Dental Colleges" },
  { label: "MHT-CET (State)", value: "MHT_CET", desc: "For Maharashtra engineering admissions" },
  { label: "KCET (State)", value: "KCET", desc: "For Karnataka engineering admissions" }
];

const CATEGORIES = [
  { label: "General (Open)", value: "GENERAL" },
  { label: "OBC-NCL", value: "OBC_NCL" },
  { label: "Scheduled Caste (SC)", value: "SC" },
  { label: "Scheduled Tribe (ST)", value: "ST" },
  { label: "EWS", value: "EWS" },
  { label: "PwD", value: "PwD" }
];

const GENDERS = [
  { label: "Male (Gender-Neutral)", value: "M" },
  { label: "Female (Supernumerary)", value: "F" },
  { label: "Other", value: "OTHER" }
];

const STATES = [
  { label: "Maharashtra (MH)", value: "MH" },
  { label: "Karnataka (KA)", value: "KA" },
  { label: "Delhi (DL)", value: "DL" },
  { label: "Uttar Pradesh (UP)", value: "UP" },
  { label: "Tamil Nadu (TN)", value: "TN" },
  { label: "Andhra Pradesh (AP)", value: "AP" },
  { label: "Telangana (TS)", value: "TS" }
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [screen, setScreen] = useState(1);

  // Form State
  const [exam, setExam] = useState("JEE_MAIN");
  const [rank, setRank] = useState("");
  const [percentile, setPercentile] = useState("");
  const [category, setCategory] = useState("GENERAL");
  const [gender, setGender] = useState("M");
  const [homeState, setHomeState] = useState("MH");
  
  // Custom preference sliders
  const [brandPriority, setBrandPriority] = useState(0.5); // 0 to 1
  const [branchPriority, setBranchPriority] = useState(0.5); // 0 to 1

  // Predictions for Screen 3
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loadingPredictions, setLoadingPredictions] = useState(false);
  const [predictionError, setPredictionError] = useState("");

  // Fetch predictions for Screen 3
  useEffect(() => {
    if (screen === 3 && rank) {
      setLoadingPredictions(true);
      setPredictionError("");
      const rankNum = parseInt(rank, 10);
      const request: PredictionRequest = {
        exam,
        rank: isNaN(rankNum) ? 5000 : rankNum,
        percentile: percentile ? parseFloat(percentile) : null,
        category,
        home_state: homeState,
        gender,
        year: 2026
      };
      
      predictCollegesMobile(request)
        .then((res) => {
          setPredictions(res.predictions.slice(0, 5)); // top 5
        })
        .catch((err) => {
          setPredictionError("Could not retrieve instant predictions.");
          console.error(err);
        })
        .finally(() => {
          setLoadingPredictions(false);
        });
    }
  }, [screen, exam, rank, percentile, category, homeState, gender]);

  const handleNext = () => {
    if (screen === 1) {
      setScreen(2);
    } else if (screen === 2) {
      const r = parseInt(rank, 10);
      if (!rank || isNaN(r) || r <= 0) {
        alert("Please enter a valid rank.");
        return;
      }
      setScreen(3);
    } else if (screen === 3) {
      setScreen(4);
    }
  };

  const handleBack = () => {
    if (screen > 1) {
      setScreen(screen - 1);
    }
  };

  const handleComplete = () => {
    const profileData = {
      primary_exam: exam,
      exam_year: 2026,
      rank: parseInt(rank, 10) || 10000,
      percentile: percentile ? parseFloat(percentile) : null,
      category,
      home_state: homeState,
      gender,
      preferences: {
        branch_priority: branchPriority,
        college_tier_priority: brandPriority
      }
    };

    // Save profile and onboarding state
    storage.set("has_onboarded_v1", "true");
    storage.set("student_profile_v1", JSON.stringify(profileData));
    
    // Route back to home dashboard
    router.replace("/");
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-darkBg">
      <View className="flex-1 px-6 py-4 justify-between">
        
        {/* Top Progress bar */}
        <View className="space-y-2">
          <View className="flex-row justify-between items-center">
            <Text className="text-xs font-bold text-slate-400 dark:text-darkMuted">STEP {screen} OF 4</Text>
            <Text className="text-xs font-extrabold text-blue-900 dark:text-blue-400">ADMIT OS</Text>
          </View>
          <View className="h-1.5 w-full bg-slate-200 dark:bg-darkSurfaceElevated rounded-full overflow-hidden">
            <View 
              className="h-full bg-blue-900 dark:bg-darkBrand transition-all duration-300"
              style={{ width: `${(screen / 4) * 100}%` }}
            />
          </View>
        </View>

        {/* Dynamic Screen Content */}
        <View className="flex-1 justify-center py-6">
          
          {/* SCREEN 1: Target Exam */}
          {screen === 1 && (
            <ScrollView showsVerticalScrollIndicator={false} className="space-y-4">
              <View className="mb-2">
                <Text className="text-2xl font-extrabold text-slate-900 dark:text-darkHeading tracking-tight">Select your exam</Text>
                <Text className="text-xs text-slate-500 dark:text-darkMuted mt-1">We personalize your predictions and timelines based on your exam.</Text>
              </View>
              <View className="space-y-3">
                {EXAMS.map((item) => (
                  <Pressable
                    key={item.value}
                    onPress={() => setExam(item.value)}
                    className={`p-4 rounded-2xl border ${
                      exam === item.value 
                        ? "bg-blue-50 dark:bg-blue-950/40 border-blue-900 dark:border-blue-500 border-2" 
                        : "bg-white dark:bg-darkSurface border-slate-200 dark:border-darkBorder"
                    }`}
                  >
                    <Text className={`text-sm font-bold ${exam === item.value ? "text-blue-900 dark:text-blue-400" : "text-slate-800 dark:text-darkHeading"}`}>
                      {item.label}
                    </Text>
                    <Text className="text-[10px] text-slate-400 dark:text-darkMuted mt-0.5">{item.desc}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          )}

          {/* SCREEN 2: Rank & Credentials */}
          {screen === 2 && (
            <ScrollView showsVerticalScrollIndicator={false} className="space-y-5">
              <View>
                <Text className="text-2xl font-extrabold text-slate-900 dark:text-darkHeading tracking-tight">Your results</Text>
                <Text className="text-xs text-slate-505 dark:text-darkMuted mt-1">Enter your scores to query cutoff predictions.</Text>
              </View>

              <View className="space-y-4">
                {/* AIR Rank */}
                <View className="space-y-1">
                  <Text className="text-[10px] font-bold text-slate-500 dark:text-darkMuted uppercase tracking-wide">All India Rank (AIR)</Text>
                  <TextInput
                    value={rank}
                    onChangeText={setRank}
                    keyboardType="numeric"
                    placeholder="Enter rank, e.g. 8500"
                    placeholderTextColor="#6B7280"
                    className="bg-white dark:bg-darkSurface border border-slate-200 dark:border-darkBorder px-4 py-3 rounded-xl text-sm font-semibold text-slate-800 dark:text-darkBody"
                  />
                </View>

                {/* Percentile */}
                {exam !== "NEET" && (
                  <View className="space-y-1">
                    <Text className="text-[10px] font-bold text-slate-500 dark:text-darkMuted uppercase tracking-wide">Percentile</Text>
                    <TextInput
                      value={percentile}
                      onChangeText={setPercentile}
                      keyboardType="numeric"
                      placeholder="Enter percentile, e.g. 98.45"
                      placeholderTextColor="#6B7280"
                      className="bg-white dark:bg-darkSurface border border-slate-200 dark:border-darkBorder px-4 py-3 rounded-xl text-sm font-semibold text-slate-800 dark:text-darkBody"
                    />
                  </View>
                )}

                {/* Category Selection */}
                <View className="space-y-1">
                  <Text className="text-[10px] font-bold text-slate-500 dark:text-darkMuted uppercase tracking-wide">Caste Category</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {CATEGORIES.map((cat) => (
                      <Pressable
                        key={cat.value}
                        onPress={() => setCategory(cat.value)}
                        className={`px-3 py-2 rounded-full border ${
                          category === cat.value
                            ? "bg-slate-900 dark:bg-darkSurfaceElevated border-slate-900 dark:border-darkBorder"
                            : "bg-white dark:bg-darkSurface border-slate-200 dark:border-darkBorder"
                        }`}
                      >
                        <Text className={`text-[10px] font-bold ${category === cat.value ? "text-white dark:text-darkHeading" : "text-slate-600 dark:text-darkMuted"}`}>
                          {cat.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                {/* Gender */}
                <View className="space-y-1">
                  <Text className="text-[10px] font-bold text-slate-500 dark:text-darkMuted uppercase tracking-wide">Gender Pool</Text>
                  <View className="flex-row space-x-2">
                    {GENDERS.map((g) => (
                      <Pressable
                        key={g.value}
                        onPress={() => setGender(g.value)}
                        className={`flex-1 p-3 rounded-xl border items-center ${
                          gender === g.value
                            ? "bg-blue-50 dark:bg-blue-950/40 border-blue-900 dark:border-blue-500 border-2"
                            : "bg-white dark:bg-darkSurface border border-slate-200 dark:border-darkBorder"
                        }`}
                      >
                        <Text className={`text-[11px] font-bold ${gender === g.value ? "text-blue-900 dark:text-blue-400" : "text-slate-700 dark:text-darkHeading"}`}>
                          {g.label}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>
            </ScrollView>
          )}

          {/* SCREEN 3: Home State & Predictions */}
          {screen === 3 && (
            <View className="flex-1 space-y-4 justify-start">
              <View>
                <Text className="text-2xl font-extrabold text-slate-900 dark:text-darkHeading tracking-tight">Home State Quota</Text>
                <Text className="text-xs text-slate-500 dark:text-darkMuted mt-1">
                  State coordinates grant reserved seat allocations. Here is your matching preview:
                </Text>
              </View>

              {/* State Dropdown Selector */}
              <View className="space-y-1">
                <Text className="text-[10px] font-bold text-slate-400 dark:text-darkMuted uppercase tracking-wide">Select Home State</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row py-1">
                  {STATES.map((st) => (
                    <Pressable
                      key={st.value}
                      onPress={() => setHomeState(st.value)}
                      className={`px-4 py-2 rounded-full mr-2 border ${
                        homeState === st.value
                          ? "bg-blue-900 dark:bg-darkBrand border-blue-900 dark:border-darkBrand"
                          : "bg-white dark:bg-darkSurface border-slate-200 dark:border-darkBorder"
                      }`}
                    >
                      <Text className={`text-xs font-bold ${homeState === st.value ? "text-white dark:text-darkHeading" : "text-slate-650 dark:text-darkMuted"}`}>
                        {st.label}
                      </Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </View>

              {/* Real-time predicted colleges scroll view */}
              <View className="flex-1 bg-white dark:bg-darkSurface border border-slate-250 dark:border-darkBorder rounded-2xl p-4 shadow-inner min-h-[220px]">
                <Text className="text-[10px] font-bold text-slate-400 dark:text-darkMuted uppercase tracking-wider mb-2">Instant Prediction Highlight</Text>
                
                {loadingPredictions ? (
                  <View className="flex-1 justify-center items-center">
                    <ActivityIndicator size="small" color="#2563EB" />
                    <Text className="text-[10px] font-semibold text-slate-455 dark:text-darkMuted mt-2">Computing cutoffs...</Text>
                  </View>
                ) : predictionError ? (
                  <View className="flex-1 justify-center items-center">
                    <Text className="text-xs text-rose-500 dark:text-rose-400 font-bold">{predictionError}</Text>
                  </View>
                ) : predictions.length === 0 ? (
                  <View className="flex-1 justify-center items-center">
                    <Text className="text-xs text-slate-455 dark:text-darkMuted font-bold text-center">No predictions available. Try adjusting rank parameters.</Text>
                  </View>
                ) : (
                  <ScrollView showsVerticalScrollIndicator={false} className="space-y-2">
                    {predictions.map((p, idx) => (
                      <View key={idx} className="flex-row justify-between items-center p-3 border-b border-slate-100 dark:border-darkBorder last:border-0">
                        <View className="flex-1 pr-2">
                          <Text className="text-[11px] font-extrabold text-slate-800 dark:text-darkHeading" numberOfLines={1}>
                            {p.college_name}
                          </Text>
                          <Text className="text-[9px] text-slate-450 dark:text-darkMuted font-bold mt-0.5">
                            {p.branch_name} • Quota: {p.quota}
                          </Text>
                        </View>
                        <View className="items-end">
                          <View className={`px-2 py-0.5 rounded ${
                            p.admission_probability > 0.8 
                              ? "bg-emerald-500/20 dark:bg-emerald-950/40" 
                              : p.admission_probability > 0.5 
                              ? "bg-blue-500/20 dark:bg-blue-950/40" 
                              : "bg-amber-500/20 dark:bg-amber-950/40"
                          }`}>
                            <Text className={`text-[9px] font-bold ${
                              p.admission_probability > 0.8 
                                ? "text-emerald-700 dark:text-emerald-300" 
                                : p.admission_probability > 0.5 
                                ? "text-blue-700 dark:text-blue-300" 
                                : "text-amber-700 dark:text-amber-300"
                            }`}>
                              {(p.admission_probability * 100).toFixed(0)}% Match
                            </Text>
                          </View>
                          <Text className="text-[8px] text-slate-400 dark:text-darkMuted mt-0.5 font-bold">NIRF: #{p.nirf_rank}</Text>
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                )}
              </View>
            </View>
          )}

          {/* SCREEN 4: Preferences & Confirm */}
          {screen === 4 && (
            <ScrollView showsVerticalScrollIndicator={false} className="space-y-6">
              <View>
                <Text className="text-2xl font-extrabold text-slate-900 dark:text-darkHeading tracking-tight">Set Priorities</Text>
                <Text className="text-xs text-slate-500 dark:text-darkMuted mt-1">
                  Adjust preferences to optimize AI-guided counseling lists.
                </Text>
              </View>

              {/* Summary info card */}
              <View className="bg-white dark:bg-darkSurface border border-slate-200 dark:border-darkBorder p-4 rounded-2xl flex-row justify-between items-center shadow-sm">
                <View>
                  <Text className="text-[10px] font-bold text-slate-450 dark:text-darkMuted uppercase">Profile Summary</Text>
                  <Text className="text-xs font-bold text-slate-800 dark:text-darkHeading mt-1">
                    {EXAMS.find(e => e.value === exam)?.label} • Category: {category}
                  </Text>
                  <Text className="text-xs font-bold text-slate-800 dark:text-darkHeading mt-0.5">
                    AIR Rank: {rank} • State: {homeState}
                  </Text>
                </View>
                <Pressable onPress={() => setScreen(2)} className="bg-slate-100 dark:bg-darkSurfaceElevated px-3 py-1.5 rounded-lg">
                  <Text className="text-[10px] font-bold text-slate-600 dark:text-darkHeading">Edit</Text>
                </Pressable>
              </View>

              {/* Slider simulation (toggles/buttons to maintain perfect Expo/RN comp) */}
              <View className="space-y-4">
                <Text className="text-xs font-bold text-slate-705 dark:text-darkBody uppercase">What matters more to you?</Text>

                {/* College Brand vs Specific Branch Preference */}
                <View className="space-y-2">
                  <Text className="text-[11px] font-bold text-slate-600 dark:text-darkBody">College Brand Priority</Text>
                  <View className="flex-row space-x-1.5">
                    {[0.2, 0.5, 0.8].map((val) => (
                      <Pressable
                        key={val}
                        onPress={() => setBrandPriority(val)}
                        className={`flex-1 p-2.5 rounded-xl border items-center ${
                          brandPriority === val ? "bg-slate-900 dark:bg-darkSurfaceElevated border-slate-900 dark:border-darkBorder" : "bg-white dark:bg-darkSurface border-slate-200 dark:border-darkBorder"
                        }`}
                      >
                        <Text className={`text-[10px] font-bold ${brandPriority === val ? "text-white dark:text-darkHeading" : "text-slate-600 dark:text-darkMuted"}`}>
                          {val === 0.2 ? "Low (Tier-3 ok)" : val === 0.5 ? "Medium" : "High (Top Brand)"}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>

                <View className="space-y-2">
                  <Text className="text-[11px] font-bold text-slate-600 dark:text-darkBody">Branch Interest Priority</Text>
                  <View className="flex-row space-x-1.5">
                    {[0.2, 0.5, 0.8].map((val) => (
                      <Pressable
                        key={val}
                        onPress={() => setBranchPriority(val)}
                        className={`flex-1 p-2.5 rounded-xl border items-center ${
                          branchPriority === val ? "bg-slate-900 dark:bg-darkSurfaceElevated border-slate-900 dark:border-darkBorder" : "bg-white dark:bg-darkSurface border-slate-200 dark:border-darkBorder"
                        }`}
                      >
                        <Text className={`text-[10px] font-bold ${branchPriority === val ? "text-white dark:text-darkHeading" : "text-slate-600 dark:text-darkMuted"}`}>
                          {val === 0.2 ? "Low (Any branch)" : val === 0.5 ? "Medium" : "High (Core CS/EC only)"}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              </View>
            </ScrollView>
          )}
        </View>

        {/* Bottom Actions */}
        <View className="flex-row space-x-3 pt-3 border-t border-slate-100 dark:border-darkBorder">
          {screen > 1 && (
            <Pressable
              onPress={handleBack}
              className="flex-1 bg-slate-200 dark:bg-darkSurfaceElevated p-4 rounded-xl items-center justify-center active:bg-slate-300"
            >
              <Text className="text-slate-700 dark:text-darkHeading font-bold text-xs">Back</Text>
            </Pressable>
          )}
          <Pressable
            onPress={screen === 4 ? handleComplete : handleNext}
            className="flex-2 bg-blue-900 dark:bg-darkBrand p-4 rounded-xl items-center justify-center active:bg-blue-950"
            style={{ flex: screen === 1 ? 1 : 2 }}
          >
            <Text className="text-white dark:text-darkHeading font-bold text-xs">
              {screen === 4 ? "Launch ADMIT OS" : "Continue"}
            </Text>
          </Pressable>
        </View>

      </View>
    </SafeAreaView>
  );
}
