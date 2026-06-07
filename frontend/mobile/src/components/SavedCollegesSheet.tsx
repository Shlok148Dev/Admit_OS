import React from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { SavedCollege } from "../lib/storage";

interface SavedCollegesSheetProps {
  savedList: SavedCollege[];
  onRemove: (collegeCode: string, branchCode: string) => void;
  onClose: () => void;
}

export default function SavedCollegesSheet({ savedList, onRemove, onClose }: SavedCollegesSheetProps) {
  return (
    <View className="flex-1 bg-white dark:bg-darkBg p-6 space-y-4">
      <View className="flex-row justify-between items-center border-b border-slate-100 dark:border-darkBorder pb-3">
        <View>
          <Text className="text-base font-bold text-slate-800 dark:text-darkHeading">Saved Preferences</Text>
          <Text className="text-[10px] text-slate-400 dark:text-darkMuted font-mono">Items persisted in MMKV local storage</Text>
        </View>
        <Pressable onPress={onClose} className="bg-slate-100 dark:bg-darkSurfaceElevated px-3 py-1.5 rounded-lg active:opacity-75">
          <Text className="text-xs font-bold text-slate-600 dark:text-darkHeading">Close</Text>
        </Pressable>
      </View>

      {savedList.length === 0 ? (
        <View className="flex-1 justify-center items-center py-16 space-y-2 bg-white dark:bg-darkBg">
          <Text className="text-slate-400 dark:text-darkMuted text-sm font-semibold">No saved colleges</Text>
          <Text className="text-slate-450 dark:text-darkMuted text-xs text-center max-w-[80%]">
            Swipe right on predicted matches to build your target counseling wishlist.
          </Text>
        </View>
      ) : (
        <ScrollView className="flex-1 dark:bg-darkBg" contentContainerStyle={{ gap: 14 }}>
          {savedList.map((item) => (
            <View 
              key={`${item.college_code}-${item.branch_code}`}
              className="bg-slate-50 dark:bg-darkSurface border border-slate-200 dark:border-darkBorder rounded-xl p-3.5 space-y-2.5"
            >
              <View className="flex-row justify-between items-start">
                <View className="flex-1 pr-3">
                  <Text className="text-xs font-bold text-slate-800 dark:text-darkHeading leading-snug">{item.college_name}</Text>
                  <Text className="text-[9px] text-slate-500 dark:text-darkBody font-semibold">{item.branch_name}</Text>
                </View>
                <Pressable
                  onPress={() => onRemove(item.college_code, item.branch_code)}
                  className="bg-rose-50 dark:bg-rose-950/20 px-2 py-1 rounded"
                >
                  <Text className="text-[8px] font-bold text-rose-600 dark:text-rose-400">Remove</Text>
                </Pressable>
              </View>

              <View className="flex-row justify-between text-[9px] text-slate-400 dark:text-darkMuted font-semibold pt-1 border-t border-slate-100 dark:border-darkBorder">
                <Text className="dark:text-darkMuted">Chance: {(item.admission_probability * 100).toFixed(0)}%</Text>
                <Text className="dark:text-darkMuted">NIRF: #{item.nirf_rank || "N/A"}</Text>
                <Text className="dark:text-darkMuted">Fees: ₹{(item.fees_per_year/1000).toFixed(0)}k/yr</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );
}
