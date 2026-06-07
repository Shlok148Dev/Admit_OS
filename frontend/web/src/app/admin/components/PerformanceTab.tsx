"use client";

import React from "react";
import { BarChart3, TrendingUp, Compass, Award } from "lucide-react";

interface ExamDetail {
  total_evaluated: number;
  mae: number;
  accuracy_within_300: number;
  accuracy_within_500: number;
}

interface PerformanceData {
  total_prediction_logs: number;
  evaluated_prediction_logs: number;
  overall: {
    mae: number | null;
    accuracy_within_300: number | null;
    accuracy_within_500: number | null;
  };
  by_exam?: Record<string, ExamDetail>;
  timestamp: string;
  status?: string;
}

interface PerformanceTabProps {
  data: PerformanceData | null;
  isLoading: boolean;
}

export default function PerformanceTab({ data, isLoading }: PerformanceTabProps) {
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="bg-white border rounded-2xl p-6 h-64 animate-pulse" />
        <div className="bg-white border rounded-2xl p-6 h-64 animate-pulse" />
      </div>
    );
  }

  if (!data || data.status === "Insufficient outcomes data for validation") {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center space-y-3 shadow-sm">
        <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-400">
          <BarChart3 className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="font-bold text-slate-800 text-base">Insufficient Data for Shadow Validation</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Once students submit allotment outcomes, the system compares predictions against ground-truth and displays MAE (Mean Absolute Error) metrics.
          </p>
        </div>
      </div>
    );
  }

  const { overall, by_exam } = data;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-bold text-slate-800">Shadow Testing & Model Accuracy</h2>
        <p className="text-xs text-slate-500">Evaluated nightly using student-reported outcomes against our predictor closing ranks.</p>
      </div>

      {/* Main stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-blue-900 to-blue-950 text-white rounded-2xl p-6 shadow-md relative overflow-hidden">
          <div className="absolute right-[-10px] bottom-[-10px] opacity-10">
            <Compass className="w-28 h-28" />
          </div>
          <div className="text-blue-200 text-xs font-semibold uppercase tracking-wider">Overall MAE Error</div>
          <div className="text-4xl font-black mt-2">{overall.mae ? `${overall.mae.toFixed(1)}` : "N/A"}</div>
          <p className="text-[10px] text-blue-200 mt-2 font-medium">Mean Absolute Error in ranks</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div className="text-slate-400 text-xs font-bold uppercase tracking-wide">Accuracy within 300 Ranks</div>
          <div className="text-3xl font-extrabold text-slate-800 mt-2">
            {overall.accuracy_within_300 ? `${(overall.accuracy_within_300 * 100).toFixed(1)}%` : "N/A"}
          </div>
          <div className="w-full bg-slate-100 h-2 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full"
              style={{ width: `${(overall.accuracy_within_300 || 0) * 100}%` }}
            />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div className="text-slate-400 text-xs font-bold uppercase tracking-wide">Accuracy within 500 Ranks</div>
          <div className="text-3xl font-extrabold text-slate-800 mt-2">
            {overall.accuracy_within_500 ? `${(overall.accuracy_within_500 * 100).toFixed(1)}%` : "N/A"}
          </div>
          <div className="w-full bg-slate-100 h-2 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full"
              style={{ width: `${(overall.accuracy_within_500 || 0) * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Breakdown by Exam */}
      {by_exam && Object.keys(by_exam).length > 0 && (
        <div className="space-y-4">
          <h3 className="font-bold text-slate-800 text-sm">Accuracy Breakdown by Exam</h3>
          <div className="grid gap-4">
            {Object.entries(by_exam).map(([exam, detail]) => (
              <div key={exam} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex justify-between items-center border-b pb-3 border-slate-100">
                  <div className="flex items-center gap-2">
                    <Award className="w-4 h-4 text-emerald-600" />
                    <span className="font-bold text-slate-800 text-xs">{exam}</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase">
                    {detail.total_evaluated} sample logs evaluated
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase">MAE Error</div>
                    <div className="text-xl font-bold text-slate-800 mt-1">{detail.mae.toFixed(1)} ranks</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Acc (Within 300)</div>
                    <div className="text-xl font-bold text-slate-800 mt-1">{(detail.accuracy_within_300 * 100).toFixed(1)}%</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase">Acc (Within 500)</div>
                    <div className="text-xl font-bold text-slate-800 mt-1">{(detail.accuracy_within_500 * 100).toFixed(1)}%</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
