"use client";

import React, { useState, useEffect } from "react";
import { PredictionRequest } from "@/lib/api";
import { percentileToEstimatedRank, rankToEstimatedPercentile, EXAM_COHORTS } from "@/lib/rank_converter";
import { Filter, GraduationCap, School, BookOpen, Layers, Sparkles, AlertCircle, Compass } from "lucide-react";

interface RankRadarFormProps {
  onSubmit: (data: PredictionRequest) => void;
  isLoading: boolean;
}

const AVAILABLE_BRANCHES: Record<string, { label: string; code: string }[]> = {
  JEE_MAIN: [
    { label: "Computer Science (CSE)", code: "CS" },
    { label: "AI & Data Science (AIDS)", code: "AIDS" },
    { label: "Information Tech (IT)", code: "IT" },
    { label: "Electronics & Comm (ECE)", code: "EC" },
    { label: "Electrical Eng (EEE)", code: "EE" },
    { label: "Mechanical Eng (ME)", code: "ME" },
    { label: "Civil Eng (CE)", code: "CE" },
    { label: "Chemical Eng (CH)", code: "CH" }
  ],
  JEE_ADVANCED: [
    { label: "Computer Science (CSE)", code: "CS" },
    { label: "AI & Data Science (AIDS)", code: "AIDS" },
    { label: "Electronics & Comm (ECE)", code: "EC" },
    { label: "Electrical Eng (EEE)", code: "EE" },
    { label: "Mechanical Eng (ME)", code: "ME" },
    { label: "Civil Eng (CE)", code: "CE" },
    { label: "Chemical Eng (CH)", code: "CH" }
  ],
  NEET: [
    { label: "MBBS (Medicine & Surgery)", code: "MBBS" },
    { label: "Dental Surgery (BDS)", code: "BDS" },
    { label: "Ayurveda (BAMS)", code: "BAMS" }
  ],
  MHT_CET: [
    { label: "Computer Science (CSE)", code: "CS" },
    { label: "AI & Data Science (AIDS)", code: "AIDS" },
    { label: "Information Tech (IT)", code: "IT" },
    { label: "Electronics & Comm (ECE)", code: "EC" },
    { label: "Electrical Eng (EEE)", code: "EE" },
    { label: "Mechanical Eng (ME)", code: "ME" },
    { label: "Civil Eng (CE)", code: "CE" }
  ],
  KCET: [
    { label: "Computer Science (CSE)", code: "CS" },
    { label: "AI & Data Science (AIDS)", code: "AIDS" },
    { label: "Electronics & Comm (ECE)", code: "EC" },
    { label: "Electrical Eng (EEE)", code: "EE" },
    { label: "Mechanical Eng (ME)", code: "ME" },
    { label: "Civil Eng (CE)", code: "CE" }
  ]
};

const AVAILABLE_COLLEGE_TYPES: Record<string, string[]> = {
  JEE_MAIN: ["NIT", "IIIT", "GFTI"],
  JEE_ADVANCED: ["IIT"],
  NEET: ["AIIMS", "STATE", "PRIVATE"],
  MHT_CET: ["STATE", "PRIVATE"],
  KCET: ["STATE", "PRIVATE"]
};

