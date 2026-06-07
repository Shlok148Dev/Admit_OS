"use client";

import React, { useState, useEffect } from "react";
import { PredictionRequest } from "@/lib/api";
import { Filter, GraduationCap, School, BookOpen } from "lucide-react";

interface RankRadarFormProps {
  onSubmit: (data: PredictionRequest) => void;
  isLoading: boolean;
}

const AVAILABLE_BRANCHES: Record<string, { label: string; code: string }[]> = {
  JEE_MAIN: [
    { label: "Computer Science (CSE)", code: "CS" },
    { label: "Electronics & Comm (ECE)", code: "EC" },
    { label: "Electrical Eng (EEE)", code: "EE" },
    { label: "Mechanical Eng (ME)", code: "ME" },
    { label: "Civil Eng (CE)", code: "CE" },
    { label: "Chemical Eng (CH)", code: "CH" }
  ],
  JEE_ADVANCED: [
    { label: "Computer Science (CSE)", code: "CS" },
    { label: "Electronics & Comm (ECE)", code: "EC" },
    { label: "Electrical Eng (EEE)", code: "EE" },
    { label: "Mechanical Eng (ME)", code: "ME" },
    { label: "Civil Eng (CE)", code: "CE" },
    { label: "Chemical Eng (CH)", code: "CH" }
  ],
  NEET: [
    { label: "MBBS", code: "MBBS" },
    { label: "Dental Surgery (BDS)", code: "BDS" },
    { label: "Ayurveda (BAMS)", code: "BAMS" }
  ],
  MHT_CET: [
    { label: "Computer Science (CSE)", code: "CS" },
    { label: "Electronics & Comm (ECE)", code: "EC" },
    { label: "Electrical Eng (EEE)", code: "EE" },
    { label: "Mechanical Eng (ME)", code: "ME" },
    { label: "Civil Eng (CE)", code: "CE" }
  ],
  KCET: [
    { label: "Computer Science (CSE)", code: "CS" },
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
  const [exam, setExam] = useState("JEE_MAIN");
  const [rank, setRank] = useState<number | "">("");
  const [percentile, setPercentile] = useState<number | "">("");
  const [category, setCategory] = useState("GENERAL");
  const [homeState, setHomeState] = useState("MH");
  const [gender, setGender] = useState("M");
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [selectedCollegeTypes, setSelectedCollegeTypes] = useState<string[]>([]);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Clear selections when exam type changes
  useEffect(() => {
    setSelectedBranches([]);
    setSelectedCollegeTypes([]);
    setValidationError(null);
  }, [exam]);

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

    if (!rank || Number(rank) <= 0 || !Number.isInteger(Number(rank))) {
      setValidationError("Please enter a valid positive integer rank.");
      return;
    }

    if (percentile && (Number(percentile) < 0 || Number(percentile) > 100)) {
      setValidationError("Percentile must be between 0 and 100.");
      return;
    }

    onSubmit({
      exam,
      rank: Number(rank),
      percentile: percentile ? Number(percentile) : null,
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

  return (
    <div className="bg-card border border-slate-200/60 dark:border-slate-800/40 rounded-xl shadow-sm overflow-hidden">
      <div className="border-b border-slate-250 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50 p-5">
        <h2 className="text-sm md:text-base font-extrabold text-foreground flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-primary" />
          1. Student Credentials
        </h2>
        <p className="text-xs text-muted-foreground">Provide your exam details to run the prediction engine.</p>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {validationError && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-450 p-3 rounded-lg text-xs font-bold animate-shake">
            {validationError}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Exam Type */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-705 dark:text-slate-300">Exam Type</label>
            <select
              value={exam}
              onChange={(e) => {
                setExam(e.target.value);
                if (e.target.value === "NEET") {
                  setPercentile("");
                }
              }}
              className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            >
              <option value="JEE_MAIN">JEE Main</option>
              <option value="JEE_ADVANCED">JEE Advanced</option>
              <option value="NEET">NEET-UG</option>
              <option value="MHT_CET">MHT-CET (State)</option>
              <option value="KCET">KCET (State)</option>
            </select>
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-705 dark:text-slate-300">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            >
              <option value="GENERAL">General (Open)</option>
              <option value="OBC_NCL">OBC-NCL</option>
              <option value="SC">Scheduled Caste (SC)</option>
              <option value="ST">Scheduled Tribe (ST)</option>
              <option value="EWS">EWS</option>
              <option value="PwD">PwD (Disabled)</option>
            </select>
          </div>

          {/* AIR Rank */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-705 dark:text-slate-300">
              All India Rank (AIR) <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              required
              min="1"
              step="1"
              value={rank}
              onChange={(e) => {
                const val = e.target.value;
                setRank(val ? parseInt(val, 10) : "");
              }}
              placeholder="e.g. 15420"
              className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-foreground placeholder-slate-400 dark:placeholder-slate-650 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            />
          </div>

          {/* Percentile (Optional) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-705 dark:text-slate-300">
              Percentile <span className="text-slate-400 font-normal">(Optional)</span>
            </label>
            <input
              type="number"
              step="0.0001"
              max="100"
              min="0"
              value={percentile}
              onChange={(e) => setPercentile(e.target.value ? parseFloat(e.target.value) : "")}
              disabled={exam === "NEET"}
              placeholder={exam === "NEET" ? "N/A for NEET" : "e.g. 98.4215"}
              className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-foreground placeholder-slate-400 dark:placeholder-slate-650 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all disabled:bg-slate-100 dark:disabled:bg-slate-900 disabled:text-slate-400 dark:disabled:text-slate-600"
            />
          </div>

          {/* Home State */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-705 dark:text-slate-300">Home State</label>
            <select
              value={homeState}
              onChange={(e) => setHomeState(e.target.value)}
              className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            >
              <option value="MH">Maharashtra (MH)</option>
              <option value="KA">Karnataka (KA)</option>
              <option value="DL">Delhi (DL)</option>
              <option value="UP">Uttar Pradesh (UP)</option>
              <option value="TN">Tamil Nadu (TN)</option>
              <option value="AP">Andhra Pradesh (AP)</option>
              <option value="TS">Telangana (TS)</option>
              <option value="WB">West Bengal (WB)</option>
              <option value="RJ">Rajasthan (RJ)</option>
              <option value="GJ">Gujarat (GJ)</option>
            </select>
          </div>

          {/* Gender */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-705 dark:text-slate-300">Gender</label>
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            >
              <option value="M">Male (Gender-Neutral)</option>
              <option value="F">Female (Supernumerary)</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
        </div>

        {/* Filters Section */}
        <div className="border-t border-slate-200 dark:border-slate-800 pt-4 space-y-4">
          <div className="flex items-center gap-1.5 text-foreground font-extrabold text-sm">
            <Filter className="w-4 h-4 text-emerald-500" />
            Filters & Custom Preferences
          </div>

          {/* College Types */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-705 dark:text-slate-300 flex items-center gap-1">
              <School className="w-3.5 h-3.5 text-slate-500" />
              College Types
            </label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_COLLEGE_TYPES[exam]?.map((type) => {
                const active = selectedCollegeTypes.includes(type);
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleTypeToggle(type)}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-all ${
                      active
                        ? "bg-primary border-primary text-primary-foreground font-bold shadow-sm"
                        : "bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-800 text-muted-foreground hover:bg-slate-50 dark:hover:bg-slate-900"
                    }`}
                  >
                    {type}
                  </button>
                );
              })}
              {(!AVAILABLE_COLLEGE_TYPES[exam] || AVAILABLE_COLLEGE_TYPES[exam].length === 0) && (
                <div className="text-xs text-muted-foreground italic">No college types filters for this exam.</div>
              )}
            </div>
          </div>

          {/* Branches */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-705 dark:text-slate-300 flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5 text-slate-500" />
              Branch Filters
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {AVAILABLE_BRANCHES[exam]?.map((branch) => {
                const active = selectedBranches.includes(branch.code);
                return (
                  <button
                    key={branch.code}
                    type="button"
                    onClick={() => handleBranchToggle(branch.code)}
                    className={`flex items-center gap-2 text-left text-xs px-3 py-2 rounded-lg border transition-all ${
                      active
                        ? "bg-emerald-500/10 border-emerald-500 text-emerald-700 dark:text-emerald-400 font-bold"
                        : "bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-800 text-muted-foreground hover:bg-slate-50 dark:hover:bg-slate-900"
                    }`}
                  >
                    <span
                      className={`w-3.5 h-3.5 rounded-md border flex items-center justify-center text-[9px] ${
                        active ? "bg-emerald-500 border-emerald-500 text-slate-950 font-bold" : "border-slate-300 dark:border-slate-700"
                      }`}
                    >
                      {active ? "✓" : ""}
                    </span>
                    {branch.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-primary hover:bg-primary/95 text-primary-foreground font-extrabold py-3 px-4 rounded-lg shadow-md hover:shadow-primary/10 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:bg-primary/50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
        >
          {isLoading ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Running Cutoff Predictions...
            </>
          ) : (
            "Predict Colleges & Branches"
          )}
        </button>
      </form>
    </div>
  );
}
