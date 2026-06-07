"use client";

import React from "react";
import { useMutation } from "@tanstack/react-query";
import { predictColleges, PredictionRequest, PredictionResponse } from "@/lib/api";
import RankRadarForm from "@/components/rank-radar-form";
import RankRadarResults from "@/components/rank-radar-results";
import { Radar, ShieldCheck } from "lucide-react";

export default function RankRadarPage() {
  const { 
    mutate, 
    data, 
    isPending, 
    error, 
    isSuccess 
  } = useMutation<PredictionResponse, Error, PredictionRequest>({
    mutationFn: predictColleges,
  });

  const handleFormSubmit = (formData: PredictionRequest) => {
    mutate(formData);
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Intro Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2.5">
            <Radar className="w-8 h-8 text-primary animate-pulse" />
            Rank Radar
          </h1>
          <p className="text-sm text-muted-foreground dark:text-slate-400 max-w-xl">
            Predict your admission probabilities based on a historical multi-model ensemble calibrated with bootstrap confidence bounds.
          </p>
        </div>
        <div className="bg-slate-100/80 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-4 py-2.5 rounded-xl flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <div className="text-left">
            <div className="text-xs font-extrabold text-foreground">DPDP Secure Mode</div>
            <div className="text-[10px] text-muted-foreground">No PII collected or logged.</div>
          </div>
        </div>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Left Side Form (1 Column) */}
        <div className="lg:col-span-1 space-y-6">
          <RankRadarForm onSubmit={handleFormSubmit} isLoading={isPending} />

          {/* Guidelines Box */}
          <div className="bg-card border border-slate-200/60 dark:border-slate-800/40 rounded-xl p-4 text-xs text-muted-foreground space-y-2.5 leading-relaxed shadow-sm">
            <h4 className="font-extrabold text-foreground">How to interpret results:</h4>
            <ul className="space-y-2 list-none">
              <li className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span><strong className="text-emerald-600 dark:text-emerald-400 font-bold">High Chance (&ge;75%)</strong>: Strong match for subsequent rounds.</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span><strong className="text-amber-600 dark:text-amber-400 font-bold">Medium Chance (40%-74%)</strong>: Moderate probability, ideal target.</span>
              </li>
              <li className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                <span><strong className="text-rose-600 dark:text-rose-450 font-bold">Low Chance (&lt;40%)</strong>: Reaching high. Keep as aspirational choice.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Right Side Results (2 Columns) */}
        <div className="lg:col-span-2 space-y-6">
          {isPending && (
            <div className="bg-card border border-slate-200/60 dark:border-slate-800/40 rounded-xl p-16 text-center space-y-4 shadow-sm">
              <div className="relative w-16 h-16 mx-auto">
                <div className="absolute inset-0 rounded-full border-4 border-primary/10"></div>
                <div className="absolute inset-0 rounded-full border-4 border-t-primary animate-spin"></div>
              </div>
              <div className="space-y-1">
                <h3 className="font-extrabold text-foreground">Running Multi-Model Ensemble</h3>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                  Aggregating historical seat matrices, difficulty indices, and category allocations...
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-6 text-center space-y-2 text-rose-700 dark:text-rose-400 shadow-sm">
              <h3 className="font-extrabold text-sm">Prediction Engine Error</h3>
              <p className="text-xs">{error.message || "An unexpected error occurred while calling predictions."}</p>
            </div>
          )}

          {!isPending && !isSuccess && (
            <div className="bg-card border border-slate-200/60 dark:border-slate-800/40 rounded-xl p-16 text-center space-y-4 shadow-sm">
              <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto">
                <Radar className="w-6 h-6 animate-pulse" />
              </div>
              <div className="space-y-1">
                <h3 className="font-extrabold text-foreground">Ready for Search</h3>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                  Fill in your competitive exam parameters on the left to predict potential college allotments.
                </p>
              </div>
            </div>
          )}

          {isSuccess && <RankRadarResults data={data} />}
        </div>
      </div>
    </div>
  );
}