export default function RankRadarForm({ onSubmit, isLoading }: RankRadarFormProps) {
  const [exam, setExam] = useState("MHT_CET");
  const [inputMode, setInputMode] = useState<"PERCENTILE" | "RANK">("PERCENTILE");
  const [rank, setRank] = useState<number | "">("");
  const [percentile, setPercentile] = useState<number | "">(98.45);
  const [category, setCategory] = useState("GENERAL");
  const [homeState, setHomeState] = useState("MH");
  const [gender, setGender] = useState("M");
  const [counselingStage, setCounselingStage] = useState<"ROUND_1" | "STANDARD" | "SPOT_ROUND">("STANDARD");
  const [subQuota, setSubQuota] = useState<string>("STATE_GENERAL");
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [selectedCollegeTypes, setSelectedCollegeTypes] = useState<string[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Auto-interpolate rank whenever percentile or exam changes in PERCENTILE mode
  useEffect(() => {
    if (inputMode === "PERCENTILE" && percentile !== "" && Number(percentile) > 0) {
      const estimation = percentileToEstimatedRank(Number(percentile), exam);
      setRank(estimation.estimatedMidRank);
    }
  }, [percentile, exam, inputMode]);

  // Clear selections when exam type changes
  useEffect(() => {
    setSelectedBranches([]);
    setSelectedCollegeTypes([]);
    setValidationError(null);
    if (exam === "MHT_CET") {
      setHomeState("MH");
      setSubQuota("STATE_GENERAL");
    } else if (exam === "KCET") {
      setHomeState("KA");
      setSubQuota("STATE_GENERAL");
    } else {
      setSubQuota("AIQ");
    }
  }, [exam]);

  const handlePercentileChange = (val: string) => {
    if (val === "") {
      setPercentile("");
      setRank("");
      return;
    }
    const num = parseFloat(val);
    setPercentile(num);
    if (!isNaN(num) && num >= 0 && num <= 100) {
      const estimation = percentileToEstimatedRank(num, exam);
      setRank(estimation.estimatedMidRank);
    }
  };

  const handleRankChange = (val: string) => {
    if (val === "") {
      setRank("");
      setPercentile("");
      return;
    }
    const num = parseInt(val, 10);
    setRank(num);
    if (!isNaN(num) && num > 0) {
      const estimatedPctl = rankToEstimatedPercentile(num, exam);
      setPercentile(estimatedPctl);
    }
  };

  const handleBranchToggle = (code: string) => {
    setSelectedBranches((prev) =>
      prev.includes(code) ? prev.filter((b) => b !== code) : [...prev, code]
    );
  };

  const handleTypeToggle = (type: string) => {
    setSelectedCollegeTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    let effectiveRank = Number(rank);

    if (inputMode === "PERCENTILE") {
      if (percentile === "" || Number(percentile) < 0 || Number(percentile) > 100) {
        setValidationError("Please enter a valid percentile score between 0 and 100.");
        return;
      }
      const estimation = percentileToEstimatedRank(Number(percentile), exam);
      effectiveRank = estimation.estimatedMidRank;
    } else {
      if (!rank || effectiveRank <= 0 || !Number.isInteger(effectiveRank)) {
        setValidationError("Please enter a valid positive integer merit rank.");
        return;
      }
    }

    onSubmit({
      exam,
      rank: effectiveRank,
      percentile: percentile ? Number(percentile) : null,
      category,
      home_state: homeState,
      gender,
      year: 2026,
      counseling_stage: counselingStage,
      sub_quota: subQuota,
      filters: {
        branches: selectedBranches.length > 0 ? selectedBranches : null,
        college_types: selectedCollegeTypes.length > 0 ? selectedCollegeTypes : null
      }
    });
  };

  const estimatedBracket = percentile !== "" && Number(percentile) > 0 
    ? percentileToEstimatedRank(Number(percentile), exam) 
    : null;

  return (
    <div className="bg-card border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-md overflow-hidden transition-all">
      <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/90 dark:bg-slate-900/90 p-5">
        <h2 className="text-sm md:text-base font-extrabold text-foreground flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-primary" />
          1. Student Credentials & Quota Profile
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Dual percentile/rank resolver with sub-quota & round-stage modeling.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {validationError && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-450 p-3.5 rounded-xl text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        {/* Input Mode Toggle */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Select Input Metric</label>
          <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => setInputMode("PERCENTILE")}
              className={`py-2 text-xs font-extrabold rounded-lg transition-all ${
                inputMode === "PERCENTILE"
                  ? "bg-white dark:bg-slate-800 text-primary shadow-sm border border-slate-200/80 dark:border-slate-700"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Score / Percentile (%)
            </button>
            <button
              type="button"
              onClick={() => setInputMode("RANK")}
              className={`py-2 text-xs font-extrabold rounded-lg transition-all ${
                inputMode === "RANK"
                  ? "bg-white dark:bg-slate-800 text-primary shadow-sm border border-slate-200/80 dark:border-slate-700"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Merit Rank (AIR / SML)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Exam Type */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Exam Type</label>
            <select
              value={exam}
              onChange={(e) => setExam(e.target.value)}
              className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs md:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all shadow-xs"
            >
              <option value="MHT_CET">MHT-CET (Maharashtra State)</option>
              <option value="JEE_MAIN">JEE Main / JoSAA</option>
              <option value="JEE_ADVANCED">JEE Advanced (IITs)</option>
              <option value="NEET">NEET-UG (Medical)</option>
              <option value="KCET">KCET (Karnataka State)</option>
            </select>
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Social Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs md:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all shadow-xs"
            >
              <option value="GENERAL">General (Open Merit)</option>
              <option value="OBC_NCL">OBC-NCL</option>
              <option value="EWS">Economically Weaker Section (EWS)</option>
              <option value="SC">Scheduled Caste (SC)</option>
              <option value="ST">Scheduled Tribe (ST)</option>
              <option value="PwD">PwD (Persons with Disabilities)</option>
            </select>
          </div>

          {/* Primary Input (Percentile or Rank) */}
          {inputMode === "PERCENTILE" ? (
            <div className="space-y-1.5 sm:col-span-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Entrance Percentile <span className="text-rose-500">*</span>
                </label>
                {estimatedBracket && (
                  <span className="text-[11px] font-extrabold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-md flex items-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Est. Rank: {estimatedBracket.formattedRank}
                  </span>
                )}
              </div>
              <input
                type="number"
                step="0.0001"
                min="0"
                max="100"
                required
                value={percentile}
                onChange={(e) => handlePercentileChange(e.target.value)}
                placeholder="e.g. 98.4521"
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs md:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all shadow-xs"
              />
              <p className="text-[10px] text-muted-foreground">
                Mapped against verified cohort volume: {EXAM_COHORTS[exam]?.totalCandidates.toLocaleString("en-IN")} candidates.
              </p>
            </div>
          ) : (
            <div className="space-y-1.5 sm:col-span-2">
              <div className="flex justify-between items-center">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  All India / State Merit Rank <span className="text-rose-500">*</span>
                </label>
                {percentile !== "" && (
                  <span className="text-[11px] font-extrabold text-primary bg-primary/10 border border-primary/20 px-2.5 py-0.5 rounded-md">
                    Est. Percentile: ~{percentile}%
                  </span>
                )}
              </div>
              <input
                type="number"
                min="1"
                required
                value={rank}
                onChange={(e) => handleRankChange(e.target.value)}
                placeholder="e.g. 6400"
                className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs md:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all shadow-xs"
              />
            </div>
          )}

          {/* Sub-Quota & Minorities */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">State Quota & Sub-Category</label>
            <select
              value={subQuota}
              onChange={(e) => setSubQuota(e.target.value)}
              className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs md:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all shadow-xs"
            >
              {exam === "MHT_CET" ? (
                <>
                  <option value="STATE_GENERAL">State Open / General Quota</option>
                  <option value="HU">Home University (HU - 70% Non-Autonomous)</option>
                  <option value="OHU">Other than Home University (OHU)</option>
                  <option value="GUJARATI_MINORITY">Gujarati Minority (50% DJSCE / KJSCE)</option>
                  <option value="HINDI_MINORITY">Hindi Minority (50% Thakur TCET)</option>
                  <option value="SINDHI_MINORITY">Sindhi Minority (50% VESIT / Thadomal)</option>
                  <option value="CHRISTIAN_MINORITY">Christian Minority (50% Fr. Agnel)</option>
                  <option value="TFWS">Tuition Fee Waiver Scheme (TFWS - 5%)</option>
                  <option value="DEFENSE">Defense Personnel Sub-Category</option>
                </>
              ) : (
                <>
                  <option value="AIQ">All India Quota (AIQ / Open)</option>
                  <option value="HS">Home State (HS) Quota</option>
                  <option value="OS">Other State (OS) Quota</option>
                  <option value="DEFENSE">Defense Personnel (DEF1/2/3)</option>
                  <option value="PWD">PwD 5% Horizontal Reservation</option>
                </>
              )}
            </select>
          </div>

          {/* Counseling Round Stage Dynamics */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Counseling Stage Horizon</label>
            <select
              value={counselingStage}
              onChange={(e) => setCounselingStage(e.target.value as any)}
              className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs md:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all shadow-xs"
            >
              <option value="ROUND_1">Conservative (Round 1 Cutoffs)</option>
              <option value="STANDARD">Standard (Final Allotted CAP/JoSAA Round)</option>
              <option value="SPOT_ROUND">Aggressive (Spot / Vacancy Round Trends)</option>
            </select>
          </div>

          {/* Gender */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Gender Allocation</label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs md:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all shadow-xs"
            >
              <option value="M">Gender-Neutral Pool (Male/Any)</option>
              <option value="F">Female Only Supernumerary Pool</option>
            </select>
          </div>

          {/* Home State */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Home State Eligibility</label>
            <select
              value={homeState}
              onChange={(e) => setHomeState(e.target.value)}
              className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl px-3.5 py-2.5 text-xs md:text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all shadow-xs"
            >
              <option value="MH">Maharashtra (MH)</option>
              <option value="KA">Karnataka (KA)</option>
              <option value="TN">Tamil Nadu (TN)</option>
              <option value="DL">Delhi (DL)</option>
              <option value="UP">Uttar Pradesh (UP)</option>
              <option value="RJ">Rajasthan (RJ)</option>
              <option value="OTHER">Other State</option>
            </select>
          </div>
        </div>

        {/* Filters Section */}
        <div className="space-y-4 pt-2 border-t border-slate-200/80 dark:border-slate-800/80">
          <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
            <Filter className="w-3.5 h-3.5 text-primary" />
            Filters & Custom Preferences
          </div>

          {/* College Types */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-muted-foreground flex items-center gap-1">
              <School className="w-3 h-3 text-primary" /> College Types
            </span>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_COLLEGE_TYPES[exam]?.map((type) => {
                const isSelected = selectedCollegeTypes.includes(type);
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleTypeToggle(type)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      isSelected
                        ? "bg-primary text-white shadow-xs"
                        : "bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {type}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Branch Filters */}
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-muted-foreground flex items-center gap-1">
              <BookOpen className="w-3 h-3 text-primary" /> Branch Filters
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {AVAILABLE_BRANCHES[exam]?.map((b) => {
                const isSelected = selectedBranches.includes(b.code);
                return (
                  <label
                    key={b.code}
                    onClick={() => handleBranchToggle(b.code)}
                    className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs cursor-pointer transition-all ${
                      isSelected
                        ? "bg-primary/10 border-primary/40 text-primary font-bold shadow-xs"
                        : "bg-white dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 text-muted-foreground hover:border-slate-300"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="rounded border-slate-300 text-primary focus:ring-primary h-3.5 w-3.5"
                    />
                    <span>{b.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-primary hover:bg-primary/90 active:scale-[0.99] text-white py-3.5 rounded-xl font-extrabold text-sm shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full border-2 border-white/20 border-t-white animate-spin"></div>
              <span>Calibrating Sigmoid Ensemble...</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 animate-pulse" />
              <span>Predict Colleges & Tiers</span>
            </div>
          )}
        </button>
      </form>
    </div>
  );
}
