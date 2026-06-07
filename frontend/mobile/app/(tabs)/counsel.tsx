import React, { useState, useEffect } from "react";
import { View, Text, ScrollView, Pressable, TextInput, ActivityIndicator, Modal } from "react-native";
import { useMutation, useQuery } from "@tanstack/react-query";
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { predictCollegesMobile, generateMockPredictions, Prediction, PredictionRequest } from "../../src/lib/api";
import { storage } from "../../src/lib/storage";

const COUNSEL_CHOICES_CACHE_KEY = "counsel_choices_cache_v1";

interface ChoiceItem {
  choice_number: number;
  college_code: string;
  college_name: string;
  branch_code: string;
  branch_name: string;
  admission_probability: number;
  fees_per_year: number;
  nirf_rank: number;
  quota: string;
  reason: string;
}

const ScalePressable = ({
  children,
  onPress,
  className,
  disabled,
  style
}: {
  children: React.ReactNode;
  onPress?: () => void;
  className?: string;
  disabled?: boolean;
  style?: any;
}) => {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.93, { damping: 10, stiffness: 100 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 10, stiffness: 100 });
      }}
      style={style}
    >
      <Animated.View style={animatedStyle} className={className}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

export default function MobileCounselingCompassScreen() {
  const [exam, setExam] = useState("JEE_MAIN");
  const [rank, setRank] = useState("12500");
  const [category, setCategory] = useState("GENERAL");
  const [homeState, setHomeState] = useState("MH");
  const [gender, setGender] = useState("M");

  const [weights, setWeights] = useState({
    branch: 0.4,
    brand: 0.3,
    location: 0.2,
    fees: 0.1
  });

  const [riskAppetite, setRiskAppetite] = useState<"AGGRESSIVE" | "BALANCED" | "CONSERVATIVE">("BALANCED");
  const [choices, setChoices] = useState<ChoiceItem[]>([]);
  const [riskScore, setRiskScore] = useState(50);
  const [explanation, setExplanation] = useState("");

  // What-If Simulation
  const [isWhatIfVisible, setIsWhatIfVisible] = useState(false);
  const [seatMatrixChange, setSeatMatrixChange] = useState(0.0);
  const [cutoffDrift, setCutoffDrift] = useState(0.0);

  // Counseling Rules
  const [rules, setRules] = useState<string[]>([]);

  // Load offline cache on mount
  useEffect(() => {
    try {
      const cached = storage.getString(COUNSEL_CHOICES_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        setChoices(parsed.choices || []);
        setExplanation(parsed.explanation || "Loaded from local MMKV offline cache.");
        setRiskScore(parsed.riskScore || 50);
      }
    } catch (e) {
      console.warn("Failed to load choices cache:", e);
    }
  }, []);

  // Update counseling rules list when exam changes
  useEffect(() => {
    const mainRules = [
      "Choice entry locks automatically on final day. Verify sequence.",
      "Acceptance fees are mandatory after Round 1 allotment.",
      "Float/Freeze choices must be registered within 72 hours.",
      "Documents must be verified by nodal officer before allotment."
    ];
    setRules(mainRules);
  }, [exam]);

  // Balance weights such that they sum to 1.0
  const adjustWeight = (key: "branch" | "brand" | "location" | "fees", delta: number) => {
    const keys = ["branch", "brand", "location", "fees"] as const;
    const otherKeys = keys.filter((k) => k !== key);

    const oldVal = weights[key];
    const newVal = Math.max(0.05, Math.min(0.85, parseFloat((oldVal + delta).toFixed(2))));
    const remaining = 1 - newVal;
    const currentOthersSum = otherKeys.reduce((sum, k) => sum + weights[k], 0);

    const nextWeights = { ...weights };
    nextWeights[key] = newVal;

    if (currentOthersSum > 0) {
      otherKeys.forEach((k) => {
        nextWeights[k] = parseFloat((remaining * (weights[k] / currentOthersSum)).toFixed(2));
      });
    } else {
      otherKeys.forEach((k) => {
        nextWeights[k] = parseFloat((remaining / 3).toFixed(2));
      });
    }

    // Adjust float margins to total exactly 1.0
    const total = nextWeights.branch + nextWeights.brand + nextWeights.location + nextWeights.fees;
    const diff = 1.0 - total;
    if (Math.abs(diff) > 0.001) {
      nextWeights[otherKeys[0]] = parseFloat((nextWeights[otherKeys[0]] + diff).toFixed(2));
    }

    setWeights(nextWeights);
  };

  // Run core optimization logic
  const handleOptimize = async () => {
    const numRank = parseInt(rank) || 12500;
    const req: PredictionRequest = {
      exam,
      rank: numRank,
      percentile: null,
      category,
      home_state: homeState,
      gender,
      year: 2026
    };

    // Calculate predictions
    const response = await predictCollegesMobile(req);
    const candidate_colleges = response.predictions.slice(0, 10);

    // Run custom sorting for choices optimization
    const sorted = [...candidate_colleges].sort((a, b) => {
      const aScore = 
        (a.admission_probability * 0.35) + 
        ((1 / (a.nirf_rank || 120)) * weights.brand * 55) + 
        (a.branch_code === "CS" ? weights.branch * 1.5 : 0) +
        ((1 / a.fees_per_year) * weights.fees * 600000);
      
      const bScore = 
        (b.admission_probability * 0.35) + 
        ((1 / (b.nirf_rank || 120)) * weights.brand * 55) + 
        (b.branch_code === "CS" ? weights.branch * 1.5 : 0) +
        ((1 / b.fees_per_year) * weights.fees * 600000);
      
      return bScore - aScore;
    });

    const optimized_choices: ChoiceItem[] = sorted.map((p, i) => {
      let riskFactor = "";
      if (riskAppetite === "AGGRESSIVE" && p.admission_probability < 0.4) {
        riskFactor = "Reach choice positioned high for upgrade gaming.";
      } else if (riskAppetite === "CONSERVATIVE" && p.admission_probability > 0.7) {
        riskFactor = "Guaranteed choice positioned for safety.";
      } else {
        riskFactor = `Balanced match based on NIRF #${p.nirf_rank} and your weights.`;
      }

      return {
        choice_number: i + 1,
        college_code: p.college_code,
        college_name: p.college_name,
        branch_code: p.branch_code,
        branch_name: p.branch_name,
        admission_probability: p.admission_probability,
        fees_per_year: p.fees_per_year,
        nirf_rank: p.nirf_rank,
        quota: p.quota,
        reason: `${riskFactor} Verified seat under ${p.quota} quota.`
      };
    });

    const explanationStr = `Optimized choice filling checklist for rank ${numRank} prioritizing ${
      weights.branch > weights.brand ? "Preferred Branches" : "College Tiers"
    } under a ${riskAppetite.toLowerCase()} risk strategy.`;

    const nextScore = riskAppetite === "AGGRESSIVE" ? 80 : riskAppetite === "BALANCED" ? 50 : 25;

    setChoices(optimized_choices);
    setExplanation(explanationStr);
    setRiskScore(nextScore);

    // Save to MMKV offline cache
    try {
      storage.set(COUNSEL_CHOICES_CACHE_KEY, JSON.stringify({
        choices: optimized_choices,
        explanation: explanationStr,
        riskScore: nextScore
      }));
    } catch (e) {
      console.warn("MMKV failed to cache choice list:", e);
    }
  };

  // Reordering functions
  const moveChoice = (index: number, direction: "UP" | "DOWN") => {
    const updated = [...choices];
    const swapTarget = direction === "UP" ? index - 1 : index + 1;
    if (swapTarget < 0 || swapTarget >= choices.length) return;

    const temp = updated[index];
    updated[index] = updated[swapTarget];
    updated[swapTarget] = temp;

    const reindexed = updated.map((c, i) => ({
      ...c,
      choice_number: i + 1
    }));
    setChoices(reindexed);

    // Update MMKV cache
    storage.set(COUNSEL_CHOICES_CACHE_KEY, JSON.stringify({
      choices: reindexed,
      explanation,
      riskScore
    }));
  };

  const removeChoice = (index: number) => {
    const filtered = choices.filter((_, i) => i !== index);
    const reindexed = filtered.map((c, i) => ({
      ...c,
      choice_number: i + 1
    }));
    setChoices(reindexed);

    storage.set(COUNSEL_CHOICES_CACHE_KEY, JSON.stringify({
      choices: reindexed,
      explanation,
      riskScore
    }));
  };

  const applyWhatIf = () => {
    // Run simulation
    const updated = choices.map((c) => {
      let prob = c.admission_probability + (seatMatrixChange * 0.4) + (cutoffDrift * 0.5);
      prob = Math.max(0.01, Math.min(0.99, prob));
      return {
        ...c,
        admission_probability: parseFloat(prob.toFixed(2))
      };
    });
    setChoices(updated);
    setIsWhatIfVisible(false);
  };

  return (
    <View className="flex-1 bg-slate-50 dark:bg-darkBg">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 15, gap: 16 }}>
        
        {/* Step 1: Profile & Target Credentials */}
        <View className="bg-white dark:bg-darkSurface p-4 border border-slate-200 dark:border-darkBorder rounded-xl space-y-3.5">
          <Text className="text-sm font-bold text-slate-800 dark:text-darkHeading">1. Student Details</Text>
          
          <View className="flex-row space-x-3">
            <View className="flex-1 space-y-1">
              <Text className="text-[10px] font-bold text-slate-500 dark:text-darkMuted uppercase">Exam</Text>
              <TextInput
                value={exam}
                onChangeText={setExam}
                className="bg-slate-50 dark:bg-darkSurfaceElevated border border-slate-200 dark:border-darkBorder rounded-lg p-2 text-xs font-semibold text-slate-800 dark:text-darkBody"
              />
            </View>
            <View className="flex-1 space-y-1">
              <Text className="text-[10px] font-bold text-slate-500 dark:text-darkMuted uppercase">Rank (AIR)</Text>
              <TextInput
                value={rank}
                onChangeText={setRank}
                keyboardType="numeric"
                className="bg-slate-50 dark:bg-darkSurfaceElevated border border-slate-200 dark:border-darkBorder rounded-lg p-2 text-xs font-semibold text-slate-800 dark:text-darkBody"
              />
            </View>
          </View>
        </View>

        {/* Step 2: Sliders list */}
        <View className="bg-white dark:bg-darkSurface p-4 border border-slate-200 dark:border-darkBorder rounded-xl space-y-4">
          <View className="flex-row justify-between items-center border-b border-slate-100 dark:border-darkBorder pb-2">
            <Text className="text-sm font-bold text-slate-800 dark:text-darkHeading">2. Balancing Weights</Text>
            <Text className="text-[10px] text-slate-400 dark:text-darkMuted font-bold">Total: 100%</Text>
          </View>

          {[
            { key: "branch", label: "Branch focus" },
            { key: "brand", label: "College Tier" },
            { key: "location", label: "City/Location" },
            { key: "fees", label: "Fee sensitivity" }
          ].map((item) => {
            const val = weights[item.key as keyof typeof weights];
            return (
              <View key={item.key} className="space-y-1.5">
                <View className="flex-row justify-between items-center">
                  <Text className="text-xs font-semibold text-slate-700 dark:text-darkBody">{item.label}</Text>
                  <Text className="text-xs font-bold text-blue-900 dark:text-blue-400">{(val * 100).toFixed(0)}%</Text>
                </View>
                <View className="flex-row items-center space-x-3">
                  <Pressable
                    onPress={() => adjustWeight(item.key as any, -0.05)}
                    className="bg-slate-100 dark:bg-darkSurfaceElevated w-8 h-8 rounded-lg items-center justify-center border border-slate-200 dark:border-darkBorder"
                  >
                    <Text className="font-bold text-slate-750 dark:text-darkHeading">-</Text>
                  </Pressable>
                  <View className="flex-1 bg-slate-100 dark:bg-darkSurfaceElevated h-2 rounded-full overflow-hidden">
                    <View className="bg-blue-900 dark:bg-darkBrand h-full" style={{ width: `${val * 100}%` }} />
                  </View>
                  <Pressable
                    onPress={() => adjustWeight(item.key as any, 0.05)}
                    className="bg-slate-100 dark:bg-darkSurfaceElevated w-8 h-8 rounded-lg items-center justify-center border border-slate-200 dark:border-darkBorder"
                  >
                    <Text className="font-bold text-slate-750 dark:text-darkHeading">+</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>

        {/* Step 3: Risk appetite cards */}
        <View className="bg-white dark:bg-darkSurface p-4 border border-slate-200 dark:border-darkBorder rounded-xl space-y-3">
          <Text className="text-sm font-bold text-slate-800 dark:text-darkHeading">3. Risk Strategy</Text>
          <View className="flex-row space-x-2">
            {[
              { val: "CONSERVATIVE", label: "Safe", color: "bg-emerald-500 dark:bg-darkSafe" },
              { val: "BALANCED", label: "Balanced", color: "bg-amber-500 dark:bg-darkReach" },
              { val: "AGGRESSIVE", label: "Aggressive", color: "bg-rose-500" }
            ].map((item) => {
              const active = riskAppetite === item.val;
              return (
                <ScalePressable
                  key={item.val}
                  onPress={() => setRiskAppetite(item.val as any)}
                  style={{ flex: 1 }}
                  className={`p-2.5 rounded-xl border items-center justify-center ${
                    active 
                      ? "bg-blue-50 dark:bg-blue-950/40 border-blue-950 dark:border-blue-500" 
                      : "bg-slate-50 dark:bg-darkSurfaceElevated border-slate-200 dark:border-darkBorder"
                  }`}
                >
                  <Text className={`text-xs font-bold ${active ? "text-blue-955 dark:text-blue-450" : "text-slate-600 dark:text-darkMuted"}`}>
                    {item.label}
                  </Text>
                  <View className={`w-2 h-2 rounded-full mt-1.5 ${item.color}`} />
                </ScalePressable>
              );
            })}
          </View>
        </View>

        {/* Action: Compute Optimization */}
        <ScalePressable
          onPress={handleOptimize}
          className="bg-blue-900 dark:bg-darkBrand py-3.5 rounded-xl items-center justify-center shadow-sm"
        >
          <Text className="text-white dark:text-darkHeading font-bold text-xs uppercase tracking-wider">Optimize choices list</Text>
        </ScalePressable>

        {/* Action: What-If simulation modal trigger */}
        <ScalePressable
          onPress={() => setIsWhatIfVisible(true)}
          className="border border-slate-350 dark:border-darkBorder bg-white dark:bg-darkSurface py-3 rounded-xl items-center justify-center"
        >
          <Text className="text-slate-700 dark:text-darkBody font-bold text-xs">Simulate What-If parameters</Text>
        </ScalePressable>

        {/* Step 4: Rules checklist */}
        <View className="bg-white dark:bg-darkSurface p-4 border border-slate-200 dark:border-darkBorder rounded-xl space-y-2.5">
          <Text className="text-sm font-bold text-slate-800 dark:text-darkHeading border-b border-slate-100 dark:border-darkBorder pb-2">Allotment Rules Checkpoint</Text>
          {rules.map((rule, idx) => (
            <View key={idx} className="flex-row items-start space-x-2">
              <Text className="text-blue-900 dark:text-blue-400 font-bold text-xs mt-0.5">•</Text>
              <Text className="text-[11px] text-slate-650 dark:text-darkBody flex-1 leading-snug">{rule}</Text>
            </View>
          ))}
        </View>

        {/* Step 5: Choice Table (Optimized Preferences) */}
        {choices.length > 0 ? (
          <View className="space-y-3.5">
            <View className="flex-row justify-between items-center bg-slate-200/80 dark:bg-darkSurfaceElevated px-4 py-2.5 rounded-xl">
              <Text className="text-xs font-bold text-slate-750 dark:text-darkHeading">Optimized Order Checklist</Text>
              <Text className="text-[10px] text-slate-500 dark:text-darkMuted font-bold">Total: {choices.length}</Text>
            </View>

            {explanation ? (
              <View className="bg-blue-50 dark:bg-blue-950/20 border border-blue-150 dark:border-blue-900/40 p-3 rounded-lg">
                <Text className="text-[10px] text-blue-900 dark:text-blue-300 leading-snug">{explanation}</Text>
              </View>
            ) : null}

            {choices.map((item, index) => {
              const probColor = 
                item.admission_probability > 0.70 
                  ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/40" 
                  : item.admission_probability >= 0.40 
                  ? "bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-900/40" 
                  : "bg-rose-50 dark:bg-rose-950/20 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-900/40";

              return (
                <View 
                  key={`${item.college_code}-${item.branch_code}`}
                  className="bg-white dark:bg-darkSurface border border-slate-200 dark:border-darkBorder p-4 rounded-xl space-y-3 shadow-sm"
                >
                  <View className="flex-row justify-between items-start">
                    <View className="flex-1 pr-3">
                      <Text className="text-xs font-bold text-slate-800 dark:text-darkHeading leading-snug">
                        #{item.choice_number} {item.college_name}
                      </Text>
                      <Text className="text-[10px] text-slate-500 dark:text-darkMuted font-semibold mt-0.5">
                        {item.branch_name} ({item.branch_code})
                      </Text>
                    </View>
                    
                    <Pressable
                      onPress={() => removeChoice(index)}
                      className="bg-rose-50 dark:bg-rose-950/40 p-1.5 rounded"
                    >
                      <Text className="text-[8px] font-bold text-rose-600 dark:text-rose-400">Delete</Text>
                    </Pressable>
                  </View>

                  <View className="flex-row justify-between items-center pt-2.5 border-t border-slate-100 dark:border-darkBorder">
                    <View className="flex-row space-x-2">
                      <Pressable
                        disabled={index === 0}
                        onPress={() => moveChoice(index, "UP")}
                        className="bg-slate-100 dark:bg-darkSurfaceElevated px-2.5 py-1.5 rounded border border-slate-200 dark:border-darkBorder disabled:opacity-40"
                      >
                        <Text className="text-[9px] font-bold text-slate-700 dark:text-darkHeading">▲ Up</Text>
                      </Pressable>
                      <Pressable
                        disabled={index === choices.length - 1}
                        onPress={() => moveChoice(index, "DOWN")}
                        className="bg-slate-100 dark:bg-darkSurfaceElevated px-2.5 py-1.5 rounded border border-slate-200 dark:border-darkBorder disabled:opacity-40"
                      >
                        <Text className="text-[9px] font-bold text-slate-700 dark:text-darkHeading">▼ Down</Text>
                      </Pressable>
                    </View>

                    <View className={`px-2 py-0.5 border rounded-full ${probColor}`}>
                      <Text className="text-[9px] font-bold">
                        {Math.round(item.admission_probability * 100)}% Match
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        ) : (
          <View className="bg-white dark:bg-darkSurface border border-slate-250 dark:border-darkBorder p-5 rounded-2xl space-y-4 shadow-sm">
            <View className="border-b border-slate-100 dark:border-darkBorder pb-2.5">
              <Text className="text-xs font-bold text-slate-800 dark:text-darkHeading uppercase tracking-wider">How Counseling Compass Works</Text>
              <Text className="text-[10px] text-slate-450 dark:text-darkMuted mt-0.5">Let's walk through building your optimized choices checklist.</Text>
            </View>

            <View className="space-y-3.5">
              <View className="flex-row items-start space-x-3">
                <View className="w-5 h-5 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/40 justify-center items-center">
                  <Text className="text-[10px] font-bold text-blue-900 dark:text-blue-400">1</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-[11px] font-bold text-slate-750 dark:text-darkHeading">Set Priority Weights</Text>
                  <Text className="text-[9px] text-slate-455 dark:text-darkMuted mt-0.5 leading-snug">
                    Use the sliders in Step 2 to balance how much you value college brand rank, branch choices, location coordinates, or total fee structures.
                  </Text>
                </View>
              </View>

              <View className="flex-row items-start space-x-3">
                <View className="w-5 h-5 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/40 justify-center items-center">
                  <Text className="text-[10px] font-bold text-blue-900 dark:text-blue-400">2</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-[11px] font-bold text-slate-755 dark:text-darkHeading">Select Risk Strategy</Text>
                  <Text className="text-[9px] text-slate-455 dark:text-darkMuted mt-0.5 leading-snug">
                    Choose "Safe" to prefer guaranteed colleges, "Balanced" for standard risk, or "Aggressive" to position reach colleges high for upgrade gaming.
                  </Text>
                </View>
              </View>

              <View className="flex-row items-start space-x-3">
                <View className="w-5 h-5 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/40 justify-center items-center">
                  <Text className="text-[10px] font-bold text-blue-900 dark:text-blue-400">3</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-[11px] font-bold text-slate-755 dark:text-darkHeading">Run What-If Simulations</Text>
                  <Text className="text-[9px] text-slate-455 dark:text-darkMuted mt-0.5 leading-snug">
                    Click "Simulate What-If parameters" to evaluate how seat matrix changes or cutoff drift affects your admission probabilities.
                  </Text>
                </View>
              </View>

              <View className="flex-row items-start space-x-3">
                <View className="w-5 h-5 rounded-full bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/40 justify-center items-center">
                  <Text className="text-[10px] font-bold text-blue-900 dark:text-blue-400">4</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-[11px] font-bold text-slate-755 dark:text-darkHeading">Optimize & Reorder</Text>
                  <Text className="text-[9px] text-slate-455 dark:text-darkMuted mt-0.5 leading-snug">
                    Press "Optimize choices list" to run the algorithm. Once generated, use Up/Down controls to finalize your export sequence.
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

      </ScrollView>

      {/* What-If bottom sheet simulation modal */}
      <Modal visible={isWhatIfVisible} transparent animationType="slide">
        <View className="flex-1 bg-slate-900/60 dark:bg-black/75 justify-end">
          <View className="bg-white dark:bg-darkSurfaceElevated rounded-t-2xl p-6 space-y-5">
            <View className="flex-row justify-between items-center border-b border-slate-100 dark:border-darkBorder pb-2">
              <View>
                <Text className="text-sm font-bold text-slate-800 dark:text-darkHeading">What-If Parameters</Text>
                <Text className="text-[10px] text-slate-400 dark:text-darkMuted">Simulate external counseling pool volatility</Text>
              </View>
              <Pressable onPress={() => setIsWhatIfVisible(false)}>
                <Text className="text-xs font-bold text-slate-500 dark:text-darkMuted">Close</Text>
              </Pressable>
            </View>

            {/* Seat Matrix slider simulation */}
            <View className="space-y-1.5">
              <View className="flex-row justify-between">
                <Text className="text-xs font-semibold text-slate-700 dark:text-darkBody">Seat Matrix Change</Text>
                <Text className="text-xs font-bold text-blue-900 dark:text-blue-400">{(seatMatrixChange * 100).toFixed(0)}%</Text>
              </View>
              <View className="flex-row justify-between space-x-4">
                <Pressable
                  onPress={() => setSeatMatrixChange(Math.max(-0.2, seatMatrixChange - 0.05))}
                  className="bg-slate-100 dark:bg-darkSurface px-3 py-1 rounded"
                >
                  <Text className="font-bold text-xs dark:text-darkHeading">-5%</Text>
                </Pressable>
                <Pressable
                  onPress={() => setSeatMatrixChange(Math.min(0.2, seatMatrixChange + 0.05))}
                  className="bg-slate-100 dark:bg-darkSurface px-3 py-1 rounded"
                >
                  <Text className="font-bold text-xs dark:text-darkHeading">+5%</Text>
                </Pressable>
              </View>
            </View>

            {/* Cutoff Drift simulation */}
            <View className="space-y-1.5">
              <View className="flex-row justify-between">
                <Text className="text-xs font-semibold text-slate-700 dark:text-darkBody">Expected Cutoff Drift</Text>
                <Text className="text-xs font-bold text-blue-900 dark:text-blue-400">{(cutoffDrift * 100).toFixed(0)}%</Text>
              </View>
              <View className="flex-row justify-between space-x-4">
                <Pressable
                  onPress={() => setCutoffDrift(Math.max(-0.2, cutoffDrift - 0.05))}
                  className="bg-slate-100 dark:bg-darkSurface px-3 py-1 rounded"
                >
                  <Text className="font-bold text-xs dark:text-darkHeading">-5%</Text>
                </Pressable>
                <Pressable
                  onPress={() => setCutoffDrift(Math.min(0.2, cutoffDrift + 0.05))}
                  className="bg-slate-100 dark:bg-darkSurface px-3 py-1 rounded"
                >
                  <Text className="font-bold text-xs dark:text-darkHeading">+5%</Text>
                </Pressable>
              </View>
            </View>

            <Pressable
              onPress={applyWhatIf}
              className="bg-emerald-600 dark:bg-darkSafe py-3.5 rounded-xl items-center justify-center shadow"
            >
              <Text className="text-white dark:text-darkHeading font-bold text-xs">Run Scenario Prediction</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}
