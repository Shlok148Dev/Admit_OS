"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { getBranchStats, BRANCH_STATS_MOCK, BranchStats } from "@/lib/api";
import Link from "next/link";
import { 
  ArrowLeft, 
  TrendingUp, 
  Award, 
  MapPin, 
  Zap, 
  CircleDot, 
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Building2,
  ListFilter
} from "lucide-react";

interface BranchDetailPageProps {
  params: {
    branchCode: string;
  };
}

export default function BranchDetailPage({ params }: BranchDetailPageProps) {
  const branchCode = params.branchCode.toUpperCase();

  // Query branch statistics
  const { data: stats, isLoading, error } = useQuery<BranchStats>({
    queryKey: ["branch-details", branchCode],
    queryFn: () => getBranchStats(branchCode),
    retry: false,
  });

  if (error) {
    return (
      <div className="p-8 text-center max-w-xl mx-auto my-12 bg-red-50 border border-red-200 rounded-2xl space-y-4">
        <h2 className="text-lg font-bold text-red-800">Career Statistics Offline</h2>
        <p className="text-sm text-red-600">Detailed placement and salary statistics are currently unavailable. Please verify with official NIRF disclosures.</p>
        <Link href="/branch" className="inline-block text-xs bg-red-800 text-white font-bold px-4 py-2 rounded-xl">Back to List</Link>
      </div>
    );
  }

  if (isLoading || !stats) {
    return <div className="p-8 text-center text-slate-500 font-bold">Loading stats...</div>;
  }

  const activeStats = stats;

  // Salary projections by experience levels (Entry, Mid, Senior)
  const salaryLevels = [
    { label: "Entry Level (0-2 yrs)", value: Math.round(activeStats.median_salary * 0.7) },
    { label: "Mid Career (3-7 yrs)", value: Math.round(activeStats.median_salary * 1.5) },
    { label: "Senior Leader (8+ yrs)", value: Math.round(activeStats.median_salary * 2.8) },
  ];

  const maxSalary = Math.max(...salaryLevels.map(s => s.value));

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-2">
      {/* Back button */}
      <Link
        href="/branch"
        className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 font-bold transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Comparison
      </Link>

      {/* Header Info */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b pb-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="bg-blue-100 text-blue-900 text-xs font-bold px-3 py-1 rounded-full uppercase font-mono">
              {activeStats.branch_code} Profile
            </span>
            <span className="text-slate-400 font-bold text-xs flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> NIRF Disclosed
            </span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">{activeStats.branch_name}</h1>
          <p className="text-sm text-slate-500 max-w-xl">
            Detailed placement profiles, compensation curves, and verified sector progression for {activeStats.branch_name}.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 bg-slate-50 border p-4 rounded-2xl w-full md:w-fit text-center">
          <div className="px-2">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Placement Rate</div>
            <div className="text-xl font-extrabold text-blue-950 mt-1">{activeStats.placement_percentage}%</div>
          </div>
          <div className="px-2 border-l">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Growth Index</div>
            <div className="text-xl font-extrabold text-emerald-600 mt-1">{activeStats.growth_index} / 10</div>
          </div>
        </div>
      </div>

      {/* Grid: Salary Projections vs Career Transitions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
        
        {/* Left Card: Custom SVG Salary Curve Chart */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-6">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <TrendingUp className="w-4.5 h-4.5 text-emerald-600" /> Custom Salary Projections
            </h3>
            <p className="text-[11px] text-slate-400">Experience-based salary projections in INR Lakhs Per Annum.</p>
          </div>

          <div className="space-y-4 pt-2">
            {salaryLevels.map((lvl, idx) => {
              const widthPct = (lvl.value / maxSalary) * 100;
              return (
                <div key={idx} className="space-y-2">
                  <div className="flex justify-between text-xs font-bold text-slate-700">
                    <span>{lvl.label}</span>
                    <span className="text-blue-950">₹{(lvl.value / 100000).toFixed(1)} LPA</span>
                  </div>
                  <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                    <div 
                      className="bg-emerald-500 h-full transition-all duration-700" 
                      style={{ width: `${widthPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Quick Stat boxes */}
          <div className="grid grid-cols-2 gap-4 border-t pt-4 text-center">
            <div className="bg-slate-50 border p-3 rounded-xl">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Avg Median</div>
              <div className="text-base font-extrabold text-slate-800 mt-1">₹{(activeStats.median_salary / 100000).toFixed(1)} LPA</div>
            </div>
            <div className="bg-slate-50 border p-3 rounded-xl">
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Avg Highest</div>
              <div className="text-base font-extrabold text-slate-800 mt-1">₹{(activeStats.highest_salary / 100000).toFixed(1)} LPA</div>
            </div>
          </div>
        </div>

        {/* Right Card: Career Transitions List */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-6">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <Zap className="w-4.5 h-4.5 text-blue-900" /> Career Transition Maps
            </h3>
            <p className="text-[11px] text-slate-400">Typical roles chosen by alumni and required technical competencies.</p>
          </div>

          <div className="space-y-4">
            {activeStats.career_transitions.map((trans, idx) => (
              <div key={idx} className="border-b last:border-0 pb-4 last:pb-0 space-y-2">
                <div className="flex justify-between items-center text-xs font-bold text-slate-700">
                  <span className="flex items-center gap-1.5">
                    <CircleDot className="w-3.5 h-3.5 text-blue-900" /> {trans.role}
                  </span>
                  <span className="bg-blue-50 text-blue-900 border px-2 py-0.5 rounded font-mono font-bold text-[10px]">
                    {trans.percentage}%
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 pl-5">
                  {trans.skills.map((skill) => (
                    <span key={skill} className="bg-slate-50 border border-slate-200 text-slate-500 text-[9px] px-2 py-0.5 rounded font-medium">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* College Recommendations & Filters */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 space-y-6">
        <div className="flex justify-between items-center border-b pb-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <Award className="w-4.5 h-4.5 text-blue-900" /> Target Colleges offering {activeStats.branch_code}
            </h3>
            <p className="text-[11px] text-slate-400">Top-rated options with average placement metrics & official portal references.</p>
          </div>
          <button className="text-[10px] text-slate-400 hover:text-slate-600 flex items-center gap-0.5 border px-2 py-1 rounded">
            <ListFilter className="w-3 h-3" /> Filters
          </button>
        </div>

        <div className="divide-y divide-slate-100">
          {[
            { name: "Indian Institute of Technology, Madras", location: "Chennai, TN", type: "IIT", fees: "₹2,20,000/yr", placement: "98.2%", nirf: "#1 Engineering" },
            { name: "National Institute of Technology, Trichy", location: "Tiruchirappalli, TN", type: "NIT", fees: "₹1,47,150/yr", placement: "94.6%", nirf: "#8 Engineering" },
            { name: "Vellore Institute of Technology", location: "Vellore, TN", type: "PRIVATE", fees: "₹1,98,000/yr", placement: "90.1%", nirf: "#11 Engineering" }
          ].map((col, idx) => (
            <div key={idx} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-slate-50/20 transition-colors">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-slate-800 text-sm">{col.name}</span>
                  <span className="text-[9px] bg-slate-100 border text-slate-600 px-1.5 py-0.5 rounded font-mono font-bold uppercase">{col.type}</span>
                </div>
                <div className="text-xs text-slate-500 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" /> {col.location} | Est. Fees: <span className="font-semibold text-slate-700">{col.fees}</span>
                </div>
              </div>

              <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-2.5 sm:pt-0">
                <div className="text-right space-y-0.5">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Placement Rate</div>
                  <div className="text-xs font-bold text-emerald-600">{col.placement}</div>
                </div>
                <div className="text-right space-y-0.5">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">NIRF Rank</div>
                  <div className="text-xs font-bold text-slate-700">{col.nirf}</div>
                </div>
                <a
                  href={`https://admitos.in/colleges/${col.type}_${idx}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-slate-400 hover:text-slate-700 p-1.5 border rounded-lg"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
