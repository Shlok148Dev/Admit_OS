import React, { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, Modal, Alert } from "react-native";
import { PredictionRequest } from "../lib/api";

const EXAMS = [
  { label: "JEE Main", value: "JEE_MAIN" },
  { label: "JEE Advanced", value: "JEE_ADVANCED" },
  { label: "NEET-UG", value: "NEET" },
  { label: "MHT-CET (State)", value: "MHT_CET" },
  { label: "KCET (State)", value: "KCET" }
];

const CATEGORIES = [
  { label: "General (Open)", value: "GENERAL" },
  { label: "OBC-NCL", value: "OBC_NCL" },
  { label: "Scheduled Caste (SC)", value: "SC" },
  { label: "Scheduled Tribe (ST)", value: "ST" },
  { label: "EWS", value: "EWS" },
  { label: "PwD", value: "PwD" }
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

const GENDERS = [
  { label: "Male (Gender-Neutral)", value: "M" },
  { label: "Female (Supernumerary)", value: "F" },
  { label: "Other", value: "OTHER" }
];

const BRANCHES: Record<string, { label: string; code: string }[]> = {
  JEE_MAIN: [
    { label: "Computer Science (CSE)", code: "CS" },
    { label: "Electronics (ECE)", code: "EC" },
    { label: "Electrical (EEE)", code: "EE" },
    { label: "Mechanical (ME)", code: "ME" },
    { label: "Civil (CE)", code: "CE" },
    { label: "Chemical (CH)", code: "CH" }
  ],
  JEE_ADVANCED: [
    { label: "Computer Science (CSE)", code: "CS" },
    { label: "Electronics (ECE)", code: "EC" },
    { label: "Electrical (EEE)", code: "EE" },
    { label: "Mechanical (ME)", code: "ME" },
    { label: "Civil (CE)", code: "CE" },
    { label: "Chemical (CH)", code: "CH" }
  ],
  NEET: [
    { label: "MBBS", code: "MBBS" },
    { label: "Dental (BDS)", code: "BDS" },
    { label: "Ayurveda (BAMS)", code: "BAMS" }
  ],
  MHT_CET: [
    { label: "Computer Science (CSE)", code: "CS" },
    { label: "Electronics (ECE)", code: "EC" },
    { label: "Electrical (EEE)", code: "EE" },
    { label: "Mechanical (ME)", code: "ME" },
    { label: "Civil (CE)", code: "CE" }
  ],
  KCET: [
    { label: "Computer Science (CSE)", code: "CS" },
    { label: "Electronics (ECE)", code: "EC" },
    { label: "Electrical (EEE)", code: "EE" },
    { label: "Mechanical (ME)", code: "ME" },
    { label: "Civil (CE)", code: "CE" }
  ]
};

const COLLEGE_TYPES: Record<string, string[]> = {
  JEE_MAIN: ["NIT", "IIIT", "GFTI"],
  JEE_ADVANCED: ["IIT"],
  NEET: ["AIIMS", "STATE", "PRIVATE"],
  MHT_CET: ["STATE", "PRIVATE"],
  KCET: ["STATE", "PRIVATE"]
};

interface RankRadarFormProps {
  onSubmit: (req: PredictionRequest) => void;
  isPending: boolean;
}

export default function RankRadarForm({ onSubmit, isPending }: RankRadarFormProps) {
  const [exam, setExam] = useState("JEE_MAIN");
  const [rank, setRank] = useState("");
  const [percentile, setPercentile] = useState("");
  const [category, setCategory] = useState("GENERAL");
  const [homeState, setHomeState] = useState("MH");
  const [gender, setGender] = useState("M");
  
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [selectedCollegeTypes, setSelectedCollegeTypes] = useState<string[]>([]);
  const [pickerType, setPickerType] = useState<"exam" | "category" | "state" | "gender" | null>(null);

  const handleBranchToggle = (code: string) => {
    setSelectedBranches(prev => 
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  const handleTypeToggle = (type: string) => {
    setSelectedCollegeTypes(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    );
  };

  const handleFormSubmit = () => {
    const rankNum = parseInt(rank, 10);
    if (isNaN(rankNum) || rankNum <= 0) {
      Alert.alert("Invalid Rank", "Please enter a valid positive integer rank.");
      return;
    }
    const percNum = percentile ? parseFloat(percentile) : null;
    if (percNum !== null && (percNum < 0 || percNum > 100)) {
      Alert.alert("Invalid Percentile", "Percentile must be between 0 and 100.");
      return;
    }

    onSubmit({
      exam,
      rank: rankNum,
      percentile: percNum,
      category,
      home_state: homeState,
      gender,
      year: 2026,
      filters: {
        branches: selectedBranches.length > 0 ? selectedBranches : null,
        college_types: selectedCollegeTypes.length > 0 ? selectedCollegeTypes : null
      }
    });
  };

  const renderPickerModal = () => {
    if (!pickerType) return null;
    let title = "";
    let items: { label: string; value: string }[] = [];
    let selectedValue = "";
    let onSelect = (val: string) => {};

    if (pickerType === "exam") {
      title = "Select Exam Type";
      items = EXAMS;
      selectedValue = exam;
      onSelect = (val) => {
        setExam(val);
        setSelectedBranches([]);
        setSelectedCollegeTypes([]);
        if (val === "NEET") setPercentile("");
      };
    } else if (pickerType === "category") {
      title = "Select Category";
      items = CATEGORIES;
      selectedValue = category;
      onSelect = setCategory;
    } else if (pickerType === "state") {
      title = "Select Home State";
      items = STATES;
      selectedValue = homeState;
      onSelect = setHomeState;
    } else if (pickerType === "gender") {
      title = "Select Gender Pool";
      items = GENDERS;
      selectedValue = gender;
      onSelect = setGender;
    }

    return (
      <Modal visible={true} transparent={true} animationType="slide">
        <View className="flex-1 justify-end bg-black/40">
          <View className="bg-white dark:bg-darkSurface rounded-t-3xl p-6 max-h-[85%] space-y-4">
            <View className="flex-row justify-between items-center border-b border-slate-100 dark:border-darkBorder pb-3">
              <Text className="text-base font-bold text-slate-800 dark:text-darkHeading">{title}</Text>
              <Pressable onPress={() => setPickerType(null)}>
                <Text className="text-blue-500 dark:text-blue-400 font-bold text-sm">Cancel</Text>
              </Pressable>
            </View>
            <ScrollView className="space-y-1">
              {items.map((item) => (
                <Pressable
                  key={item.value}
                  onPress={() => {
                    onSelect(item.value);
                    setPickerType(null);
                  }}
                  className={`p-3.5 rounded-xl flex-row justify-between items-center ${
                    selectedValue === item.value ? "bg-blue-50 dark:bg-blue-950/40" : ""
                  }`}
                >
                  <Text className={`text-xs ${selectedValue === item.value ? "font-bold text-blue-900 dark:text-blue-400" : "text-slate-700 dark:text-darkHeading"}`}>
                    {item.label}
                  </Text>
                  {selectedValue === item.value && (
                    <Text className="text-blue-900 dark:text-blue-400 font-bold">✓</Text>
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  };

  return (
    <View className="bg-white dark:bg-darkSurface border border-slate-200 dark:border-darkBorder rounded-2xl p-5 shadow-sm space-y-4">
      <Text className="text-sm font-bold text-slate-800 dark:text-darkHeading uppercase tracking-wide">1. Credentials</Text>
      
      {/* Inputs Grid */}
      <View className="space-y-3.5">
        <View className="flex-row space-x-3">
          <View className="flex-1 space-y-1">
            <Text className="text-[10px] font-bold text-slate-500 dark:text-darkMuted uppercase">Exam Type</Text>
            <Pressable onPress={() => setPickerType("exam")} className="bg-slate-50 dark:bg-darkSurfaceElevated border border-slate-200 dark:border-darkBorder p-3 rounded-xl flex-row justify-between items-center">
              <Text className="text-xs text-slate-800 dark:text-darkHeading font-medium">{EXAMS.find(e => e.value === exam)?.label}</Text>
              <Text className="text-slate-400 dark:text-darkMuted text-[10px]">▼</Text>
            </Pressable>
          </View>
          <View className="flex-1 space-y-1">
            <Text className="text-[10px] font-bold text-slate-500 dark:text-darkMuted uppercase">Category</Text>
            <Pressable onPress={() => setPickerType("category")} className="bg-slate-50 dark:bg-darkSurfaceElevated border border-slate-200 dark:border-darkBorder p-3 rounded-xl flex-row justify-between items-center">
              <Text className="text-xs text-slate-800 dark:text-darkHeading font-medium" numberOfLines={1}>{CATEGORIES.find(c => c.value === category)?.label}</Text>
              <Text className="text-slate-400 dark:text-darkMuted text-[10px]">▼</Text>
            </Pressable>
          </View>
        </View>

        <View className="flex-row space-x-3">
          <View className="flex-1 space-y-1">
            <Text className="text-[10px] font-bold text-slate-500 dark:text-darkMuted uppercase">AIR Rank</Text>
            <TextInput
              value={rank}
              onChangeText={setRank}
              keyboardType="numeric"
              placeholder="e.g. 12050"
              placeholderTextColor="#6B7280"
              className="bg-slate-55 dark:bg-darkSurfaceElevated border border-slate-200 dark:border-darkBorder px-3 py-2.5 rounded-xl text-xs text-slate-808 dark:text-darkBody font-medium"
            />
          </View>
          <View className="flex-1 space-y-1">
            <Text className="text-[10px] font-bold text-slate-500 dark:text-darkMuted uppercase">Percentile</Text>
            <TextInput
              value={percentile}
              onChangeText={setPercentile}
              keyboardType="numeric"
              editable={exam !== "NEET"}
              placeholder={exam === "NEET" ? "N/A" : "e.g. 98.6"}
              placeholderTextColor="#6B7280"
              className={`px-3 py-2.5 rounded-xl text-xs text-slate-800 dark:text-darkBody font-medium border ${
                exam === "NEET" 
                  ? "bg-slate-100 dark:bg-darkBg border-slate-200 dark:border-darkBorder text-slate-400 dark:text-darkMuted" 
                  : "bg-slate-50 dark:bg-darkSurfaceElevated border-slate-200 dark:border-darkBorder"
              }`}
            />
          </View>
        </View>

        <View className="flex-row space-x-3">
          <View className="flex-1 space-y-1">
            <Text className="text-[10px] font-bold text-slate-500 dark:text-darkMuted uppercase">Home State</Text>
            <Pressable onPress={() => setPickerType("state")} className="bg-slate-50 dark:bg-darkSurfaceElevated border border-slate-200 dark:border-darkBorder p-3 rounded-xl flex-row justify-between items-center">
              <Text className="text-xs text-slate-800 dark:text-darkHeading font-medium">{STATES.find(s => s.value === homeState)?.label}</Text>
              <Text className="text-slate-400 dark:text-darkMuted text-[10px]">▼</Text>
            </Pressable>
          </View>
          <View className="flex-1 space-y-1">
            <Text className="text-[10px] font-bold text-slate-500 dark:text-darkMuted uppercase">Gender</Text>
            <Pressable onPress={() => setPickerType("gender")} className="bg-slate-50 dark:bg-darkSurfaceElevated border border-slate-200 dark:border-darkBorder p-3 rounded-xl flex-row justify-between items-center">
              <Text className="text-xs text-slate-800 dark:text-darkHeading font-medium">{GENDERS.find(g => g.value === gender)?.label}</Text>
              <Text className="text-slate-400 dark:text-darkMuted text-[10px]">▼</Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Advanced Filters */}
      <View className="border-t border-slate-100 dark:border-darkBorder pt-3.5 space-y-3">
        <Text className="text-xs font-bold text-slate-700 dark:text-darkHeading uppercase">Filters & Preferences</Text>
        
        {/* College Types */}
        {COLLEGE_TYPES[exam] && COLLEGE_TYPES[exam].length > 0 && (
          <View className="space-y-1.5">
            <Text className="text-[10px] font-bold text-slate-400 dark:text-darkMuted uppercase">College Types</Text>
            <View className="flex-row flex-wrap gap-1.5">
              {COLLEGE_TYPES[exam].map((type) => {
                const active = selectedCollegeTypes.includes(type);
                return (
                  <Pressable
                    key={type}
                    onPress={() => handleTypeToggle(type)}
                    className={`px-3 py-1.5 rounded-full border ${
                      active 
                        ? "bg-blue-900 dark:bg-darkBrand border-blue-900 dark:border-darkBrand" 
                        : "bg-white dark:bg-darkSurface border-slate-200 dark:border-darkBorder"
                    }`}
                  >
                    <Text className={`text-[10px] font-bold ${active ? "text-white dark:text-darkHeading" : "text-slate-650 dark:text-darkMuted"}`}>
                      {type}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        {/* Branches */}
        {BRANCHES[exam] && (
          <View className="space-y-1.5">
            <Text className="text-[10px] font-bold text-slate-400 dark:text-darkMuted uppercase">Preferred Branches</Text>
            <View className="flex-row flex-wrap gap-1.5">
              {BRANCHES[exam].map((br) => {
                const active = selectedBranches.includes(br.code);
                return (
                  <Pressable
                    key={br.code}
                    onPress={() => handleBranchToggle(br.code)}
                    className={`px-3 py-1.5 rounded-full border ${
                      active 
                        ? "bg-emerald-500 dark:bg-darkSafe border-emerald-500 dark:border-darkSafe" 
                        : "bg-white dark:bg-darkSurface border-slate-200 dark:border-darkBorder"
                    }`}
                  >
                    <Text className={`text-[10px] font-bold ${active ? "text-white dark:text-darkHeading" : "text-slate-650 dark:text-darkMuted"}`}>
                      {br.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
      </View>

      {/* Action Button */}
      <Pressable
        disabled={isPending}
        onPress={handleFormSubmit}
        className={`bg-blue-950 dark:bg-darkBrand p-4 rounded-xl items-center justify-center ${isPending ? "opacity-70" : ""}`}
      >
        <Text className="text-white dark:text-darkHeading font-bold text-sm">
          {isPending ? "Running ML Models..." : "Get Matching Predictions"}
        </Text>
      </Pressable>

      {renderPickerModal()}
    </View>
  );
}
