"use client";

import React, { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { 
  predictColleges, 
  optimizeChoices, 
  simulateWhatIf, 
  getCounselingRules,
  Prediction,
  ChoiceItem,
  PredictionRequest
} from "@/lib/api";
import { 
  Compass, 
  Sliders, 
  AlertCircle, 
  Download, 
  ArrowUpDown, 
  RotateCcw, 
  Trash2, 
  SlidersHorizontal,
  ChevronRight,
  ShieldAlert,
  Sparkles
} from "lucide-react";
import { jsPDF } from "jspdf";
import { motion, AnimatePresence } from "framer-motion";
import {
  DndContext,
  closestCenter,
  useSensor,
  useSensors,
  PointerSensor,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Reusable CountUp component for animating probability percentages
function CountUp({ value, duration = 800 }: { value: number; duration?: number }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime: number | null = null;
    const startCount = 0;
    let frameId: number;
    
    const animateCount = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setCount(Math.floor(progress * (value - startCount) + startCount));
      if (progress < 1) {
        frameId = requestAnimationFrame(animateCount);
      }
    };

    frameId = requestAnimationFrame(animateCount);
    return () => cancelAnimationFrame(frameId);
  }, [value, duration]);

  return <span>{count}%</span>;
}

// Sortable Row Component for choice filling reordering list
function SortableChoiceRow({
  choice,
  index,
  removeChoice,
  isDeltaOpen,
  toggleDelta,
  rankDeltaValue,
  onRankDeltaChange,
}: {
  choice: ChoiceItem;
  index: number;
  removeChoice: (idx: number) => void;
  isDeltaOpen: boolean;
  toggleDelta: () => void;
  rankDeltaValue: number;
  onRankDeltaChange: (val: number) => void;
}) {
  const rowKey = `${choice.college_code}-${choice.branch_code}-${index}`;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: rowKey });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  const prob = choice.admission_probability;
  
  // Custom rank-shift probability delta logic (e.g. positive delta adds probability)
  const adjustedProbability = Math.max(0.01, Math.min(0.99, prob + (rankDeltaValue / 10000)));

  // Badge mapping
  let badgeText = "REACH";
  let badgeStyles = "border-reach bg-reach/10 text-reach";
  if (adjustedProbability > 0.70) {
    badgeText = "SAFE";
    badgeStyles = "border-safe bg-safe/10 text-safe";
  } else if (adjustedProbability >= 0.40) {
    badgeText = "TARGET";
    badgeStyles = "border-target bg-target/10 text-target";
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`border rounded-xl bg-card overflow-hidden transition-colors ${
        isDragging 
          ? "border-brand bg-brand/5 shadow-lg opacity-85 scale-[1.01]" 
          : "border-slate-200 dark:border-slate-800/80 shadow-sm"
      }`}
    >
      <div className="flex flex-col md:flex-row items-start md:items-center p-4 gap-4">
        {/* Reordering drag-handle */}
        <div className="flex items-center gap-3">
          <div 
            {...attributes} 
            {...listeners} 
            className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-200 p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
          >
            <ArrowUpDown className="w-4 h-4" />
          </div>
          <span className="font-mono font-black text-slate-400 text-sm">
            #{choice.choice_number}
          </span>
        </div>

        {/* Course Details */}
        <div className="flex-1 min-w-0">
          <h4 className="font-extrabold text-foreground text-sm truncate" title={choice.college_name}>
            {choice.college_name}
          </h4>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground font-semibold">
            <span>{choice.branch_name} ({choice.branch_code})</span>
            <span className="bg-slate-100 dark:bg-slate-800 border dark:border-slate-700/60 px-1.5 py-0.5 rounded font-mono text-[9px] uppercase text-foreground">
              {choice.quota}
            </span>
          </div>
          <p className="text-[10px] text-slate-450 dark:text-slate-405 italic mt-1 leading-snug">
            {choice.reason}
          </p>
        </div>

        {/* Dynamic Badges and Fees details */}
        <div className="flex items-center gap-4 self-end md:self-center">
          {/* Probability Badge */}
          <div className="text-right">
            <span className={`inline-block border px-2 py-0.5 rounded text-[9px] font-black tracking-wider uppercase ${badgeStyles}`}>
              {badgeText}
            </span>
            <div className="text-xs font-mono font-extrabold text-foreground mt-1">
              <CountUp value={Math.round(adjustedProbability * 100)} />
            </div>
          </div>

          {/* Fee Tag */}
          <div className="text-right min-w-[70px]">
            <span className="text-[9px] text-muted-foreground uppercase font-bold">Fees</span>
            <div className="text-xs font-bold text-foreground">
              ₹{choice.fees_per_year.toLocaleString("en-IN")}/yr
            </div>
          </div>

          {/* Action Tools */}
          <div className="flex items-center gap-1.5">
            {/* ⟳ symbol is used for what-if trigger */}
            <button
              type="button"
              onClick={toggleDelta}
              className={`p-1.5 rounded transition-all ${
                isDeltaOpen
                  ? "bg-brand/20 text-brand border border-brand/40"
                  : "text-slate-400 hover:text-brand hover:bg-slate-100 dark:hover:bg-slate-900"
              }`}
              title="Inline What-If Simulator"
            >
              <RotateCcw className="w-4 h-4 rotate-180" />
            </button>
            <button
              type="button"
              onClick={() => removeChoice(index)}
              className="p-1.5 rounded text-rose-500 hover:text-rose-700 hover:bg-rose-500/10 transition-colors"
              title="Remove Choice"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Inline Delta Slider panel */}
      <AnimatePresence>
        {isDeltaOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-slate-200 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-900/30 px-4 py-3"
          >
            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-400">Inline What-If Rank Shift:</span>
                <span className={`font-mono font-extrabold ${rankDeltaValue > 0 ? "text-emerald-500" : rankDeltaValue < 0 ? "text-rose-500" : "text-slate-400"}`}>
                  {rankDeltaValue > 0 ? "+" : ""}{rankDeltaValue} ranks
                </span>
              </div>
              <input
                type="range"
                min="-5000"
                max="5000"
                step="250"
                value={rankDeltaValue}
                onChange={(e) => onRankDeltaChange(parseInt(e.target.value))}
                className="w-full h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-brand"
              />
              <p className="text-[10px] text-slate-500 leading-snug">
                Adjust this slider to simulate how closing threshold variations impact this college allocation.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function CounselingCompassPage() {
  const [exam, setExam] = useState("JEE_MAIN");
  const [rank, setRank] = useState<number>(12500);
  const [category, setCategory] = useState("GENERAL");
  const [homeState, setHomeState] = useState("MH");
  const [gender, setGender] = useState("M");

  // Redesigned Preference Card active item
  const [activePriority, setActivePriority] = useState<"brand" | "branch" | "location">("branch");

  // Preference weights state
  const [weights, setWeights] = useState({
    branch: 0.4,
    brand: 0.3,
    location: 0.2,
    fees: 0.1
  });

  const [riskAppetite, setRiskAppetite] = useState<"AGGRESSIVE" | "BALANCED" | "CONSERVATIVE">("BALANCED");
  
  const [candidateColleges, setCandidateColleges] = useState<Prediction[]>([]);
  const [choices, setChoices] = useState<ChoiceItem[]>([]);
  const [optimizedExplanation, setOptimizedExplanation] = useState("");
  const [riskScore, setRiskScore] = useState(50);
  
  const [isWhatIfOpen, setIsWhatIfOpen] = useState(false);
  const [seatMatrixChange, setSeatMatrixChange] = useState(0.0);
  const [cutoffDrift, setCutoffDrift] = useState(0.0);

  // States for row specific What-If rank shifts
  const [openDeltaRow, setOpenDeltaRow] = useState<string | null>(null);
  const [rankDeltas, setRankDeltas] = useState<Record<string, number>>({});

  // Setup sensors for pointer events
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const { data: rulesList = [] } = useQuery<string[]>({
    queryKey: ["counseling-rules", exam],
    queryFn: () => getCounselingRules(exam),
  });

  const predictMutation = useMutation({
    mutationFn: predictColleges,
    onSuccess: (data) => {
      setCandidateColleges(data.predictions.slice(0, 15));
    }
  });

  const optimizeMutation = useMutation({
    mutationFn: optimizeChoices,
    onSuccess: (data) => {
      setChoices(data.optimized_choices || []);
      setOptimizedExplanation(data.explanation || "");
      setRiskScore(data.risk_score || 50);
    }
  });

  useEffect(() => {
    predictMutation.mutate({
      exam,
      rank,
      percentile: null,
      category,
      home_state: homeState,
      gender,
      year: 2026
    });
  }, [exam, rank, category, homeState, gender]);

  const triggerOptimization = () => {
    if (candidateColleges.length === 0) return;
    optimizeMutation.mutate({
      session_id: "counsel-session-1",
      student_profile: { exam, rank, category, home_state: homeState, gender },
      preferences: {
        branch_priority: weights.branch,
        college_tier_priority: weights.brand,
        location_priority: weights.location,
        fees_priority: weights.fees
      },
      candidate_colleges: candidateColleges,
      risk_appetite: riskAppetite
    });
  };

  useEffect(() => {
    triggerOptimization();
  }, [weights, riskAppetite, candidateColleges]);

  // Handle conversational preference card selection
  const selectPriority = (prio: "brand" | "branch" | "location") => {
    setActivePriority(prio);
    if (prio === "brand") {
      setWeights({ brand: 0.65, branch: 0.15, location: 0.15, fees: 0.05 });
    } else if (prio === "branch") {
      setWeights({ brand: 0.15, branch: 0.65, location: 0.15, fees: 0.05 });
    } else if (prio === "location") {
      setWeights({ brand: 0.15, branch: 0.15, location: 0.65, fees: 0.05 });
    }
  };

  const runWhatIfSimulation = async () => {
    try {
      const simRes = await simulateWhatIf({
        exam,
        rank,
        category,
        home_state: homeState,
        gender,
        preferences: {
          branch_priority: weights.branch,
          college_tier_priority: weights.brand,
          location_priority: weights.location,
          fees_priority: weights.fees
        },
        seat_matrix_change: seatMatrixChange,
        cutoff_drift: cutoffDrift,
        risk_appetite: riskAppetite
      });
      
      setCandidateColleges(simRes.predictions.slice(0, 15));
      setIsWhatIfOpen(false);
    } catch (e) {
      console.error(e);
    }
  };

  // Drag and Drop End handler
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeIndex = choices.findIndex((c, idx) => `${c.college_code}-${c.branch_code}-${idx}` === active.id);
    const overIndex = choices.findIndex((c, idx) => `${c.college_code}-${c.branch_code}-${idx}` === over.id);

    if (activeIndex !== -1 && overIndex !== -1) {
      const reordered = arrayMove(choices, activeIndex, overIndex);
      const reindexed = reordered.map((item, idx) => ({
        ...item,
        choice_number: idx + 1
      }));
      setChoices(reindexed);
    }
  };

  const removeChoice = (index: number) => {
    const filtered = choices.filter((_, idx) => idx !== index);
    const reindexed = filtered.map((item, idx) => ({
      ...item,
      choice_number: idx + 1
    }));
    setChoices(reindexed);
  };

  // Fetch metadata details for Exam Context Banner
  const getExamBannerData = (examCode: string) => {
    switch (examCode) {
      case "JEE_MAIN":
        return { examName: "JEE Main", counselingBody: "JoSAA / CSAB", daysUntil: 12 };
      case "JEE_ADVANCED":
        return { examName: "JEE Advanced", counselingBody: "JoSAA", daysUntil: 12 };
      case "NEET":
        return { examName: "NEET UG", counselingBody: "MCC / State Bodies", daysUntil: 18 };
      case "MHT_CET":
        return { examName: "MHT-CET", counselingBody: "State CAP", daysUntil: 24 };
      case "KCET":
        return { examName: "KCET", counselingBody: "KEA", daysUntil: 20 };
      default:
        return { examName: "JEE Main", counselingBody: "JoSAA", daysUntil: 12 };
    }
  };

  const bannerInfo = getExamBannerData(exam);

  const exportChoiceListPDF = () => {
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(15, 23, 42);
    doc.text("ADMIT OS Choice Compass Report", 14, 20);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 27);
    doc.text(`AIR Rank: ${rank} | Exam: ${exam.replace("_", " ")} | Category: ${category} | Home State: ${homeState}`, 14, 32);
    
    doc.setDrawColor(226, 232, 240);
    doc.line(14, 36, 196, 36);
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text("Candidate Choice Filling Schedule", 14, 46);
    
    let y = 55;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Choice No.", 14, y);
    doc.text("Institute Details", 35, y);
    doc.text("Quota", 125, y);
    doc.text("Probability", 145, y);
    doc.text("Est. Fees", 175, y);
    
    doc.line(14, y + 2, 196, y + 2);
    y += 8;
    
    doc.setFont("helvetica", "normal");
    choices.forEach((c) => {
      if (y > 260) {
        doc.addPage();
        y = 20;
      }
      doc.setFont("helvetica", "bold");
      doc.text(`${c.choice_number}`, 14, y);
      doc.setFont("helvetica", "normal");
      
      const splitCollege = doc.splitTextToSize(c.college_name, 80);
      doc.text(splitCollege, 35, y);
      doc.text(`${c.branch_name} (${c.branch_code})`, 35, y + (splitCollege.length * 4));
      
      doc.text(c.quota, 125, y);
      doc.text(`${Math.round(c.admission_probability * 100)}%`, 145, y);
      doc.text(`Rs. ${c.fees_per_year.toLocaleString("en-IN")}/yr`, 175, y);
      
      const lineOffset = (splitCollege.length * 4) + 6;
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      const splitReason = doc.splitTextToSize(`Agent Verification Rationale: ${c.reason}`, 155);
      doc.text(splitReason, 35, y + lineOffset);
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      
      y += lineOffset + (splitReason.length * 3.5) + 5;
    });
    
    if (y > 230) {
      doc.addPage();
      y = 20;
    }
    doc.line(14, y, 196, y);
    y += 8;
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.text("Applicable Allotment Rules Checkpoint:", 14, y);
    y += 6;
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    rulesList.slice(0, 4).forEach((rule) => {
      const splitRule = doc.splitTextToSize(`• ${rule}`, 180);
      doc.text(splitRule, 14, y);
      y += (splitRule.length * 3.8) + 2;
    });
    
    y += 6;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text("Compliance Notice: All student inputs are processed anonymously under DPDP Act 2023 guidelines.", 14, y);
    doc.text("Disclaimer: ADMIT OS predicts admission rates via multi-model bootstrapping. Ensure official site verification.", 14, y + 4);
    
    doc.save(`ADMIT_OS_Choice_Filling_${exam}_${rank}.pdf`);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="space-y-6 max-w-7xl mx-auto py-2"
    >
      {/* Exam Context Banner */}
      <div className="bg-gradient-to-r from-brand/20 via-brand/10 to-transparent border border-brand/30 rounded-xl px-5 py-3.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2.5 text-foreground text-sm font-extrabold">
          <span className="text-brand">⚡</span>
          <span>{bannerInfo.examName}</span>
          <span className="text-slate-400 dark:text-slate-650">·</span>
          <span className="text-slate-600 dark:text-slate-300 font-semibold">{bannerInfo.counselingBody}</span>
          <span className="text-slate-400 dark:text-slate-650">·</span>
          <span className="text-brand/80 dark:text-brand font-medium">Round 1 opens in {bannerInfo.daysUntil} days</span>
        </div>
        <div className="text-[10px] bg-brand/10 text-brand px-2 py-0.5 rounded-full font-bold border border-brand/20 hidden md:block">
          Official Schedule Updated
        </div>
      </div>

      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-slate-200 dark:border-slate-800/60 pb-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2.5">
            <Compass className="w-8 h-8 text-brand animate-spin-slow" />
            Counseling Compass
          </h1>
          <p className="text-xs text-muted-foreground dark:text-slate-400 max-w-2xl leading-relaxed">
            Model-driven choice list builder. Balance your preferences using priority cards, simulate cutoff drifts, and build your official choice filling schedule.
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setIsWhatIfOpen(true)}
            className="inline-flex items-center gap-1.5 border border-slate-350 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold px-4 py-2.5 rounded-lg text-xs md:text-sm transition-all shadow-sm"
          >
            <SlidersHorizontal className="w-4 h-4 text-slate-400 dark:text-slate-500" />
            What-If Simulator
          </button>
          <button
            onClick={exportChoiceListPDF}
            disabled={choices.length === 0}
            className="inline-flex items-center gap-1.5 bg-brand hover:bg-brand/90 text-white font-extrabold px-4 py-2.5 rounded-lg text-xs md:text-sm shadow-md transition-all disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Export Choices PDF
          </button>
        </div>
      </div>

      {/* Main Grid Layout: Form setup + Choice List + Rules */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
        
        {/* Redesigned conversational cards setup (1 Column) */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-card border border-slate-200/60 dark:border-slate-800/40 rounded-xl shadow-sm p-5 space-y-6">
            <div className="border-b border-slate-200 dark:border-slate-800 pb-3 flex justify-between items-center">
              <h2 className="text-sm font-extrabold text-foreground flex items-center gap-2">
                <Sliders className="w-4 h-4 text-brand" />
                Select Priority
              </h2>
              <span className="text-[10px] text-muted-foreground font-mono">
                Auto-balanced
              </span>
            </div>

            {/* Selection priority cards instead of old weights sliders */}
            <div className="flex flex-col gap-3">
              {[
                { 
                  id: "brand", 
                  title: "🎓 College Brand", 
                  desc: "Prioritize institution tag, campus legacy, and overall global ranking first." 
                },
                { 
                  id: "branch", 
                  title: "💻 My Branch Above All", 
                  desc: "Focus strictly on getting your chosen engineering streams, regardless of the college tier." 
                },
                { 
                  id: "location", 
                  title: "🏠 Stay Close to Home", 
                  desc: "Prioritize local cities, regional institutes, and home-state quota benefits." 
                }
              ].map((card) => {
                const isSelected = activePriority === card.id;
                return (
                  <motion.button
                    key={card.id}
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => selectPriority(card.id as any)}
                    className={`text-left p-4 rounded-xl border transition-all ${
                      isSelected
                        ? "border-brand bg-brand/10 shadow-sm"
                        : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50"
                    }`}
                  >
                    <div className="font-extrabold text-xs text-foreground flex items-center justify-between">
                      <span>{card.title}</span>
                      {isSelected && (
                        <span className="w-2 h-2 rounded-full bg-brand animate-pulse" />
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1.5 leading-relaxed">
                      {card.desc}
                    </p>
                  </motion.button>
                );
              })}
            </div>

            <div className="text-[10px] text-muted-foreground bg-muted dark:bg-slate-900 border dark:border-slate-800 p-2.5 rounded">
              Selected strategy applies preset balanced weights to model constraints.
            </div>

            {/* Risk Appetite Selector */}
            <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-3">
              <label className="text-xs font-bold text-slate-705 dark:text-slate-300">Risk Appetite Strategy</label>
              <div className="grid grid-cols-1 gap-2.5">
                {[
                  { value: "CONSERVATIVE", label: "Conservative", desc: "Focuses on safe options, securing a guaranteed allocation early." },
                  { value: "BALANCED", label: "Balanced", desc: "Equal balance of target branches, brand tiers, and moderate upgrade risks." },
                  { value: "AGGRESSIVE", label: "Aggressive", desc: "High-risk, aspirational seat ordering targeting top branches via subsequent round gaming." }
                ].map((strat) => (
                  <button
                    key={strat.value}
                    type="button"
                    onClick={() => setRiskAppetite(strat.value as any)}
                    className={`text-left p-3 rounded-lg border text-xs transition-all ${
                      riskAppetite === strat.value
                        ? "border-brand bg-brand/5 dark:bg-brand/10"
                        : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50"
                    }`}
                  >
                    <div className="flex items-center justify-between font-extrabold text-foreground">
                      <span>{strat.label}</span>
                      <span className={`w-2 h-2 rounded-full ${
                        strat.value === "AGGRESSIVE" ? "bg-rose-500 animate-pulse" : strat.value === "BALANCED" ? "bg-amber-500" : "bg-emerald-500"
                      }`} />
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-1 leading-snug">{strat.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Simulated Risk Dial */}
            <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
              <div className="flex justify-between items-center text-xs font-bold text-slate-705 dark:text-slate-300">
                <span>List Risk Score</span>
                <span className={`font-mono font-extrabold ${
                  riskScore > 70 ? "text-rose-600 dark:text-rose-450" : riskScore > 40 ? "text-amber-600 dark:text-amber-400" : "text-emerald-650 dark:text-emerald-450"
                }`}>{riskScore}/100</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-850 h-2 rounded-full mt-2 overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ${
                    riskScore > 70 ? "bg-rose-500" : riskScore > 40 ? "bg-amber-500" : "bg-emerald-500"
                  }`} 
                  style={{ width: `${riskScore}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Center Choices list (2 Columns) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quick Mock Credentials Form */}
          <div className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 p-4 rounded-xl flex flex-wrap gap-4 items-center justify-between shadow-sm">
            <div className="flex flex-wrap gap-3 items-center">
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Exam</label>
                <select 
                  value={exam} 
                  onChange={(e) => setExam(e.target.value)}
                  className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1 text-xs font-bold text-foreground focus:outline-none"
                >
                  <option value="JEE_MAIN">JEE Main</option>
                  <option value="JEE_ADVANCED">JEE Advanced</option>
                  <option value="NEET">NEET-UG</option>
                  <option value="MHT_CET">MHT-CET</option>
                  <option value="KCET">KCET</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Rank</label>
                <input 
                  type="number"
                  value={rank}
                  onChange={(e) => setRank(Math.max(1, parseInt(e.target.value) || 0))}
                  className="w-24 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1 text-xs font-bold text-foreground focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-muted-foreground uppercase tracking-wide">Category</label>
                <select 
                  value={category} 
                  onChange={(e) => setCategory(e.target.value)}
                  className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2.5 py-1 text-xs font-bold text-foreground focus:outline-none"
                >
                  <option value="GENERAL">General</option>
                  <option value="OBC_NCL">OBC-NCL</option>
                  <option value="SC">SC</option>
                  <option value="ST">ST</option>
                  <option value="EWS">EWS</option>
                </select>
              </div>
            </div>
            <div className="text-right">
              <span className="text-[10px] text-muted-foreground font-mono">Agent status: </span>
              <span className="text-[10px] bg-brand/10 text-brand border border-brand/20 px-2 py-0.5 rounded-full font-bold inline-flex items-center gap-1">
                <Sparkles className="w-2.5 h-2.5" /> Ready
              </span>
            </div>
          </div>

          {/* Explanation Alert */}
          {optimizedExplanation && (
            <div className="bg-brand/5 dark:bg-brand/10 border border-brand/20 rounded-xl p-4 flex gap-3 shadow-sm">
              <AlertCircle className="w-5 h-5 text-brand flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <h4 className="text-xs font-extrabold text-foreground">RL Choice Verification Rationale</h4>
                <p className="text-xs text-muted-foreground dark:text-slate-350 leading-relaxed font-medium">
                  {optimizedExplanation}
                </p>
              </div>
            </div>
          )}

          {/* Choices sortable wrapper with @dnd-kit */}
          <div className="space-y-4">
            <div className="p-4 border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 rounded-xl flex justify-between items-center">
              <div>
                <h3 className="font-extrabold text-foreground text-sm">Choice Filling Preference List</h3>
                <p className="text-[10px] text-muted-foreground">Rearrange rows using the drag handle. Adjust local cutoff thresholds using ⟳.</p>
              </div>
              <span className="text-xs font-bold text-muted-foreground bg-slate-200/60 dark:bg-slate-800/80 px-2.5 py-1 rounded-full">Total: {choices.length}</span>
            </div>

            {choices.length === 0 ? (
              <div className="p-16 border border-slate-200 dark:border-slate-850 rounded-xl text-center text-muted-foreground space-y-2">
                <Compass className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-700 animate-pulse" />
                <p className="text-xs font-semibold">No choices selected yet. Choose a strategy or rank variables to load list.</p>
              </div>
            ) : (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={choices.map((c, idx) => `${c.college_code}-${c.branch_code}-${idx}`)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-3">
                    {choices.map((c, index) => {
                      const rowKey = `${c.college_code}-${c.branch_code}-${index}`;
                      return (
                        <SortableChoiceRow
                          key={rowKey}
                          choice={c}
                          index={index}
                          removeChoice={removeChoice}
                          isDeltaOpen={openDeltaRow === rowKey}
                          toggleDelta={() => setOpenDeltaRow(openDeltaRow === rowKey ? null : rowKey)}
                          rankDeltaValue={rankDeltas[rowKey] || 0}
                          onRankDeltaChange={(val) => setRankDeltas(prev => ({ ...prev, [rowKey]: val }))}
                        />
                      );
                    })}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        </div>

        {/* Right Rules Side Panel (1 Column) */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-card border border-slate-200/60 dark:border-slate-800/40 rounded-xl shadow-sm p-5 space-y-5">
            <h2 className="text-sm font-extrabold text-foreground flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
              <ShieldAlert className="w-4.5 h-4.5 text-brand" />
              Allotment Guidelines
            </h2>
            <div className="space-y-4">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                Rules Summary for {exam.replace("_", " ")}
              </div>
              
              {rulesList.length === 0 ? (
                <div className="text-xs text-muted-foreground italic">No official rules loaded for {exam}.</div>
              ) : (
                <div className="space-y-3.5">
                  {rulesList.map((rule, idx) => (
                    <div key={idx} className="flex gap-2 items-start">
                      <ChevronRight className="w-4 h-4 text-brand flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-muted-foreground dark:text-slate-300 leading-relaxed">
                        {rule}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t border-slate-200 dark:border-slate-800 pt-4">
                <a
                  href={exam === "NEET" ? "https://mcc.nic.in" : "https://josaa.nic.in"}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-[#10B981] hover:underline font-extrabold flex items-center gap-1"
                >
                  Verify rules on official portal
                  <ChevronRight className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* What-If Simulator Modal */}
      {isWhatIfOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-card border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-6">
            <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-extrabold text-foreground">What-If Scenario Simulator</h3>
                <p className="text-xs text-muted-foreground">Estimate cutoff trends based on market triggers.</p>
              </div>
              <button 
                onClick={() => setIsWhatIfOpen(false)}
                className="text-muted-foreground hover:text-foreground text-2xl font-bold leading-none"
              >
                &times;
              </button>
            </div>

            <div className="space-y-5">
              {/* Seat Matrix Slider */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold text-slate-705 dark:text-slate-350">
                  <span>Seat Capacity Change</span>
                  <span className={`font-mono font-extrabold ${seatMatrixChange > 0 ? "text-emerald-500" : seatMatrixChange < 0 ? "text-rose-500" : "text-muted-foreground"}`}>
                    {seatMatrixChange > 0 ? "+" : ""}{(seatMatrixChange * 100).toFixed(0)}% seats
                  </span>
                </div>
                <input 
                  type="range"
                  min="-0.20"
                  max="0.20"
                  step="0.05"
                  value={seatMatrixChange}
                  onChange={(e) => setSeatMatrixChange(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-brand"
                />
                <div className="text-[9px] text-muted-foreground">Simulates authorities adding seats or opening new branch intakes.</div>
              </div>

              {/* Cutoff Drift Slider */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-bold text-slate-705 dark:text-slate-350">
                  <span>Cutoff Drift (Rank ease)</span>
                  <span className={`font-mono font-extrabold ${cutoffDrift > 0 ? "text-emerald-500" : cutoffDrift < 0 ? "text-rose-500" : "text-muted-foreground"}`}>
                    {cutoffDrift > 0 ? "+" : ""}{(cutoffDrift * 100).toFixed(0)}% ranks
                  </span>
                </div>
                <input 
                  type="range"
                  min="-0.20"
                  max="0.20"
                  step="0.05"
                  value={cutoffDrift}
                  onChange={(e) => setCutoffDrift(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-brand"
                />
                <div className="text-[9px] text-muted-foreground">Simulates variations in general merit thresholds due to difficulty indices.</div>
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800 pt-4">
              <button
                type="button"
                onClick={() => setIsWhatIfOpen(false)}
                className="px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-900 text-foreground transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={runWhatIfSimulation}
                className="px-4 py-2 bg-brand text-white rounded-lg text-xs font-extrabold hover:bg-brand/95 transition-colors shadow-md"
              >
                Apply Scenario
              </button>
            </div>
          </div>
        </div>
      )}

    </motion.div>
  );
}
