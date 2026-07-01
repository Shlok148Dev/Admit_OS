import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Linking,
  ActivityIndicator,
  Clipboard,
  Alert,
  SafeAreaView
} from "react-native";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import Animated, { FadeInUp } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { queryRAGChat, ChatQueryRequest, ChatQueryResponse } from "../../src/lib/api";
import { storage } from "../../src/lib/storage";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  confidence?: "HIGH" | "MEDIUM" | "LOW" | "DECLINED";
  sources?: { title: string; url: string }[];
  timeWarning?: string;
}

export default function ChatScreen() {
  const router = useRouter();
  const scrollViewRef = useRef<ScrollView>(null);
  const [exam, setExam] = useState("JEE_MAIN");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Welcome to ARIA (Admissions & Ranks Intelligence Assistant), the AI counselor inside ADMIT OS. I help students navigate college choices, cutoff trends, and counseling rules across JEE, NEET, MHT-CET, KCET, BITSAT, and 20+ other exams. Ask me any question to get started!",
      timestamp: new Date(),
      confidence: "HIGH",
    },
  ]);
  const [input, setInput] = useState("");

  useEffect(() => {
    try {
      const profileStr = storage.getString("student_profile_v1");
      if (profileStr) {
        const profile = JSON.parse(profileStr);
        if (profile.primary_exam) {
          setExam(profile.primary_exam);
        }
      }
    } catch (e) {
      console.warn("Failed to load profile for chat:", e);
    }
  }, []);

  const chatMutation = useMutation<ChatQueryResponse, Error, ChatQueryRequest>({
    mutationFn: queryRAGChat,
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-${Date.now()}`,
          role: "assistant",
          content: data.answer,
          timestamp: new Date(),
          confidence: data.confidence as any,
          sources: data.sources,
          timeWarning: data.time_warning,
        },
      ]);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 150);
    },
    onError: () => {
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-err-${Date.now()}`,
          role: "assistant",
          content: "Failed to connect to RAG server. Please try again.",
          timestamp: new Date(),
          confidence: "LOW",
        },
      ]);
    },
  });

  const handleSend = () => {
    if (!input.trim() || chatMutation.isPending) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    const history = messages
      .filter((m) => m.id !== "welcome")
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));

    chatMutation.mutate({ message: userMsg.content, history, exam_type: exam });
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 150);
  };

  const handleLongPress = (msg: Message) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Clipboard.setString(msg.content);
    Alert.alert(
      "Message Copied",
      "The message content has been copied to your clipboard.",
      [{ text: "OK" }]
    );
  };

  const renderConfidenceBadge = (confidence?: "HIGH" | "MEDIUM" | "LOW" | "DECLINED") => {
    if (!confidence) return null;
    let colorClass = "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-350 border-emerald-200 dark:border-emerald-900/40";
    let label = "Verified";
    if (confidence === "MEDIUM") {
      colorClass = "bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-350 border-amber-200 dark:border-amber-900/40";
      label = "Cross-Check";
    } else if (confidence === "LOW") {
      colorClass = "bg-slate-50 dark:bg-slate-900/20 text-slate-800 dark:text-slate-300 border-slate-250 dark:border-slate-850/40";
      label = "Disclaimer";
    } else if (confidence === "DECLINED") {
      colorClass = "bg-red-50 dark:bg-red-950/20 text-red-800 dark:text-red-300 border-red-200 dark:border-red-900/40";
      label = "Declined";
    }

    return (
      <View className={`px-2 py-0.5 rounded border ${colorClass} self-start`}>
        <Text className="text-[9px] font-bold uppercase tracking-wider">{label}</Text>
      </View>
    );
  };

  const renderSources = (sources?: { title: string; url: string }[]) => {
    if (!sources || sources.length === 0) return null;
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        className="flex-row mt-1.5 space-x-1.5"
        contentContainerStyle={{ paddingRight: 10 }}
      >
        {sources.map((src, i) => (
          <Pressable
            key={i}
            onPress={() => Linking.openURL(src.url).catch(() => {})}
            className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/40 px-2 py-1 rounded-md flex-row items-center space-x-1"
          >
            <Text className="text-blue-900 dark:text-blue-400 text-[9px] font-bold">{src.title}</Text>
          </Pressable>
        ))}
      </ScrollView>
    );
  };

  const renderMessage = (msg: Message) => {
    const isUser = msg.role === "user";
    
    // Confidence Accent Bar colors
    let accentBarColor = "bg-slate-350 dark:bg-slate-700";
    if (msg.confidence === "HIGH") {
      accentBarColor = "bg-emerald-500";
    } else if (msg.confidence === "MEDIUM") {
      accentBarColor = "bg-amber-500";
    } else if (msg.confidence === "DECLINED") {
      accentBarColor = "bg-rose-500";
    }

    return (
      <Pressable
        key={msg.id}
        onLongPress={() => handleLongPress(msg)}
        className={`mb-3.5 ${isUser ? "self-end items-end" : "self-start items-start"}`}
      >
        {!isUser && (
          <Text className="text-[10px] font-black text-emerald-500 dark:text-[#10B981] mb-1 px-1 tracking-widest">ARIA</Text>
        )}

        <Animated.View
          entering={FadeInUp.duration(300)}
          className={`flex-row items-stretch max-w-[85%] ${
            isUser
              ? "bg-[#007AFF] self-end rounded-2xl rounded-tr-none"
              : "bg-[#E9E9EB] dark:bg-[#262629] self-start rounded-2xl rounded-tl-none"
          }`}
        >
          {/* Vertical Confidence Accent Bar for ARIA messages */}
          {!isUser && (
            <View className={`w-1 rounded-l-2xl ${accentBarColor}`} />
          )}

          <View className="px-4 py-3 flex-1">
            <Text
              className={`text-xs leading-relaxed ${
                isUser ? "text-white font-medium" : "text-[#1C1C1E] dark:text-[#F2F2F7]"
              }`}
            >
              {msg.content}
            </Text>

            {!isUser && (
              <View className="mt-2 space-y-1.5 border-t border-slate-300/40 dark:border-slate-800/40 pt-2">
                {renderConfidenceBadge(msg.confidence)}
                {msg.timeWarning && (
                  <View className="bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 p-1.5 rounded">
                    <Text className="text-rose-900 dark:text-rose-300 text-[9px] font-medium">{msg.timeWarning}</Text>
                  </View>
                )}
                {renderSources(msg.sources)}
              </View>
            )}
          </View>
        </Animated.View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-darkBg">
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        {/* Header */}
        <View className="bg-white dark:bg-darkSurface border-b border-slate-200 dark:border-darkBorder px-5 py-4 flex-row justify-between items-center">
          <Pressable onPress={() => router.back()}>
            <Text className="text-xs font-bold text-slate-500 dark:text-darkMuted">← Back</Text>
          </Pressable>
          <Text className="text-sm font-extrabold text-slate-900 dark:text-darkHeading">ARIA AI Counselor</Text>
          <View className="w-10" />
        </View>

        {/* Messages */}
        <ScrollView
          ref={scrollViewRef}
          className="flex-1 px-5 pt-4"
          contentContainerStyle={{ paddingBottom: 20 }}
        >
          {messages.map(renderMessage)}

          {chatMutation.isPending && (
            <View className="self-start max-w-[80%] mb-3">
              <Text className="text-[10px] font-black text-emerald-500 dark:text-[#10B981] mb-1 px-1 tracking-widest">ARIA</Text>
              <View className="bg-[#E9E9EB] dark:bg-[#262629] rounded-2xl rounded-tl-none p-4 flex-row items-center space-x-2">
                <Text className="text-xs text-slate-500 dark:text-[#8E8E93] font-medium mr-1">ARIA is analyzing...</Text>
                <ActivityIndicator size="small" color="#007AFF" />
              </View>
            </View>
          )}
        </ScrollView>

        {/* Input Form */}
        <View className="bg-white dark:bg-darkSurface border-t border-slate-200 dark:border-darkBorder p-4 flex-row items-center space-x-3">
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={`Ask ARIA about ${exam.replace("_", " ")} cutoffs...`}
            placeholderTextColor="#8E8E93"
            className="flex-1 bg-slate-50 dark:bg-darkSurfaceElevated border border-slate-200 dark:border-darkBorder rounded-xl px-4 py-3 text-xs text-slate-800 dark:text-darkBody"
          />
          <Pressable
            onPress={handleSend}
            disabled={!input.trim() || chatMutation.isPending}
            className={`px-4 py-3.5 rounded-xl justify-center items-center ${
              input.trim() ? "bg-[#007AFF]" : "bg-slate-200 dark:bg-[#262629]"
            }`}
          >
            <Text className={`text-xs font-bold ${input.trim() ? "text-white" : "text-slate-400 dark:text-darkMuted"}`}>
              Send
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
