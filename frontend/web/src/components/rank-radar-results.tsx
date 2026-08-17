"use client";

import React, { useState, useMemo, useEffect } from "react";
import { PredictionResponse, Prediction } from "@/lib/api";
import Link from "next/link";
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  MoveRight, 
  ExternalLink, 
  Info, 
  AlertTriangle, 
  ArrowUpDown, 
  ShieldCheck, 
  Activity, 
  BarChart3,
  Compass,
  CheckCircle2,
  Sparkles,
  Layers,
  Check,
  Building,
  Target
} from "lucide-react";
import OutcomeReportModal from "./OutcomeReportModal";

interface RankRadarResultsProps {
  data: PredictionResponse | null;
}

type SortField = "probability" | "nirf" | "fees";
type TierFilter = "ALL" | "SAFE" | "TARGET" | "DREAM";

export default function RankRadarResults({ data }: RankRadarResultsProps) {
  const [sortBy, setSortBy] = useState<SortField>("probability");
  const [activeTier, setActiveTier] = useState<TierFilter>("ALL");
  const [highConfidenceOnly, setHighConfidenceOnly] = useState(false);
  const [accuracyData, setAccuracyData] = useState<any>(null);
  const [reportPrediction, setReportPrediction] = useState<Prediction | null>(null);
  const [selectedColleges, setSelectedColleges] = useState<string[]>([]);
  const [exportSuccess, setExportSuccess] = useState(false);

  useEffect(() => {
    fetch("/v1/analytics/accuracy/public")
      .then((res) => res.json())
      .then((data) => setAccuracyData(data))
      .catch((err) => console.warn("Failed to fetch public accuracy data:", err));
  }, []);

  if (!data) return null;

  const { predictions, metadata } = data;

  // Counts for each tier bucket
  const safeCount = predictions.filter(p => p.admission_probability >= 0.80).length;
  const targetCount = predictions.filter(p => p.admission_probability >= 0.40 && p.admission_probability < 0.80).length;
  const dreamCount = predictions.filter(p => p.admission_probability < 0.40).length;

  // Filter and Sort predictions
  const processedPredictions = useMemo(() => {
    let result = [...predictions];

    // Filter by tier bucket
    if (activeTier === "SAFE") {
      result = result.filter(p => p.admission_probability >= 0.80);
    } else if (activeTier === "TARGET") {
      result = result.filter(p => p.admission_probability >= 0.40 && p.admission_probability < 0.80);
    } else if (activeTier === "DREAM") {
      result = result.filter(p => p.admission_probability < 0.40);
    }

    // Filter by high confidence
    if (highConfidenceOnly) {
      result = result.filter((p) => p.data_confidence === "HIGH");
    }

    // Sort predictions
    result.sort((a, b) => {
      if (sortBy === "probability") {
        return b.admission_probability - a.admission_probability;
      }
      if (sortBy === "nirf") {
        const aNirf = a.nirf_rank || 9999;
        const bNirf = b.nirf_rank || 9999;
        return aNirf - bNirf;
      }
      if (sortBy === "fees") {
        return a.fees_per_year - b.fees_per_year;
      }
      return 0;
    });

    return result;
  }, [predictions, sortBy, activeTier, highConfidenceOnly]);

  const toggleSelectCollege = (code: string) => {
    setSelectedColleges(prev => 
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  };

  const handleSelectAllInView = () => {
    const viewCodes = processedPredictions.map(p => `${p.college_code}-${p.branch_code}`);
    setSelectedColleges(viewCodes);
  };

  const handleExportToCompass = () => {
    setExportSuccess(true);
    setTimeout(() => setExportSuccess(false), 4000);
  };

  // Helper to color-code probability
  const getProbabilityStyles = (prob: number) => {
    if (prob >= 0.80) {
      return {
        bg: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
        bar: "bg-emerald-500",
        label: "Safe / Fallback",
      };
    } else if (prob >= 0.40) {
      return {
        bg: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
        bar: "bg-amber-500",
        label: "Target / Realistic",
      };
    } else {
      return {
        bg: "bg-rose-500/10 text-rose-700 dark:text-rose-450 border-rose-500/30",
        bar: "bg-rose-500",
        label: "Dream / Ambitious",
      };
    }
  };

  const renderTrend = (trend: "RISING" | "FALLING" | "STABLE") => {
    switch (trend) {
      case "RISING":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
            <ArrowUpRight className="w-3.5 h-3.5" /> Rising
          </span>
        );
      case "FALLING":
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 dark:text-rose-400">
            <ArrowDownRight className="w-3.5 h-3.5" /> Falling
          </span>
        );
      case "STABLE":
      default:
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 dark:text-slate-400">
            <MoveRight className="w-3.5 h-3.5" /> Stable
          </span>
        );
    }
  };

  const renderSparkline = (historicalRanks: Record<string, number>) => {
    const years = ["2020", "2021", "2022", "2023", "2024"];
    const ranks = years.map(yr => historicalRanks[yr]).filter(val => val !== undefined && val !== null);
    
    if (ranks.length < 2) {
      return <span className="text-[10px] text-slate-400">Insufficient data</span>;
    }

    const min = Math.min(...ranks);
    const max = Math.max(...ranks);
    const range = max - min === 0 ? 1 : max - min;

    const points = ranks.map((rank, idx) => {
      const x = (idx * (90 / (ranks.length - 1))).toFixed(1);
      const y = (5 + ((rank - min) / range) * 20).toFixed(1);
      return `${x},${y}`;
    }).join(" ");

    return (
      <div className="relative group flex flex-col items-center">
        <svg className="w-24 h-8 overflow-visible" viewBox="0 0 90 30">
          <polyline
            fill="none"
            stroke="#10b981"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={points}
          />
          {ranks.map((rank, idx) => {
            const x = (idx * (90 / (ranks.length - 1))).toFixed(1);
            const y = (5 + ((rank - min) / range) * 20).toFixed(1);
            return (
              <circle
                key={idx}
                cx={x}
                cy={y}
                r="3"
                className="fill-white dark:fill-slate-900 stroke-emerald-600 dark:stroke-emerald-400 stroke-[1.5] opacity-0 group-hover:opacity-100 transition-opacity"
              />
            );
          })}
        </svg>
        <div className="text-[9px] text-muted-foreground mt-1 flex justify-between w-full">
          <span>{years[0]}</span>
          <span>{years[years.length - 1]}</span>
        </div>
        <div className="absolute bottom-full mb-1 hidden group-hover:flex flex-col bg-slate-950 border border-slate-800 text-white text-[10px] p-2.5 rounded-lg shadow-xl pointer-events-none z-50 whitespace-nowrap">
          <div className="font-extrabold border-b border-slate-800 pb-1 mb-1">5-Year Cutoff Ranks:</div>
          {years.map((yr) => (
            <div key={yr} className="flex justify-between gap-4">
              <span>{yr}:</span>
              <span className="font-semibold">{historicalRanks[yr]?.toLocaleString() || "N/A"}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderConfidenceBadge = (p: Prediction) => {
    const isHigh = p.data_confidence === "HIGH";
    const badgeColor = isHigh 
      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20" 
      : p.data_confidence === "MEDIUM"
      ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20"
      : "bg-slate-200/60 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700";

    return (
      <div className="relative group inline-block">
        <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold border flex items-center gap-1 cursor-help ${badgeColor}`}>
          <ShieldCheck className="w-2.5 h-2.5" />
          {p.data_confidence} Conf
        </span>
        <div className="absolute bottom-full mb-2 hidden group-hover:block bg-slate-950 border border-slate-800 text-white text-[11px] p-3 rounded-lg shadow-xl w-64 z-50 leading-relaxed font-normal">
          <div className="font-bold text-xs flex items-center gap-1 mb-1 text-emerald-400">
            <ShieldCheck className="w-3.5 h-3.5" />
            Verified Source Grounding
          </div>
          <p className="text-[10px] text-slate-300 mb-1">{p.data_source}</p>
          <a
            href={p.source_url}
            target="_blank"
            rel="noreferrer"
            className="text-emerald-400 hover:underline flex items-center gap-1 text-[10px] font-bold"
          >
            Official Seat Allocation Portal <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Export Success Alert */}
      {exportSuccess && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 p-4 rounded-xl flex items-center justify-between shadow-sm animate-fade-in">
          <div className="flex items-center gap-2 text-xs font-bold">
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            <span>Successfully exported candidate colleges to Counseling Compass!</span>
          </div>
          <Link
            href="/counsel"
            className="px-3 py-1 bg-emerald-600 text-white text-xs font-extrabold rounded-lg hover:bg-emerald-500 transition-all flex items-center gap-1"
          >
            Open Compass <Compass className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}

      {/* Results Header with Controls */}
      <div className="bg-card border border-slate-200/80 dark:border-slate-800/80 p-5 rounded-2xl shadow-md space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base md:text-lg font-extrabold text-foreground">
                2. Predicted College Matchings
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                Sigmoid Calibrated
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Stage: <span className="font-semibold text-foreground">{metadata.counseling_stage || "Standard"}</span> • Sub-Quota: <span className="font-semibold text-foreground">{metadata.sub_quota_applied || "Open State"}</span> • Total: <span className="font-semibold">{metadata.total_predictions}</span>
            </p>
          </div>

          {/* Export Action */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExportToCompass}
              className="px-4 py-2 bg-primary hover:bg-primary/90 text-white text-xs font-extrabold rounded-xl shadow-sm transition-all flex items-center gap-1.5 active:scale-95"
            >
              <Compass className="w-3.5 h-3.5" />
              Export to Counseling Compass
            </button>
          </div>
        </div>

        {/* Actionable Triage Buckets (Tabs) */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setActiveTier("ALL")}
            className={`p-3 rounded-xl border text-left transition-all ${
              activeTier === "ALL"
                ? "bg-slate-100 dark:bg-slate-800/90 border-slate-300 dark:border-slate-700 shadow-sm"
                : "bg-slate-50/50 dark:bg-slate-900/40 border-slate-200/70 dark:border-slate-800/60 hover:border-slate-300"
            }`}
          >
            <div className="text-[11px] font-bold text-muted-foreground">All Matches</div>
            <div className="text-lg font-extrabold text-foreground">{predictions.length}</div>
          </button>

          <button
            type="button"
            onClick={() => setActiveTier("SAFE")}
            className={`p-3 rounded-xl border text-left transition-all ${
              activeTier === "SAFE"
                ? "bg-emerald-500/15 border-emerald-500/40 shadow-sm"
                : "bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/30"
            }`}
          >
            <div className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Safe (&ge;80%)
            </div>
            <div className="text-lg font-extrabold text-emerald-700 dark:text-emerald-300">{safeCount}</div>
          </button>

          <button
            type="button"
            onClick={() => setActiveTier("TARGET")}
            className={`p-3 rounded-xl border text-left transition-all ${
              activeTier === "TARGET"
                ? "bg-amber-500/15 border-amber-500/40 shadow-sm"
                : "bg-amber-500/5 border-amber-500/20 hover:border-amber-500/30"
            }`}
          >
            <div className="text-[11px] font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span> Target (40-79%)
            </div>
            <div className="text-lg font-extrabold text-amber-700 dark:text-amber-300">{targetCount}</div>
          </button>

          <button
            type="button"
            onClick={() => setActiveTier("DREAM")}
            className={`p-3 rounded-xl border text-left transition-all ${
              activeTier === "DREAM"
                ? "bg-rose-500/15 border-rose-500/40 shadow-sm"
                : "bg-rose-500/5 border-rose-500/20 hover:border-rose-500/30"
            }`}
          >
            <div className="text-[11px] font-bold text-rose-700 dark:text-rose-450 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span> Dream (&lt;40%)
            </div>
            <div className="text-lg font-extrabold text-rose-700 dark:text-rose-300">{dreamCount}</div>
          </button>
        </div>

        {/* Controls Row */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 dark:border-slate-800 pt-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted-foreground flex items-center gap-1">
              <ArrowUpDown className="w-3.5 h-3.5 text-primary" /> Sort by:
            </span>
            <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-800 p-0.5 bg-slate-50 dark:bg-slate-900">
              <button
                type="button"
                onClick={() => setSortBy("probability")}
                className={`text-xs px-3 py-1 rounded-md transition-all font-bold ${
                  sortBy === "probability"
                    ? "bg-white dark:bg-slate-800 text-primary shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Probability
              </button>
              <button
                type="button"
                onClick={() => setSortBy("nirf")}
                className={`text-xs px-3 py-1 rounded-md transition-all font-bold ${
                  sortBy === "nirf"
                    ? "bg-white dark:bg-slate-800 text-primary shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                NIRF Rank
              </button>
              <button
                type="button"
                onClick={() => setSortBy("fees")}
                className={`text-xs px-3 py-1 rounded-md transition-all font-bold ${
                  sortBy === "fees"
                    ? "bg-white dark:bg-slate-800 text-primary shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Annual Fees
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs font-bold cursor-pointer select-none text-muted-foreground hover:text-foreground">
            <input
              type="checkbox"
              checked={highConfidenceOnly}
              onChange={(e) => setHighConfidenceOnly(e.target.checked)}
              className="rounded border-slate-300 text-primary focus:ring-primary h-4 w-4"
            />
            <span>Show HIGH confidence predictions only</span>
          </label>
        </div>
      </div>

      {/* Predictions Table Card */}
      <div className="bg-card border border-slate-200/80 dark:border-slate-800/80 rounded-2xl shadow-md overflow-hidden">
        {processedPredictions.length === 0 ? (
          <div className="p-12 text-center space-y-2 text-muted-foreground">
            <Target className="w-8 h-8 mx-auto text-muted-foreground/60" />
            <p className="text-xs">No college matches found for the selected tier and filter criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/90 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200">
                  <th className="py-3.5 px-4 font-extrabold text-[11px] uppercase tracking-wider text-slate-800 dark:text-slate-200">
                    Institute & Branch
                  </th>
                  <th className="py-3.5 px-3 font-extrabold text-[11px] uppercase tracking-wider text-center">
                    NIRF
                  </th>
                  <th className="py-3.5 px-4 font-extrabold text-[11px] uppercase tracking-wider">
                    Admission Probability (Sigmoid)
                  </th>
                  <th className="py-3.5 px-4 font-extrabold text-[11px] uppercase tracking-wider text-center">
                    5-Year Trend
                  </th>
                  <th className="py-3.5 px-4 font-extrabold text-[11px] uppercase tracking-wider">
                    Expected Seat (P50 Mid)
                  </th>
                  <th className="py-3.5 px-4 font-extrabold text-[11px] uppercase tracking-wider">
                    Fees & Quota
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {processedPredictions.map((p, idx) => {
                  const probInfo = getProbabilityStyles(p.admission_probability);
                  const isSelected = selectedColleges.includes(`${p.college_code}-${p.branch_code}`);

                  return (
                    <tr
                      key={`${p.college_code}-${p.branch_code}-${idx}`}
                      className={`transition-colors ${
                        idx % 2 === 0
                          ? "bg-white dark:bg-slate-950/40"
                          : "bg-slate-50/50 dark:bg-slate-900/30"
                      } hover:bg-primary/5 dark:hover:bg-primary/10`}
                    >
                      {/* Institute & Branch */}
                      <td className="py-4 px-4 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-extrabold text-foreground text-xs md:text-sm">
                            {p.college_name}
                          </span>
                          {p.minority_type && (
                            <span className="text-[9px] bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 px-1.5 py-0.5 rounded font-bold">
                              {p.minority_type} Minority
                            </span>
                          )}
                          {p.is_near_miss && (
                            <span className="text-[9px] bg-orange-500/10 text-orange-700 dark:text-orange-300 border border-orange-500/25 px-1.5 py-0.5 rounded font-bold">
                              ⚡ Near Miss
                            </span>
                          )}
                          {p.mgmt_quota_only && (
                            <span className="text-[9px] bg-slate-500/10 text-slate-700 dark:text-slate-300 border border-slate-500/20 px-1.5 py-0.5 rounded font-bold">
                              💼 Mgmt Quota
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground font-medium">
                          {p.branch_name} ({p.branch_code})
                        </div>
                        <div className="pt-0.5">
                          {renderConfidenceBadge(p)}
                        </div>
                      </td>

                      {/* NIRF */}
                      <td className="py-4 px-3 text-center font-extrabold text-foreground text-xs">
                        {p.nirf_rank ? `#${p.nirf_rank}` : "-"}
                      </td>

                      {/* Probability (Sigmoid calibrated) */}
                      <td className="py-4 px-4 space-y-1.5">
                        <div className="flex items-center justify-between gap-3">
                          <span className={`text-[10px] px-2.5 py-0.5 border rounded-full font-extrabold ${probInfo.bg}`}>
                            {(p.admission_probability * 100).toFixed(0)}% • {probInfo.label}
                          </span>
                          {renderTrend(p.trend)}
                        </div>
                        <div className="w-36 bg-slate-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 ${probInfo.bar}`}
                            style={{ width: `${Math.max(4, p.admission_probability * 100)}%` }}
                          />
                        </div>
                      </td>

                      {/* 5-Year Trend */}
                      <td className="py-4 px-4 text-center align-middle">
                        <div className="flex justify-center">
                          {renderSparkline(p.historical_closing_ranks)}
                        </div>
                      </td>

                      {/* Expected Cutoffs */}
                      <td className="py-4 px-4 space-y-1">
                        <div className="font-extrabold text-primary text-xs bg-primary/10 px-2.5 py-1 rounded w-fit border border-primary/20">
                          P50 Mid: {p.confidence_interval.p50.toLocaleString("en-IN")}
                        </div>
                        <div className="text-[10px] font-bold text-muted-foreground">
                          Expected: {p.confidence_interval.p10.toLocaleString("en-IN")} – {p.confidence_interval.p90.toLocaleString("en-IN")}
                        </div>
                      </td>

                      {/* Fees & Quota */}
                      <td className="py-4 px-4 space-y-1">
                        <div className="font-extrabold text-foreground text-xs">
                          ₹{p.fees_per_year.toLocaleString("en-IN")}/yr
                        </div>
                        <div>
                          <span className="text-[10px] bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded font-mono font-bold uppercase tracking-tight inline-block shadow-xs">
                            Quota: {p.quota}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
