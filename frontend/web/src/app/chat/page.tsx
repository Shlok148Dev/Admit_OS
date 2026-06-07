"use client";

import React, { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Send,
  Loader2,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  Clock,
  ExternalLink,
  MessageSquare,
  Sparkles,
  BookOpen,
  HelpCircle,
  TrendingUp,
  School
} from "lucide-react";
import { queryRAGChat, ChatQueryRequest, ChatQueryResponse } from "@/lib/api";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  confidence?: "HIGH" | "MEDIUM" | "LOW";
  sources?: { title: string; url: string }[];
  timeWarning?: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hello! I am ARIA, your post-exam counseling command assistant. I can resolve queries regarding seat allocation rules, state cutoffs, fee matrices, and choice filling schedules. How can I help you navigate your options today?",
      timestamp: new Date(),
      confidence: "HIGH",
      sources: [{ title: "JoSAA Business Rules 2025", url: "https://josaa.nic.in" }],
    },
  ]);
  const [input, setInput] = useState("");
  const [selectedExam, setSelectedExam] = useState("JEE_MAIN");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const chatMutation = useMutation<
    ChatQueryResponse,
    Error,
    ChatQueryRequest
  >({
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
    },
    onError: () => {
      setMessages((prev) => [
        ...prev,
        {
          id: `bot-err-${Date.now()}`,
          role: "assistant",
          content:
            "I encountered an error retrieving that information. Please check your network or try again.",
          timestamp: new Date(),
          confidence: "LOW",
        },
      ]);
    },
  });

  const handleSend = (textToSend?: string) => {
    const text = textToSend || input;
    if (!text.trim() || chatMutation.isPending) return;

    // Add user message
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setInput("");

    // Prepare API history format
    const history = messages
      .filter((m) => m.id !== "welcome")
      .map((m) => ({
        role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content: m.content,
      }));

    chatMutation.mutate({
      message: text,
      history,
      exam_type: selectedExam,
    });
  };

  const renderShield = (confidence: "HIGH" | "MEDIUM" | "LOW") => {
    switch (confidence) {
      case "HIGH":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-sm">
            <ShieldCheck className="w-3 h-3" />
            Verified
          </span>
        );
      case "MEDIUM":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-sm">
            <ShieldAlert className="w-3 h-3" />
            Cross-Check
          </span>
        );
      case "LOW":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-rose-500/10 text-rose-600 dark:text-rose-450 border border-rose-500/20 shadow-sm">
            <ShieldX className="w-3 h-3" />
            Disclaimer
          </span>
        );
    }
  };

  // 4 starter prompt cards with icons and descriptions
  const starterPrompts = [
    {
      label: "🎓 Top NITs for CSE",
      desc: "Find cutoffs and rankings for top CSE branches.",
      prompt: "What were the round 6 closing ranks for Computer Science and Engineering at NIT Surathkal, Warangal, and Calicut last year?",
      icon: School
    },
    {
      label: "📜 JoSAA Float vs Slide",
      desc: "Clear explanations of seat willingness rules.",
      prompt: "Explain how Freeze, Float, and Slide work in JoSAA, and what happens if I do not upload documents in Round 1.",
      icon: BookOpen
    },
    {
      label: "🏥 NEET Free Exit",
      desc: "Understand safety deposits for MCC rounds.",
      prompt: "Explain MCC rules for a 'Free Exit' in Round 1 of NEET-UG counseling, and when safety deposit is forfeited.",
      icon: HelpCircle
    },
    {
      label: "📈 State Cutoff Shifts",
      desc: "Check merit trends for CAP state quotas.",
      prompt: "How have cutoff ranks drifted for COEP Pune and VJTI Mumbai CSE branches under the cap rounds over the last 3 years?",
      icon: TrendingUp
    }
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-10rem)] max-w-4xl mx-auto border border-slate-205 dark:border-slate-800/40 bg-card rounded-xl shadow-sm overflow-hidden">
      {/* Rebranded Chat Header */}
      <div className="bg-slate-50/70 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-brand text-white p-2 rounded-lg">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h1 className="font-extrabold text-foreground text-sm md:text-base">
              ARIA Chat Engine
            </h1>
            <p className="text-[10px] text-muted-foreground">
              Official RAG Knowledgebase • Strict DPDP Compliance
            </p>
          </div>
        </div>
        <div className="text-[10px] bg-slate-200/60 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-3 py-1 rounded-full font-bold">
          Active Session
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/10 dark:bg-slate-950/10">
        {messages.map((msg) => {
          // Confidence border classes mapping
          let confidenceBorder = "";
          if (msg.role === "assistant") {
            if (msg.confidence === "HIGH") {
              confidenceBorder = "border-l-4 border-l-emerald-500 dark:border-l-emerald-400";
            } else if (msg.confidence === "MEDIUM") {
              confidenceBorder = "border-l-4 border-l-amber-500 dark:border-l-amber-400";
            } else {
              confidenceBorder = "border-l-4 border-l-slate-400 dark:border-l-slate-600";
            }
          }

          return (
            <div
              key={msg.id}
              className={`flex flex-col space-y-1 max-w-[85%] ${
                msg.role === "user" ? "ml-auto items-end" : "mr-auto items-start"
              }`}
            >
              {/* Role Label above assistant response */}
              {msg.role === "assistant" && (
                <span className="text-[10px] font-black text-brand uppercase tracking-wider pl-1.5 mb-0.5">
                  ARIA
                </span>
              )}

              {/* Message bubble */}
              <div
                className={`rounded-2xl px-5 py-3 text-xs md:text-sm leading-relaxed transition-all shadow-sm ${
                  msg.role === "user"
                    ? "bg-brand text-white rounded-tr-none"
                    : `bg-card border border-slate-200 dark:border-slate-850 text-foreground rounded-tl-none ${confidenceBorder}`
                }`}
              >
                {msg.content}
              </div>

              {/* Meta information (Sources, Warning details) */}
              {msg.role === "assistant" && (
                <div className="flex flex-wrap gap-2 items-center text-[10px] text-muted-foreground pl-1.5 mt-0.5">
                  {msg.confidence && renderShield(msg.confidence)}

                  {msg.timeWarning && (
                    <span className="inline-flex items-center gap-1 bg-rose-500/10 text-rose-700 dark:text-rose-450 border border-rose-500/20 px-2 py-0.5 rounded text-[9px] font-bold">
                      <Clock className="w-3 h-3 text-rose-500" />
                      {msg.timeWarning}
                    </span>
                  )}

                  {msg.sources && msg.sources.length > 0 && (
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="text-slate-405 dark:text-slate-500">Sources:</span>
                      {msg.sources.map((src, i) => (
                        <a
                          key={i}
                          href={src.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-0.5 text-brand hover:underline bg-brand/5 dark:bg-brand/10 border border-brand/10 px-2 py-0.5 rounded text-[9px] font-bold transition-colors"
                        >
                          {src.title}
                          <ExternalLink className="w-2.5 h-2.5 text-brand" />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Typing Indicator with 3 animated bouncing dots */}
        {chatMutation.isPending && (
          <div className="flex flex-col space-y-1.5 max-w-[80%] mr-auto items-start">
            <span className="text-[10px] font-black text-brand uppercase tracking-wider pl-1.5">
              ARIA
            </span>
            <div className="flex space-x-1.5 px-4 py-3 items-center bg-card border border-slate-200 dark:border-slate-850 rounded-2xl rounded-tl-none shadow-sm">
              <span className="w-2 h-2 bg-brand rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
              <span className="w-2 h-2 bg-brand rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
              <span className="w-2 h-2 bg-brand rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
            </div>
            <span className="text-[9px] text-muted-foreground pl-1.5">Searching DB & verification records...</span>
          </div>
        )}

        {/* 4 Starter prompts (shown only at start of active session) */}
        {messages.length === 1 && !chatMutation.isPending && (
          <div className="pt-4 border-t border-slate-200/50 dark:border-slate-800/40">
            <div className="text-xs font-bold text-muted-foreground mb-3 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-brand" /> Suggestive prompts to start:
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {starterPrompts.map((card, i) => {
                const CardIcon = card.icon;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSend(card.prompt)}
                    className="flex items-start gap-3 text-left p-3.5 bg-card hover:bg-slate-50 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl transition-all shadow-sm group hover:border-brand/40"
                  >
                    <div className="p-2 rounded-lg bg-brand/10 text-brand group-hover:bg-brand group-hover:text-white transition-all flex-shrink-0">
                      <CardIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-extrabold text-foreground">{card.label}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">{card.desc}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Form with Exam chip */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="p-4 border-t border-slate-200 dark:border-slate-800 flex gap-3.5 items-center bg-card"
      >
        {/* Dropdown exam context chip */}
        <select
          value={selectedExam}
          onChange={(e) => setSelectedExam(e.target.value)}
          className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg px-2.5 py-2.5 text-xs font-black text-foreground focus:outline-none cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
        >
          <option value="JEE_MAIN">JEE Main</option>
          <option value="JEE_ADVANCED">JEE Adv</option>
          <option value="NEET">NEET UG</option>
          <option value="MHT_CET">MHT-CET</option>
          <option value="KCET">KCET</option>
        </select>

        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Ask ARIA about ${selectedExam.replace("_", " ")} guidelines, cutoffs or counseling rules...`}
          className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-850 rounded-lg px-4 py-2.5 text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent placeholder-slate-400 dark:placeholder-slate-600 text-foreground"
          disabled={chatMutation.isPending}
        />
        
        <button
          type="submit"
          disabled={!input.trim() || chatMutation.isPending}
          className="bg-brand hover:bg-brand/90 disabled:bg-slate-100 dark:disabled:bg-slate-800 text-white disabled:text-slate-400 p-2.5 rounded-lg shadow-sm transition-all flex items-center justify-center flex-shrink-0"
        >
          {chatMutation.isPending ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </button>
      </form>
    </div>
  );
}
