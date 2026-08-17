"use client";

import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { compareBranches, BRANCH_STATS_MOCK } from "@/lib/api";
import Link from "next/link";
import { 
  GitCompare, 
  ArrowRight, 
  TrendingUp, 
  Building2, 
  Percent, 
  ShieldCheck, 
  DollarSign,
  GraduationCap,
  Sparkles
} from "lucide-react";

export default function BranchCompassPage() {
  const [branch1, setBranch1] = useState("CS");
  const [branch2, setBranch2] = useState("EC");

  // Query comparison data
  const { data: comparisonData, isLoading, error } = useQuery({
    queryKey: ["compare-branches", branch1, branch2],
    queryFn: () => compareBranches(branch1, branch2),
    retry: false,
  });

  if (error) {
    return (
      <div className="p-8 text-center max-w-xl mx-auto my-12 bg-red-50 border border-red-200 rounded-2xl space-y-4">
        <h2 className="text-lg font-bold text-red-800">Branch Comparison Service Offline</h2>
        <p className="text-sm text-red-600">The career database comparison service is currently unavailable. Please verify with official documentation.</p>
      </div>
    );
  }

  const b1 = comparisonData?.b1Stats;
  const b2 = comparisonData?.b2Stats;
  const insight = comparisonData?.insight || "Select branches to compare their career packages, NIRF ratings, and placement percentages.";

  return (
    <div className="space-y-8 max-w-6xl mx-auto py-2">
      {/* Intro Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 border-b border-slate-200 dark:border-slate-800 pb-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2.5">
            <GitCompare className="w-8 h-8 text-primary" />
            Branch Compass
          </h1>
          <p className="text-sm text-muted-foreground dark:text-slate-400 max-w-xl">
            Compare salary packages, placement ratios, career progression vectors, and top recruiters across branches using verified NIRF databases.
          </p>
        </div>
        <div className="bg-emerald-55/10 text-emerald-800 dark:text-emerald-400 border border-emerald-500/20 px-4 py-2.5 rounded-xl flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          <div className="text-left">
            <div className="text-xs font-extrabold text-foreground">Verified Database</div>
            <div className="text-[10px] text-muted-foreground">Official NIRF & SME disclosures.</div>
          </div>
        </div>
      </div>

      {/* Selectors Panel */}
      <div className="bg-card border border-slate-200/60 dark:border-slate-800/40 rounded-xl p-5 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-705 dark:text-slate-350 block">Primary Branch</label>
            <select
              value={branch1}
              onChange={(e) => setBranch1(e.target.value)}
              className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            >
              {Object.keys(BRANCH_STATS_MOCK).map((code) => (
                <option key={code} value={code} disabled={code === branch2}>
                  {BRANCH_STATS_MOCK[code].branch_name} ({code})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-705 dark:text-slate-350 block">Comparison Branch</label>
            <select
              value={branch2}
              onChange={(e) => setBranch2(e.target.value)}
              className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
            >
              {Object.keys(BRANCH_STATS_MOCK).map((code) => (
                <option key={code} value={code} disabled={code === branch1}>
                  {BRANCH_STATS_MOCK[code].branch_name} ({code})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* AI Compare Insight Card */}
      <div className="bg-gradient-to-br from-indigo-950 via-slate-950 to-primary/80 border border-slate-800/60 text-white rounded-2xl p-6 shadow-md relative overflow-hidden group">
        <div className="absolute right-0 top-0 opacity-10 translate-x-5 -translate-y-5 scale-125 pointer-events-none group-hover:scale-150 transition-all duration-700">
          <Sparkles className="w-48 h-48 text-primary" />
        </div>
        <div className="relative z-10 space-y-3">
          <span className="bg-emerald-500/20 text-emerald-350 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5 w-fit border border-emerald-500/30">
            <Sparkles className="w-3.5 h-3.5" /> AI Comparative Insight
          </span>
          <p className="text-sm text-slate-300 leading-relaxed font-medium">
            {isLoading ? "Analyzing database structures and salary curves..." : insight}
          </p>
        </div>
      </div>

      {/* Statistics Stack Columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Column 1: Branch 1 Statistics */}
        <div className="bg-card border border-slate-200/60 dark:border-slate-800/40 rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-slate-50/70 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 p-5 flex justify-between items-center">
            <div>
              <span className="bg-primary/10 text-primary border border-primary/20 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase font-mono">{b1.branch_code}</span>
              <h3 className="text-base font-extrabold text-foreground mt-1.5">{b1.branch_name}</h3>
            </div>
            <Link
              href={`/branch/${b1.branch_code}`}
              className="inline-flex items-center gap-1 text-xs text-primary font-bold hover:underline"
            >
              Details <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="p-6 space-y-6">
            {/* Median Salary */}
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-lg">
                <DollarSign className="w-6 h-6" />
              </div>
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-muted-foreground">Median Salary Package</div>
                <div className="text-xl font-extrabold text-foreground">₹{(b1.median_salary / 100000).toFixed(1)} LPA</div>
              </div>
            </div>

            {/* Highest Salary */}
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 text-primary border border-primary/20 rounded-lg">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-muted-foreground">Highest Salary (NIRF Verified)</div>
                <div className="text-xl font-extrabold text-foreground">₹{(b1.highest_salary / 100000).toFixed(1)} LPA</div>
              </div>
            </div>

            {/* Placement Percentage */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold text-slate-705 dark:text-slate-350">
                <span className="flex items-center gap-1"><Percent className="w-3.5 h-3.5 text-slate-500" /> Placement Rate</span>
                <span className="text-primary font-extrabold">{b1.placement_percentage}%</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full" style={{ width: `${b1.placement_percentage}%` }} />
              </div>
            </div>

            {/* Growth & Reputation */}
            <div className="grid grid-cols-2 gap-4 border-t border-slate-200 dark:border-slate-800/80 pt-4">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">NIRF Reputation</span>
                <span className="text-base font-extrabold text-foreground">{b1.nirf_reputation_score} / 10</span>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Sector Growth</span>
                <span className="text-base font-extrabold text-foreground">{b1.growth_index} / 10</span>
              </div>
            </div>

            {/* Top Recruiters */}
            <div className="border-t border-slate-200 dark:border-slate-800/80 pt-4 space-y-2.5">
              <span className="text-xs font-bold text-slate-705 dark:text-slate-350 block flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-slate-400" /> Top Recruiting Entities
              </span>
              <div className="flex flex-wrap gap-1.5">
                {b1.top_companies.map((co) => (
                  <span key={co} className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 text-[10px] px-2.5 py-1 rounded font-bold shadow-sm">
                    {co}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Column 2: Branch 2 Statistics */}
        <div className="bg-card border border-slate-200/60 dark:border-slate-800/40 rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-slate-50/70 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 p-5 flex justify-between items-center">
            <div>
              <span className="bg-primary/10 text-primary border border-primary/20 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase font-mono">{b2.branch_code}</span>
              <h3 className="text-base font-extrabold text-foreground mt-1.5">{b2.branch_name}</h3>
            </div>
            <Link
              href={`/branch/${b2.branch_code}`}
              className="inline-flex items-center gap-1 text-xs text-primary font-bold hover:underline"
            >
              Details <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="p-6 space-y-6">
            {/* Median Salary */}
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-lg">
                <DollarSign className="w-6 h-6" />
              </div>
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-muted-foreground">Median Salary Package</div>
                <div className="text-xl font-extrabold text-foreground">₹{(b2.median_salary / 100000).toFixed(1)} LPA</div>
              </div>
            </div>

            {/* Highest Salary */}
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 text-primary border border-primary/20 rounded-lg">
                <TrendingUp className="w-6 h-6" />
              </div>
              <div className="space-y-0.5">
                <div className="text-xs font-semibold text-muted-foreground">Highest Salary (NIRF Verified)</div>
                <div className="text-xl font-extrabold text-foreground">₹{(b2.highest_salary / 100000).toFixed(1)} LPA</div>
              </div>
            </div>

            {/* Placement Percentage */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold text-slate-705 dark:text-slate-350">
                <span className="flex items-center gap-1"><Percent className="w-3.5 h-3.5 text-slate-500" /> Placement Rate</span>
                <span className="text-primary font-extrabold">{b2.placement_percentage}%</span>
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                <div className="bg-emerald-500 h-full" style={{ width: `${b2.placement_percentage}%` }} />
              </div>
            </div>

            {/* Growth & Reputation */}
            <div className="grid grid-cols-2 gap-4 border-t border-slate-200 dark:border-slate-800/80 pt-4">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">NIRF Reputation</span>
                <span className="text-base font-extrabold text-foreground">{b2.nirf_reputation_score} / 10</span>
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Sector Growth</span>
                <span className="text-base font-extrabold text-foreground">{b2.growth_index} / 10</span>
              </div>
            </div>

            {/* Top Recruiters */}
            <div className="border-t border-slate-200 dark:border-slate-800/80 pt-4 space-y-2.5">
              <span className="text-xs font-bold text-slate-705 dark:text-slate-350 block flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-slate-400" /> Top Recruiting Entities
              </span>
              <div className="flex flex-wrap gap-1.5">
                {b2.top_companies.map((co) => (
                  <span key={co} className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 text-slate-700 dark:text-slate-300 text-[10px] px-2.5 py-1 rounded font-bold shadow-sm">
                    {co}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Recommended Colleges List */}
      <div className="bg-card border border-slate-200/60 dark:border-slate-800/40 rounded-2xl shadow-sm p-6 space-y-4">
        <h3 className="text-base font-extrabold text-foreground flex items-center gap-2">
          <GraduationCap className="w-5 h-5 text-primary" /> Recommended Institutions based on comparison
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { name: "IIT Madras", rank: "#1 NIRF", type: "IIT", fee: "₹2.2L/yr", desc: "Top choice for VLSI (EC) and Core Systems (EE, CS)." },
            { name: "NIT Trichy", rank: "#8 NIRF", type: "NIT", fee: "₹1.4L/yr", desc: "Highest average package for ECE and Computer Science." },
            { name: "COEP Pune", rank: "#73 NIRF", type: "STATE", fee: "₹1.3L/yr", desc: "Strong state quota matches for CAP round choices." }
          ].map((col, idx) => (
            <div key={idx} className="border border-slate-200 dark:border-slate-800/60 p-4 rounded-xl space-y-2 hover:bg-slate-50/50 dark:hover:bg-slate-900/10 transition-colors">
              <div className="flex justify-between items-center">
                <span className="font-bold text-foreground text-sm">{col.name}</span>
                <span className="text-[9px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded font-extrabold font-mono">{col.rank}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-snug">{col.desc}</p>
              <div className="flex justify-between items-center text-[10px] font-bold text-muted-foreground mt-2 border-t border-slate-100 dark:border-slate-800/60 pt-2">
                <span>Type: {col.type}</span>
                <span>Fees: {col.fee}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
