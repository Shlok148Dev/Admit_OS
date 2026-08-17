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
  School,
  Bot
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

function FormattedMessage({ content }: { content: string }) {
  if (!content) return null;

  const lines = content.split(/\r?\n/);
  const elements: React.ReactNode[] = [];
  let tableBuffer: string[] = [];
  let inTable = false;

  const flushTable = (key: string) => {
    if (tableBuffer.length < 2) {
      elements.push(
        <div key={key} className="whitespace-pre-wrap">
          {tableBuffer.join("\n")}
        </div>
      );
      tableBuffer = [];
      return;
    }

    const headerLine = tableBuffer[0];
    const headers = headerLine
      .split("|")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);

    const bodyLines = tableBuffer.slice(2); // Skip header and separator row

    elements.push(
      <div key={key} className="my-3.5 overflow-x-auto rounded-xl border border-slate-200/90 dark:border-slate-700/70 shadow-sm bg-white dark:bg-slate-900/90">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-100/80 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700/80 text-slate-700 dark:text-slate-200">
              {headers.map((h, idx) => (
                <th key={idx} className="px-4 py-2.5 border-r last:border-r-0 border-slate-200/70 dark:border-slate-700/60 font-bold whitespace-nowrap text-[11px] uppercase tracking-wider text-slate-800 dark:text-slate-200">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
            {bodyLines.map((rowStr, rIdx) => {
              const cells = rowStr
                .split("|")
                .map((c) => c.trim())
                .filter((c) => c.length > 0);
              if (cells.length === 0) return null;
              return (
                <tr
                  key={rIdx}
                  className={`transition-colors ${
                    rIdx % 2 === 0
                      ? "bg-white dark:bg-slate-900/40"
                      : "bg-slate-50/60 dark:bg-slate-800/25"
                  } hover:bg-brand/5 dark:hover:bg-brand/10`}
                >
                  {cells.map((cell, cIdx) => {
                    const isChance = cell.endsWith("%");
                    const isConfidence = cell === "HIGH" || cell === "LOW" || cell === "MEDIUM" || cell === "High" || cell === "Low" || cell === "Medium";
                    return (
                      <td
                        key={cIdx}
                        className={`px-4 py-2.5 border-r last:border-r-0 border-slate-200/50 dark:border-slate-700/40 text-slate-700 dark:text-slate-200 text-xs ${
                          cIdx === 0 ? "font-semibold text-slate-900 dark:text-white" : ""
                        }`}
                      >
                        {isChance ? (
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-tight ${
                              cell === "100%" || parseInt(cell) >= 75
                                ? "bg-emerald-100/90 text-emerald-900 dark:bg-emerald-900/50 dark:text-emerald-200 border border-emerald-400/40"
                                : cell === "0%"
                                ? "bg-rose-100/90 text-rose-900 dark:bg-rose-900/50 dark:text-rose-200 border border-rose-400/40"
                                : "bg-amber-100/90 text-amber-900 dark:bg-amber-900/50 dark:text-amber-200 border border-amber-400/40"
                            }`}
                          >
                            {cell}
                          </span>
                        ) : isConfidence ? (
                          <span
                            className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-md ${
                              cell.toUpperCase() === "HIGH"
                                ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300/40 dark:border-emerald-700/40"
                                : cell.toUpperCase() === "LOW"
                                ? "bg-slate-100 text-slate-700 dark:bg-slate-800/80 dark:text-slate-300 border border-slate-300/50 dark:border-slate-700/50"
                                : "bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-300/40 dark:border-amber-700/40"
                            }`}
                          >
                            {cell}
                          </span>
                        ) : (
                          <span className="font-normal text-slate-800 dark:text-slate-200">{cell}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
    tableBuffer = [];
  };

  const renderInlineMarkdown = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={i} className="font-bold text-slate-900 dark:text-white">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("|") && (trimmed.endsWith("|") || trimmed.includes("|"))) {
      inTable = true;
      tableBuffer.push(trimmed);
    } else {
      if (inTable) {
        flushTable(`table-${index}`);
        inTable = false;
      }
      if (trimmed.startsWith("### ")) {
        elements.push(
          <h4 key={index} className="text-sm font-bold text-slate-900 dark:text-white mt-3 mb-1">
            {renderInlineMarkdown(trimmed.slice(4))}
          </h4>
        );
      } else if (trimmed.startsWith("## ")) {
        elements.push(
          <h3 key={index} className="text-base font-extrabold text-slate-900 dark:text-white mt-3.5 mb-1.5">
            {renderInlineMarkdown(trimmed.slice(3))}
          </h3>
        );
      } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        elements.push(
          <li key={index} className="ml-4 list-disc text-xs md:text-sm text-slate-700 dark:text-slate-300 my-0.5">
            {renderInlineMarkdown(trimmed.slice(2))}
          </li>
        );
      } else if (trimmed.length > 0) {
        elements.push(
          <p key={index} className="my-1.5 text-xs md:text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
            {renderInlineMarkdown(trimmed)}
          </p>
        );
      }
    }
  });

  if (inTable) {
    flushTable("table-end");
  }

  return <div className="space-y-1">{elements}</div>;
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
  const [selectedExam, setSelectedExam] = useState("MHT_CET");
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const latestBotMessageRef = useRef<HTMLDivElement>(null);
  const latestUserMessageRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Smart Anchor Scroll: smoothly align to top of newest assistant response
  useEffect(() => {
    if (messages.length <= 1) return;
    const lastMsg = messages[messages.length - 1];

    if (lastMsg.role === "assistant" && latestBotMessageRef.current) {
      latestBotMessageRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    } else if (lastMsg.role === "user" && latestUserMessageRef.current) {
      latestUserMessageRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [messages.length]);

  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      const scrollH = textareaRef.current.scrollHeight;
      const targetHeight = Math.min(scrollH, 160); // max 6 lines (~160px)
      textareaRef.current.style.height = `${Math.max(targetHeight, 44)}px`;
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    adjustTextareaHeight();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

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

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) {
      setInput("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "44px";
      }
    }

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
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-sm">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
            Verified Official
          </span>
        );
      case "MEDIUM":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-sm">
            <ShieldAlert className="w-3.5 h-3.5 text-amber-500" />
            Cross-Check
          </span>
        );
      case "LOW":
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500/10 text-rose-600 dark:text-rose-450 border border-rose-500/20 shadow-sm">
            <ShieldX className="w-3.5 h-3.5 text-rose-500" />
            Disclaimer
          </span>
        );
    }
  };

  const starterPrompts = [
    {
      label: "🎓 Top Colleges in Pune",
      desc: "Find cutoffs and rankings for top CSE branches in Maharashtra.",
      prompt: "I got 98.4 percentile in MHT-CET, general, Pune. Is COEP CSE possible?",
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
    <div className="flex flex-col h-[calc(100vh-8.5rem)] min-h-[620px] w-full max-w-6xl mx-auto border border-slate-200/80 dark:border-slate-800/80 bg-card rounded-2xl shadow-xl overflow-hidden transition-all">
      {/* Header */}
      <div className="bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="bg-brand text-white p-2.5 rounded-xl shadow-sm">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-foreground text-sm md:text-base tracking-tight">
                ARIA Chat Engine
              </h1>
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-brand/10 text-brand dark:bg-brand/20 border border-brand/20">
                v2.0
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Official RAG Knowledgebase • Strict DPDP Compliance • Deterministic Prediction Matrix
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <select
            aria-label="Select Counseling Exam"
            value={selectedExam}
            onChange={(e) => setSelectedExam(e.target.value)}
            className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-1.5 font-semibold text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand shadow-sm transition-all"
          >
            <option value="MHT_CET">MHT-CET (Maharashtra)</option>
            <option value="JEE_MAIN">JEE Main / JoSAA</option>
            <option value="JEE_ADVANCED">JEE Advanced</option>
            <option value="NEET">NEET-UG</option>
          </select>
          <div className="text-[10px] bg-slate-200/70 dark:bg-slate-800 text-slate-700 dark:text-slate-300 px-3.5 py-1.5 rounded-full font-bold hidden sm:inline-block border border-slate-300/40 dark:border-slate-700/50">
            Active Session
          </div>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/20 dark:bg-slate-950/20 scroll-smooth"
      >
        {messages.map((msg, idx) => {
          const isLatestAssistant = msg.role === "assistant" && idx === messages.length - 1;
          const isLatestUser = msg.role === "user" && idx === messages.length - 1;

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
              ref={isLatestAssistant ? latestBotMessageRef : isLatestUser ? latestUserMessageRef : null}
              className={`flex flex-col space-y-1.5 max-w-[92%] ${
                msg.role === "user" ? "ml-auto items-end" : "mr-auto items-start"
              }`}
            >
              {msg.role === "assistant" && (
                <div className="flex items-center gap-1.5 pl-1.5 mb-0.5">
                  <span className="text-[10px] font-black text-brand uppercase tracking-wider">
                    ARIA
                  </span>
                  {msg.confidence && renderShield(msg.confidence)}
                </div>
              )}

              <div
                className={`rounded-2xl px-6 py-4 text-xs md:text-sm leading-relaxed transition-all shadow-sm ${
                  msg.role === "user"
                    ? "bg-brand text-white rounded-tr-none max-w-2xl whitespace-pre-wrap break-words"
                    : `bg-card border border-slate-200 dark:border-slate-800 text-foreground rounded-tl-none w-full ${confidenceBorder}`
                }`}
              >
                {msg.role === "user" ? (
                  msg.content
                ) : (
                  <FormattedMessage content={msg.content} />
                )}
              </div>

              {msg.role === "assistant" && (
                <div className="flex flex-wrap gap-2 items-center text-[10px] text-muted-foreground pl-1.5 mt-1">
                  {msg.timeWarning && (
                    <span className="inline-flex items-center gap-1 bg-rose-500/10 text-rose-700 dark:text-rose-450 border border-rose-500/20 px-2 py-0.5 rounded text-[9px] font-bold">
                      <Clock className="w-3 h-3 text-rose-500" />
                      {msg.timeWarning}
                    </span>
                  )}

                  {msg.sources && msg.sources.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                      <span className="text-slate-400 dark:text-slate-500 font-semibold text-[10px]">Sources:</span>
                      {msg.sources.map((src, i) => (
                        <a
                          key={i}
                          href={src.url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-brand hover:underline bg-brand/5 dark:bg-brand/10 border border-brand/10 px-2.5 py-0.5 rounded-md text-[10px] font-semibold transition-colors"
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

        {/* Typing Indicator with animated bouncing dots */}
        {chatMutation.isPending && (
          <div className="flex flex-col space-y-1.5 max-w-[80%] mr-auto items-start">
            <span className="text-[10px] font-black text-brand uppercase tracking-wider pl-1.5">
              ARIA
            </span>
            <div className="flex space-x-1.5 px-4 py-3 items-center bg-card border border-slate-200 dark:border-slate-800 rounded-2xl rounded-tl-none shadow-sm">
              <span className="w-2 h-2 bg-brand rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
              <span className="w-2 h-2 bg-brand rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
              <span className="w-2 h-2 bg-brand rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
            </div>
            <span className="text-[9px] text-muted-foreground pl-1.5">Consulting DB cutoffs & guidelines...</span>
          </div>
        )}

        {/* Starter prompts */}
        {messages.length === 1 && !chatMutation.isPending && (
          <div className="pt-6 border-t border-slate-200/60 dark:border-slate-800/60">
            <div className="text-xs font-bold text-muted-foreground mb-3.5 flex items-center gap-1.5">
              <MessageSquare className="w-4 h-4 text-brand" /> Suggested topics to ask ARIA:
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {starterPrompts.map((card, i) => {
                const CardIcon = card.icon;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleSend(card.prompt)}
                    className="p-4 bg-white dark:bg-slate-900/70 hover:bg-slate-50 dark:hover:bg-slate-850/80 border border-slate-200/80 dark:border-slate-800/80 rounded-xl text-left transition-all group flex flex-col justify-between shadow-xs hover:shadow-md hover:border-brand/30"
                  >
                    <div className="flex items-center gap-2.5 mb-2">
                      <div className="p-2 rounded-lg bg-brand/10 text-brand">
                        <CardIcon className="w-4 h-4" />
                      </div>
                      <span className="font-bold text-xs text-foreground group-hover:text-brand transition-colors">
                        {card.label}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {card.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Multi-line Auto-Expanding Input Area */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="p-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 flex items-end gap-3"
      >
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask ARIA about cutoffs, colleges, counseling rules, or branch comparisons... (Enter to send, Shift + Enter for new line)"
            disabled={chatMutation.isPending}
            className="w-full resize-none min-h-[44px] max-h-40 overflow-y-auto whitespace-pre-wrap break-words bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-700/80 rounded-xl px-4 py-2.5 text-xs md:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand transition-all disabled:opacity-60 leading-relaxed"
          />
        </div>
        <button
          type="submit"
          disabled={!input.trim() || chatMutation.isPending}
          className="h-[44px] px-5 bg-brand text-white rounded-xl font-bold text-xs md:text-sm flex items-center justify-center gap-2 hover:bg-brand/90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md shrink-0"
        >
          {chatMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <span>Send</span>
              <Send className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
