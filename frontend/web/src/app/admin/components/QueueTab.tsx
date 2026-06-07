"use client";

import React, { useState } from "react";
import { CheckCircle2, XCircle, AlertTriangle, ExternalLink, Loader2 } from "lucide-react";

interface QueueItem {
  id: number;
  exam_type: string;
  counseling_body: string;
  year: number;
  round_number: number;
  college_code: string;
  branch_code: string;
  category: string;
  quota: string;
  opening_rank: number;
  closing_rank: number;
  source_url: string;
  reason: string;
  resolved: boolean;
  submission_id?: number;
}

interface QueueTabProps {
  items: QueueItem[];
  isLoading: boolean;
  authHeader: string;
  onRefresh: () => void;
}

export default function QueueTab({ items, isLoading, authHeader, onRefresh }: QueueTabProps) {
  const [resolvingId, setResolvingId] = useState<number | null>(null);

  const handleResolve = async (id: number, approve: boolean) => {
    setResolvingId(id);
    try {
      const res = await fetch(`/v1/analytics/admin/queue/${id}/resolve?approve=${approve}`, {
        method: "POST",
        headers: {
          "Authorization": authHeader,
          "Content-Type": "application/json"
        }
      });
      if (res.ok) {
        onRefresh();
      } else {
        alert("Failed to resolve item");
      }
    } catch (e) {
      console.error(e);
      alert("Error contacting analytics service");
    } finally {
      setResolvingId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
        <p className="text-slate-500 text-sm">Loading Subject-Matter Expert review queue...</p>
      </div>
    );
  }

  const unresolvedItems = items.filter((item) => !item.resolved);

  if (unresolvedItems.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center space-y-3 shadow-sm">
        <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-600">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <div className="space-y-1">
          <h3 className="font-bold text-slate-800 text-base">All clear!</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            There are no unresolved anomaly submissions in the SME queue. All ground-truth inputs are verified.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-lg font-bold text-slate-800">SME Verification Queue</h2>
          <p className="text-xs text-slate-500">Review anomalous outcomes flagged by validation rules.</p>
        </div>
        <span className="text-xs bg-amber-50 border border-amber-200 text-amber-800 font-semibold px-2.5 py-1 rounded-full">
          {unresolvedItems.length} Unresolved
        </span>
      </div>

      <div className="grid gap-4">
        {unresolvedItems.map((item) => {
          const isHighRisk = item.reason.includes(">20% worse");
          return (
            <div
              key={item.id}
              className={`bg-white border rounded-2xl p-5 shadow-sm transition-all hover:shadow-md flex flex-col md:flex-row justify-between gap-5 relative overflow-hidden ${
                isHighRisk ? "border-amber-300 bg-amber-50/20" : "border-slate-200"
              }`}
            >
              {isHighRisk && (
                <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500 animate-pulse" />
              )}
              
              <div className="space-y-3 flex-1">
                {/* Header tags */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="bg-blue-900 text-white font-mono text-[9px] font-bold px-2 py-0.5 rounded uppercase">
                    {item.exam_type}
                  </span>
                  <span className="bg-slate-100 border text-slate-700 font-mono text-[9px] font-bold px-2 py-0.5 rounded">
                    R{item.round_number} ({item.year})
                  </span>
                  <span className="bg-emerald-50 border border-emerald-200 text-emerald-800 font-mono text-[9px] font-bold px-2 py-0.5 rounded uppercase">
                    Quota: {item.quota} | {item.category}
                  </span>
                </div>

                {/* College Info */}
                <div>
                  <h3 className="font-bold text-slate-800 text-sm leading-tight">
                    {item.college_code}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Branch: {item.branch_code} | Student Rank Claim:{" "}
                    <span className="font-bold text-slate-700">{item.opening_rank.toLocaleString("en-IN")}</span>
                  </p>
                </div>

                {/* Anomalous notice and reasons */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <div className="text-[10px] font-bold text-slate-700">Flagged Reason:</div>
                    <p className="text-[10px] text-slate-600 leading-relaxed font-medium">{item.reason}</p>
                  </div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex flex-row md:flex-col justify-end items-center gap-2.5 md:min-w-[150px] border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
                <a
                  href={item.source_url}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full inline-flex items-center justify-center gap-1 border border-slate-200 text-slate-600 hover:text-blue-900 hover:bg-slate-50 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                >
                  Verify Source
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <div className="flex w-full gap-2">
                  <button
                    disabled={resolvingId !== null}
                    onClick={() => handleResolve(item.id, true)}
                    className="flex-1 inline-flex items-center justify-center gap-1 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm shadow-emerald-100"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Approve
                  </button>
                  <button
                    disabled={resolvingId !== null}
                    onClick={() => handleResolve(item.id, false)}
                    className="flex-1 inline-flex items-center justify-center gap-1 bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-sm shadow-rose-100"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Reject
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
