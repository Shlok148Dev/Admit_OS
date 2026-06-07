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
} from "react-native";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import Animated, { Keyframe } from "react-native-reanimated";
import { queryRAGChat, ChatQueryRequest, ChatQueryResponse } from "../../src/lib/api";
import { storage } from "../../src/lib/storage";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  confidence?: "HIGH" | "MEDIUM" | "LOW";
  sources?: { title: string; url: string }[];
  timeWarning?: string;
}

const messageEntering = new Keyframe({
  0: {
    opacity: 0,
    transform: [{ translateY: 8 }],
  },
  100: {
    opacity: 1,
    transform: [{ translateY: 0 }],
  },
}).duration(200);

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
          confidence: data.confidence,
          sources: data.sources,
          timeWarning: data.time_warning,
        },
      ]);
      setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
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
        role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content: m.content,
      }));

    chatMutation.mutate({ message: userMsg.content, history, exam_type: exam });
    setTimeout(() => scrollViewRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const renderConfidenceBadge = (confidence?: "HIGH" | "MEDIUM" | "LOW") => {
    if (!confidence) return null;
    let colorClass = "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900/40";
    let label = "Verified";
    if (confidence === "MEDIUM") {
      colorClass = "bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-900/40";
      label = "Cross-Check";
    } else if (confidence === "LOW") {
      colorClass = "bg-red-50 dark:bg-red-950/20 text-red-800 dark:text-red-300 border-red-200 dark:border-red-900/40";
      label = "Declined";
    }

    return (
      <View className={`px-2 py-0.5 rounded border ${colorClass} self-start`}>
        <Text className="text-[9px] font-bold uppercase">{label}</Text>
      </View>
    );
  };

  const renderSources = (sources?: { title: string; url: string }[]) => {
    if (!sources || sources.length === 0) return null;
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row mt-1.5 space-x-1">
        {sources.map((src, i) => (
          <Pressable
            key={i}
            onPress={() => Linking.openURL(src.url).catch(() => {})}
            className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/40 px-2 py-1 rounded-md flex-row items-center space-x-1"
          >
            <Text className="text-blue-900 dark:text-blue-400 text-[9px] font-medium">{src.title}</Text>
          </Pressable>
        ))}
      </ScrollView>
    );
  };

  const renderMessage = (msg: Message) => {
    const isUser = msg.role === "user";
    let borderStyle = "";
    if (!isUser) {
      if (msg.confidence === "HIGH") {
        borderStyle = "border-l-4 border-l-emerald-500";
      } else if (msg.confidence === "MEDIUM") {
        borderStyle = "border-l-4 border-l-amber-500";
      } else {
        borderStyle = "border-l-4 border-l-slate-400";
      }
    }

    return (
      <View key={msg.id} className={`mb-3 ${isUser ? "self-end items-end" : "self-start items-start"}`}>
        {!isUser && (
          <Text className="text-[10px] font-bold text-emerald-500 dark:text-[#10B981] mb-1 px-1">ARIA</Text>
        )}
        <Animated.View
          entering={messageEntering}
          className={`max-w-[85%] rounded-2xl px-4 py-3 ${borderStyle} ${
            isUser
              ? "bg-slate-900 dark:bg-[#1A1A24] self-end rounded-tr-none border border-slate-900 dark:border-[#2A2A38]"
              : "bg-white dark:bg-[#111118] border border-slate-200 dark:border-[#2A2A38] self-start rounded-tl-none"
          }`}
        >
          <Text className={`text-xs leading-relaxed ${isUser ? "text-white dark:text-[#F8FAFC]" : "text-slate-800 dark:text-[#E2E8F0]"}`}>
            {msg.content}
          </Text>

          {!isUser && (
            <View className="mt-2 space-y-1.5">
              {renderConfidenceBadge(msg.confidence)}
              {msg.timeWarning && (
                <View className="bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40 p-1.5 rounded">
                  <Text className="text-rose-900 dark:text-rose-300 text-[9px] font-medium">{msg.timeWarning}</Text>
                </View>
              )}
              {renderSources(msg.sources)}
            </View>
          )}
        </Animated.View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-slate-50 dark:bg-darkBg"
    >
      {/* Header */}
      <View className="bg-white dark:bg-darkSurface border-b border-slate-200 dark:border-darkBorder px-5 py-4 flex-row justify-between items-center">
        <Pressable onPress={() => router.back()}>
          <Text className="text-xs font-bold text-slate-500 dark:text-darkMuted">← Back</Text>
        </Pressable>
        <Text className="text-sm font-extrabold text-slate-900 dark:text-darkHeading">RAG Chat Assistant</Text>
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
            <Text className="text-[10px] font-bold text-emerald-500 dark:text-[#10B981] mb-1 px-1">ARIA</Text>
            <View className="bg-white dark:bg-[#111118] border border-slate-200 dark:border-[#2A2A38] rounded-2xl rounded-tl-none p-4 flex-row items-center space-x-2 opacity-80">
              <Text className="text-xs text-slate-500 dark:text-[#6B7280] font-medium mr-1">ARIA is thinking</Text>
              <ActivityIndicator size="small" color="#10B981" />
            </View>
          </View>
        )}
      </ScrollView>

      {/* Input Form */}
      <View className="bg-white dark:bg-darkSurface border-t border-slate-200 dark:border-darkBorder p-4 flex-row items-center space-x-3">
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ask a cutoff or counselling rule..."
          placeholderTextColor="#6B7280"
          className="flex-1 bg-slate-50 dark:bg-darkSurfaceElevated border border-slate-200 dark:border-darkBorder rounded-xl px-4 py-3 text-xs text-slate-800 dark:text-darkBody focus:border-slate-400 dark:focus:border-slate-700"
        />
        <Pressable
          onPress={handleSend}
          disabled={!input.trim() || chatMutation.isPending}
          className={`px-4 py-3.5 rounded-xl justify-center items-center ${
            input.trim() ? "bg-slate-900 dark:bg-darkBrand" : "bg-slate-200 dark:bg-darkSurfaceElevated"
          }`}
        >
          <Text className={`text-xs font-bold ${input.trim() ? "text-white" : "text-slate-400 dark:text-darkMuted"}`}>
            Send
          </Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}
