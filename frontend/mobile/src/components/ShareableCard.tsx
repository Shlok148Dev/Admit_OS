import React, { useRef, useState } from "react";
import { View, Text, Pressable, Alert, Share, Image, ActivityIndicator, Platform } from "react-native";
import { storage } from "../lib/storage";

interface ShareableCardProps {
  collegeName: string;
  branchName: string;
  probability: number;
  rank: number;
  exam: string;
  category: string;
}

export default function ShareableCard({
  collegeName,
  branchName,
  probability,
  rank,
  exam,
  category
}: ShareableCardProps) {
  const viewRef = useRef<View>(null);
  const [sharing, setSharing] = useState(false);

  const handleShare = async () => {
    setSharing(true);
    try {
      if (Platform.OS === "web") {
        // Web fallback: Use standard share URL / text mockup
        const shareText = `🎓 ADMIT OS Match Report 🎓\n\nExam: ${exam.replace("_", " ")}\nRank: ${rank} (Category: ${category})\nTop Match: ${branchName} at ${collegeName}\nProbability: ${(probability * 100).toFixed(0)}%\n\nComputed by ADMIT OS Multi-Model Ensemble`;
        
        if (typeof navigator !== "undefined" && navigator.share) {
          await navigator.share({
            title: "My ADMIT OS Match",
            text: shareText,
            url: typeof window !== "undefined" ? window.location.href : ""
          });
        } else if (typeof navigator !== "undefined" && navigator.clipboard) {
          const shareUrl = typeof window !== "undefined" ? window.location.href : "";
          await navigator.clipboard.writeText(`${shareText}\nCheck details here: ${shareUrl}`);
          if (Platform.OS === "web") {
            alert("Match report and link copied to clipboard!");
          } else {
            Alert.alert("Shared", "Match report and link copied to clipboard!");
          }
        } else {
          if (Platform.OS === "web") {
            alert(shareText);
          } else {
            Alert.alert("Match Report", shareText);
          }
        }
        return;
      }

      // 1. Try to capture view using react-native-view-shot
      let viewShotModule;
      try {
        viewShotModule = require("react-native-view-shot");
      } catch (e) {
        console.warn("react-native-view-shot not available. Falling back to expo-image-manipulator logic.", e);
      }

      if (viewShotModule && viewShotModule.captureRef && viewRef.current) {
        const uri = await viewShotModule.captureRef(viewRef, {
          format: "png",
          quality: 0.9,
          result: "tmpfile"
        });
        
        await Share.share({
          url: uri,
          title: "My ADMIT OS Match",
          message: `Check out my admission match on ADMIT OS! I have a ${(probability * 100).toFixed(0)}% chance of getting ${branchName} at ${collegeName} with rank ${rank}.`
        });
      } else {
        // 2. Fallback to expo-image-manipulator overlay simulation or direct Text share
        console.log("Triggering expo-image-manipulator overlay logic fallback...");
        let manipModule;
        try {
          manipModule = require("expo-image-manipulator");
        } catch (e) {
          console.warn("expo-image-manipulator not available. Falling back to plain text share.", e);
        }

        if (manipModule && manipModule.manipulateAsync) {
          // If we had a base template local image, we could overlay. Here we simulate image generation.
          console.log("Simulating template manipulation...");
          // Fallback to text share with a premium look
          await Share.share({
            message: `🎓 *ADMIT OS Match Report* 🎓\n\n*Exam:* ${exam.replace("_", " ")}\n*Rank:* ${rank} (Category: ${category})\n*Top Match:* ${branchName} at ${collegeName}\n*Probability:* ${(probability * 100).toFixed(0)}%\n\n_Computed by ADMIT OS Multi-Model Ensemble_`
          });
        } else {
          // Plain Text fallback
          await Share.share({
            message: `ADMIT OS Match Report:\nExam: ${exam}\nRank: ${rank}\nMatch: ${branchName} at ${collegeName} (${(probability * 100).toFixed(0)}% Match)`
          });
        }
      }
    } catch (error: any) {
      if (Platform.OS === "web") {
        alert(error.message || "An error occurred while sharing.");
      } else {
        Alert.alert("Share Failed", error.message || "An error occurred while sharing.");
      }
    } finally {
      setSharing(false);
    }
  };

  return (
    <View className="space-y-4">
      {/* Container to capture */}
      <View 
        ref={viewRef} 
        collapsable={false}
        className="bg-slate-950 border border-emerald-500/30 rounded-3xl p-6 overflow-hidden shadow-2xl relative"
        style={{ minHeight: 320 }}
      >
        {/* Glow effect simulations */}
        <View className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl" />
        <View className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl" />

        {/* Card Header */}
        <View className="flex-row justify-between items-center mb-6">
          <View>
            <Text className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-widest">ADMIT OS WRAPPED</Text>
            <Text className="text-xs text-slate-400 font-bold">2026 Counseling Report</Text>
          </View>
          <View className="bg-emerald-500/20 px-2 py-0.5 rounded">
            <Text className="text-[9px] font-bold text-emerald-400">{exam.replace("_", " ")}</Text>
          </View>
        </View>

        {/* Score & Rank details */}
        <View className="space-y-1 mb-6">
          <Text className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Student Profile</Text>
          <Text className="text-white text-base font-extrabold">AIR Rank: {rank}</Text>
          <Text className="text-slate-400 text-xs font-semibold">Category: {category}</Text>
        </View>

        {/* Big Match Showcase */}
        <View className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-6">
          <Text className="text-[9px] font-bold text-emerald-400 uppercase tracking-wider">Top Admission Match</Text>
          <Text className="text-white text-base font-black mt-1 leading-snug" numberOfLines={2}>
            {collegeName}
          </Text>
          <Text className="text-slate-300 text-xs font-bold mt-0.5" numberOfLines={1}>
            {branchName}
          </Text>
        </View>

        {/* Probability and Footer */}
        <View className="flex-row justify-between items-center mt-auto border-t border-white/5 pt-4">
          <View>
            <Text className="text-[9px] font-bold text-slate-500 uppercase tracking-wider">Probability</Text>
            <Text className="text-emerald-400 text-2xl font-black">{(probability * 100).toFixed(0)}%</Text>
          </View>
          <View className="items-end">
            <Text className="text-[8px] font-bold text-slate-500 uppercase tracking-wider">Verdict</Text>
            <Text className="text-white text-xs font-black uppercase tracking-wider mt-0.5">High Match</Text>
          </View>
        </View>
      </View>

      {/* Share Trigger Button */}
      <Pressable
        disabled={sharing}
        onPress={handleShare}
        className="bg-emerald-500 active:bg-emerald-600 py-3.5 rounded-2xl flex-row items-center justify-center space-x-2 shadow-lg"
      >
        {sharing ? (
          <ActivityIndicator size="small" color="#ffffff" />
        ) : (
          <Text className="text-white font-bold text-xs">Share Match to Spotify Wrapped</Text>
        )}
      </Pressable>
    </View>
  );
}
