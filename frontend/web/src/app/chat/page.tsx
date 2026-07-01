"use client";

import React, { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
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
  School,
  Plus,
  Trash2,
  Lock,
  ChevronLeft,
  ChevronRight,
  UserCheck
} from "lucide-react";
import { queryRAGChat, ChatQueryRequest, ChatQueryResponse } from "@/lib/api";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  confidence?: "HIGH" | "MEDIUM" | "LOW" | "DECLINED";
  sources?: { title: string; url: string }[];
  timeWarning?: string;
}

interface ChatSession {
  id: string;
  title: string;
  timestamp: Date;
  messages: Message[];
  examType: string;
}

export default function ChatPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([
    {
      id: "session-1",
      title: "JoSAA Cutoffs and Options",
      timestamp: new Date(),
      examType: "JEE_MAIN",
      messages: [
        {
          id: "welcome",
          role: "assistant",
          content:
            "Hello! I am ARIA, your post-exam counseling command assistant. I can resolve queries regarding seat allocation rules, state cutoffs, fee matrices, and choice filling schedules. How can I help you navigate your options today?",
          timestamp: new Date(),
          confidence: "HIGH",
          sources: [{ title: "JoSAA Business Rules 2025", url: "https://josaa.nic.in" }],
        },
      ],
    },
    {
      id: "session-2",
      title: "NEET AIQ Counselling Help",
      timestamp: new Date(Date.now() - 3600000 * 2),
      examType: "NEET",
      messages: [
        {
          id: "welcome-neet",
          role: "assistant",
          content:
            "Hello! Ready to discuss NEET UG medical college choices, AIQ vs State quotas, and the MCC Free Exit rules. Ask me anything!",
          timestamp: new Date(Date.now() - 3600000 * 2),
          confidence: "HIGH",
        },
      ],
    },
  ]);

  const [activeSessionId, setActiveSessionId] = useState("session-1");
  const [input, setInput] = useState("");
  const [selectedExam, setSelectedExam] = useState("JEE_MAIN");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];
  const messages = activeSession.messages;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, activeSessionId]);

  const chatMutation = useMutation<ChatQueryResponse, Error, ChatQueryRequest>({
    mutationFn: queryRAGChat,
    onSuccess: (data) => {
      const botMsg: Message = {
        id: `bot-${Date.now()}`,
        role: "assistant",
        content: data.answer,
        timestamp: new Date(),
        confidence: data.confidence as any,
        sources: data.sources,
        timeWarning: data.time_warning,
      };

      setSessions((prev) =>
        prev.map((s) => {
          if (s.id === activeSessionId) {
            return {
              ...s,
              messages: [...s.messages, botMsg],
            };
          }
          return s;
        })
      );
    },
    onError: () => {
      const errMsg: Message = {
        id: `bot-err-${Date.now()}`,
        role: "assistant",
        content: "I encountered an error retrieving that information. Please check your network or try again.",
        timestamp: new Date(),
        confidence: "LOW",
      };

      setSessions((prev) =>
        prev.map((s) => {
          if (s.id === activeSessionId) {
            return {
              ...s,
              messages: [...s.messages, errMsg],
            };
          }
          return s;
        })
      );
    },
  });

  const handleSend = (textToSend?: string) => {
    const text = textToSend || input;
    if (!text.trim() || chatMutation.isPending) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date(),
    };

    // Update session with user message
    let updatedMessages = [...messages, userMsg];
    
    // Auto rename session title if it was default
    const currentTitle = activeSession.title;
    const isDefaultTitle = currentTitle === "New Chat Session" || currentTitle === "JoSAA Cutoffs and Options";
    const newTitle = isDefaultTitle && text.length > 5 ? text.substring(0, 30) + "..." : currentTitle;

    setSessions((prev) =>
      prev.map((s) => {
        if (s.id === activeSessionId) {
          return {
            ...s,
            title: newTitle,
            messages: updatedMessages,
          };
        }
        return s;
      })
    );

    if (!textToSend) setInput("");

    // Build history
    const history = updatedMessages
      .filter((m) => m.id !== "welcome" && m.id !== "welcome-neet")
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));

    chatMutation.mutate({
      message: text,
      history,
      exam_type: selectedExam,
    });
  };

  const handleNewChat = () => {
    const newId = `session-${Date.now()}`;
    const newSess: ChatSession = {
      id: newId,
      title: "New Chat Session",
      timestamp: new Date(),
      examType: selectedExam,
      messages: [
        {
          id: `welcome-${Date.now()}`,
          role: "assistant",
          content: `Hi, I am ARIA, senior admissions counselor. Let's research options for ${selectedExam.replace("_", " ")} counseling.`,
          timestamp: new Date(),
          confidence: "HIGH",
        },
      ],
    };

    setSessions((prev) => [newSess, ...prev]);
    setActiveSessionId(newId);
  };

  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (sessions.length === 1) return;
    const filtered = sessions.filter((s) => s.id !== id);
    setSessions(filtered);
    if (activeSessionId === id) {
      setActiveSessionId(filtered[0].id);
    }
  };

  const renderShield = (confidence: "HIGH" | "MEDIUM" | "LOW" | "DECLINED") => {
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
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/20 shadow-sm">
            <ShieldX className="w-3 h-3" />
            Disclaimer
          </span>
        );
      case "DECLINED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-rose-500/10 text-rose-600 dark:text-rose-450 border border-rose-500/20 shadow-sm">
            <ShieldX className="w-3 h-3" />
            Declined
          </span>
        );
    }
  };

  const starterPrompts = [
    {
      label: "🎓 Top NITs for CSE",
      desc: "Find cutoffs and rankings for top CSE branches.",
      prompt: "What were the round 6 closing ranks for Computer Science and Engineering at NIT Surathkal, Warangal, and Calicut last year?",
      icon: School,
    },
    {
      label: "📜 JoSAA Float vs Slide",
      desc: "Clear explanations of seat willingness rules.",
      prompt: "Explain how Freeze, Float, and Slide work in JoSAA, and what happens if I do not upload documents in Round 1.",
      icon: BookOpen,
    },
    {
      label: "🏥 NEET Free Exit",
      desc: "Understand safety deposits for MCC rounds.",
      prompt: "Explain MCC rules for a 'Free Exit' in Round 1 of NEET-UG counseling, and when safety deposit is forfeited.",
      icon: HelpCircle,
    },
    {
      label: "📈 State Cutoff Shifts",
      desc: "Check merit trends for CAP state quotas.",
      prompt: "How have cutoff ranks drifted for COEP Pune and VJTI Mumbai CSE branches under the cap rounds over the last 3 years?",
      icon: TrendingUp,
    },
  ];

  return (
    <div className="flex h-[calc(100vh-8rem)] max-w-6xl mx-auto border border-slate-200 dark:border-slate-800/40 bg-card rounded-xl shadow-sm overflow-hidden">
      
      {/* Claude-like Sidebar */}
      <AnimatePresence initial={false}>
        {sidebarOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 260, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="h-full bg-slate-900 text-slate-200 flex flex-col flex-shrink-0 border-r border-slate-800"
          >
            {/* New Chat Button */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <button
                onClick={handleNewChat}
                className="flex items-center gap-2 px-3 py-2 bg-brand text-white rounded-lg text-xs font-bold w-full hover:bg-brand/90 transition-all shadow-sm"
              >
                <Plus className="w-4 h-4" />
                New Chat
              </button>
            </div>

            {/* Sessions List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              <div className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500 px-2 mb-2">
                Recent Conversations
              </div>
              {sessions.map((sess) => {
                const isActive = sess.id === activeSessionId;
                return (
                  <button
                    key={sess.id}
                    onClick={() => setActiveSessionId(sess.id)}
                    className={`flex items-center justify-between w-full px-3 py-2 rounded-lg text-left text-xs transition-all group ${
                      isActive
                        ? "bg-slate-800 text-white font-bold"
                        : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-250"
                    }`}
                  >
                    <div className="flex items-center gap-2 overflow-hidden mr-2">
                      <MessageSquare className="w-4 h-4 flex-shrink-0 text-slate-500" />
                      <span className="truncate">{sess.title}</span>
                    </div>
                    {sessions.length > 1 && (
                      <Trash2
                        onClick={(e) => handleDeleteSession(sess.id, e)}
                        className="w-3.5 h-3.5 text-slate-500 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* DPDP Compliance & Brand */}
            <div className="p-4 border-t border-slate-800 space-y-2.5">
              <div className="flex items-center gap-2 text-[10px] text-slate-400">
                <Lock className="w-3.5 h-3.5 text-emerald-500" />
                <span>DPDP Act 2023 Compliant</span>
              </div>
              <div className="flex items-center gap-2 text-[10px] text-slate-400">
                <UserCheck className="w-3.5 h-3.5 text-brand" />
                <span>Secure Student Profile PII</span>
              </div>
              <div className="text-[9px] text-slate-600 font-extrabold border-t border-slate-800/80 pt-2">
                ADMIT OS • AI COUNSELING ENGINE v2.0
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Chat Interface */}
      <div className="flex-1 flex flex-col h-full bg-slate-50/10 dark:bg-slate-950/10 relative">
        
        {/* Toggle Sidebar Button */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute left-4 top-4 z-10 p-2 bg-card hover:bg-slate-100 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-slate-500 transition-colors"
        >
          {sidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        {/* Chat Header */}
        <div className="bg-card border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between pl-16">
          <div className="flex items-center gap-3">
            <div className="bg-brand text-white p-2 rounded-lg">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h1 className="font-extrabold text-foreground text-sm md:text-base flex items-center gap-2">
                ARIA Senior Counselor
                <span className="text-[10px] bg-brand/10 text-brand px-2 py-0.5 rounded font-black">AI</span>
              </h1>
              <p className="text-[10px] text-muted-foreground">
                Admissions & Rank Intelligent Assistant • Post-Exam Advisory
              </p>
            </div>
          </div>
          <div className="text-[10px] bg-slate-200/60 dark:bg-slate-850 text-slate-700 dark:text-slate-350 px-3 py-1 rounded-full font-bold">
            {selectedExam.replace("_", " ")}
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <AnimatePresence initial={false}>
            {messages.map((msg) => {
              const isAssistant = msg.role === "assistant";
              
              // Confidence borders mapping
              let confidenceBorder = "";
              if (isAssistant) {
                if (msg.confidence === "HIGH") {
                  confidenceBorder = "border-l-4 border-l-emerald-500 dark:border-l-emerald-400";
                } else if (msg.confidence === "MEDIUM") {
                  confidenceBorder = "border-l-4 border-l-amber-500 dark:border-l-amber-400";
                } else if (msg.confidence === "DECLINED") {
                  confidenceBorder = "border-l-4 border-l-rose-500 dark:border-l-rose-400";
                } else {
                  confidenceBorder = "border-l-4 border-l-slate-400 dark:border-l-slate-650";
                }
              }

              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className={`flex flex-col space-y-1 max-w-[85%] ${
                    msg.role === "user" ? "ml-auto items-end" : "mr-auto items-start"
                  }`}
                >
                  {isAssistant && (
                    <span className="text-[10px] font-black text-brand uppercase tracking-wider pl-1.5 mb-0.5">
                      ARIA
                    </span>
                  )}

                  <div
                    className={`rounded-2xl px-5 py-3 text-xs md:text-sm leading-relaxed transition-all shadow-sm ${
                      msg.role === "user"
                        ? "bg-brand text-white rounded-tr-none"
                        : `bg-card border border-slate-200 dark:border-slate-850 text-foreground rounded-tl-none ${confidenceBorder}`
                    }`}
                  >
                    {msg.content}
                  </div>

                  {isAssistant && (
                    <div className="flex flex-wrap gap-2 items-center text-[10px] text-muted-foreground pl-1.5 mt-0.5">
                      {msg.confidence && renderShield(msg.confidence)}

                      {msg.timeWarning && (
                        <span className="inline-flex items-center gap-1 bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 px-2 py-0.5 rounded text-[9px] font-bold">
                          <Clock className="w-3 h-3 text-rose-550" />
                          {msg.timeWarning}
                        </span>
                      )}

                      {msg.sources && msg.sources.length > 0 && (
                        <div className="flex items-center gap-1 flex-wrap">
                          <span className="text-slate-400 dark:text-slate-500">Sources:</span>
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
                </motion.div>
              );
            })}

            {/* Typing Indicator */}
            {chatMutation.isPending && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col space-y-1.5 max-w-[80%] mr-auto items-start"
              >
                <span className="text-[10px] font-black text-brand uppercase tracking-wider pl-1.5">
                  ARIA
                </span>
                <div className="flex space-x-1.5 px-4 py-3 items-center bg-card border border-slate-200 dark:border-slate-850 rounded-2xl rounded-tl-none shadow-sm">
                  <span className="w-2 h-2 bg-brand rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                  <span className="w-2 h-2 bg-brand rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                  <span className="w-2 h-2 bg-brand rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                </div>
                <span className="text-[9px] text-muted-foreground pl-1.5 animate-pulse">
                  ARIA is analyzing official guidelines & verification records...
                </span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Starters Grid */}
          {messages.length <= 1 && !chatMutation.isPending && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="pt-6 border-t border-slate-200/50 dark:border-slate-800/40"
            >
              <div className="text-xs font-bold text-muted-foreground mb-3 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-brand" /> Suggested starting prompts:
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
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="p-4 border-t border-slate-200 dark:border-slate-800 flex gap-3.5 items-center bg-card"
        >
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
            placeholder={`Ask ARIA about ${selectedExam.replace("_", " ")} guidelines, cutoffs or rules...`}
            className="flex-1 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-855 rounded-lg px-4 py-2.5 text-xs md:text-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent placeholder-slate-400 dark:placeholder-slate-605 text-foreground"
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
    </div>
  );
}
