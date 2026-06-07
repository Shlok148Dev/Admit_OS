"use client";

import React, { useState } from "react";
import { X, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Prediction } from "@/lib/api";

interface OutcomeReportModalProps {
  prediction: Prediction;
  examType: string;
  onClose: () => void;
}

export default function OutcomeReportModal({ prediction, examType, onClose }: OutcomeReportModalProps) {
  const [round, setRound] = useState(1);
  // Default to a reasonable rank
  const [studentRank, setStudentRank] = useState(prediction.confidence_interval.p50);
  const [sourceUrl, setSourceUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg("");

    // Fallback development JWT token signed with super-secret-key-12345
    let token = localStorage.getItem("accessToken") || localStorage.getItem("token") || sessionStorage.getItem("token");
    if (!token) {
      token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwidHlwZSI6ImFjY2VzcyIsImV4cCI6MjA5NTkzNDE3NH0.fqCmiT-3_SkJatL6gvApBCus0nJpgE5megY1DURA7Mw";
    }

    const payload = {
      exam_type: examType,
      counseling_body: examType === "NEET" ? "MCC" : examType === "MHT_CET" ? "MHT-CET" : "JoSAA",
      year: 2026,
      round_number: Number(round),
      college_code: prediction.college_code,
      branch_code: prediction.branch_code,
      category: prediction.quota === "HS" || prediction.quota === "OS" ? "GENERAL" : "OPEN", // fallback standard categories
      quota: prediction.quota,
      student_rank: Number(studentRank),
      source_url: sourceUrl || undefined
    };

    try {
      const res = await fetch("/v1/outcomes/submit", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setSuccess(true);
        setTimeout(() => {
          onClose();
        }, 2200);
      } else {
        const errData = await res.json().catch(() => ({}));
        setErrorMsg(errData.detail || "Failed to submit outcome verification.");
      }
    } catch (err) {
      setErrorMsg("Error contacting analytics service. Ensure it is running.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full shadow-2xl p-6 relative overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-start mb-5">
          <div>
            <h3 className="font-black text-slate-800 text-lg leading-tight">Report Seat Allotment</h3>
            <p className="text-xs text-slate-500 mt-1">Help audit model accuracy and build trusted predictions.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-650 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {success ? (
          <div className="py-8 text-center space-y-3">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="font-bold text-slate-800">Outcome Logged Successfully</h4>
              <p className="text-xs text-slate-500">Thank you for validating model precision.</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* College details summary */}
            <div className="bg-slate-50 border rounded-2xl p-3.5 space-y-1">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{prediction.college_name}</div>
              <div className="text-xs font-bold text-slate-800">Branch: {prediction.branch_name} ({prediction.branch_code})</div>
              <div className="text-[10px] text-slate-500 font-medium">Exam: {examType} | Quota: {prediction.quota}</div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Counseling Round</label>
                <select
                  value={round}
                  onChange={(e) => setRound(Number(e.target.value))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-900/10 focus:border-blue-900 bg-white cursor-pointer font-medium text-slate-700"
                >
                  {[1, 2, 3, 4, 5, 6].map((r) => (
                    <option key={r} value={r}>Round {r}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Your Allotment Rank</label>
                <input
                  type="number"
                  required
                  value={studentRank}
                  onChange={(e) => setStudentRank(Number(e.target.value))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-900/10 focus:border-blue-900 font-semibold text-slate-700"
                  placeholder="Enter rank"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Official Allotment List PDF Link (Optional)</label>
              <input
                type="url"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-900/10 focus:border-blue-900 text-slate-700 font-medium"
                placeholder="https://josaa.admissions.nic.in/..."
              />
            </div>

            {errorMsg && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 flex gap-2 text-rose-800 text-xs font-semibold">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-blue-900 hover:bg-blue-950 text-white rounded-xl py-2.5 text-xs font-bold transition-all shadow-md shadow-blue-100 flex items-center justify-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Submitting Audit...
                </>
              ) : (
                "Verify and Submit Outcome"
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
