import Link from "next/link";
import { Compass, Radar, ShieldCheck, FileSpreadsheet, ArrowRight, MessageCircle } from "lucide-react";
import EventsTimeline from "@/components/events-timeline";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center space-y-12 py-6 max-w-5xl mx-auto relative">
      {/* Decorative background glow for WOW factor */}
      <div className="absolute top-10 left-1/2 -translate-x-1/2 w-[350px] h-[350px] bg-gradient-to-tr from-primary/10 to-accent/10 rounded-full blur-3xl pointer-events-none -z-10"></div>
      
      {/* Hero Header */}
      <div className="text-center space-y-4 max-w-3xl">
        <span className="bg-primary/10 dark:bg-primary/20 text-primary dark:text-primary-foreground text-xs font-extrabold px-4 py-1.5 rounded-full uppercase tracking-wider shadow-sm">
          ADMIT OS • Post-Exam Operating System
        </span>
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 via-primary to-indigo-600 dark:from-slate-50 dark:via-primary dark:to-accent pt-2">
          Your Command Center After the Bell Rings
        </h1>
        <p className="text-base md:text-lg text-muted-foreground dark:text-slate-350 max-w-2xl mx-auto leading-relaxed">
          No stress. No guesswork. Make your competitive college choices using verified databases, multi-model ensemble predictions, and confidence intervals.
        </p>
      </div>

      {/* Timeline Calendar (verified dashboard) */}
      <div className="w-full">
        <EventsTimeline />
      </div>

      {/* Main CTA: Rank Radar */}
      <div className="w-full bg-gradient-to-br from-indigo-950 via-slate-950 to-emerald-950 text-white rounded-2xl p-8 border border-slate-800/60 shadow-xl dark:shadow-emerald-950/20 relative overflow-hidden group">
        <div className="absolute right-0 bottom-0 opacity-10 translate-x-12 translate-y-12 scale-150 pointer-events-none group-hover:scale-[1.6] group-hover:opacity-15 transition-all duration-700">
          <Radar className="w-64 h-64 text-emerald-400" />
        </div>
        <div className="relative z-10 max-w-xl space-y-6">
          <span className="bg-emerald-500/20 text-emerald-350 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider border border-emerald-500/30">
            Ensemble Predictor Active
          </span>
          <div className="space-y-2">
            <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight">Rank Radar: College Predictor</h2>
            <p className="text-slate-300 text-sm leading-relaxed">
              Input your competitive exam rank, category, and state. Instantly compute admission rates across 500+ top institutes, calibrated with P10/P50/P90 bootstrap resamples.
            </p>
          </div>
          <Link
            href="/rank-radar"
            className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-slate-950 font-extrabold px-6 py-3 rounded-lg shadow-lg hover:shadow-emerald-500/20 transform hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 text-sm"
          >
            Launch Rank Radar
            <ArrowRight className="w-4.5 h-4.5" />
          </Link>
        </div>
      </div>

      {/* Feature Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full">
        {/* Card 1: Counseling Compass */}
        <Link 
          href="/counsel" 
          className="bg-card border border-slate-200/60 dark:border-slate-800/40 rounded-xl p-6 shadow-sm flex flex-col justify-between hover:border-primary/50 hover:shadow-md hover:scale-[1.02] transform transition-all duration-300 text-left"
        >
          <div className="space-y-4">
            <div className="bg-primary/10 text-primary p-3 rounded-lg w-fit">
              <Compass className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h3 className="font-extrabold text-slate-850 dark:text-slate-100 flex items-center gap-2 text-sm md:text-base">
                Counseling Compass
                <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-bold">Active</span>
              </h3>
              <p className="text-muted-foreground dark:text-slate-400 text-xs leading-relaxed">
                Build, sort, and optimize your choice filling checklist using smart upgrade game optimization.
              </p>
            </div>
          </div>
          <div className="text-primary dark:text-primary-foreground text-xs font-bold flex items-center gap-1 mt-4 group">
            Open Choice Tool <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        {/* Card 2: Chat Assistant */}
        <Link 
          href="/chat" 
          className="bg-card border border-slate-200/60 dark:border-slate-800/40 rounded-xl p-6 shadow-sm flex flex-col justify-between hover:border-primary/50 hover:shadow-md hover:scale-[1.02] transform transition-all duration-300 text-left"
        >
          <div className="space-y-4">
            <div className="bg-primary/10 text-primary p-3 rounded-lg w-fit">
              <MessageCircle className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h3 className="font-extrabold text-slate-850 dark:text-slate-100 flex items-center gap-2 text-sm md:text-base">
                Chat Assistant
                <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-bold">Active</span>
              </h3>
              <p className="text-muted-foreground dark:text-slate-400 text-xs leading-relaxed">
                Ask queries on complex Seat Acceptances, Float/Freeze actions, and RAG-verified brochures.
              </p>
            </div>
          </div>
          <div className="text-primary dark:text-primary-foreground text-xs font-bold flex items-center gap-1 mt-4 group">
            Consult Agent <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>

        {/* Card 3: Branch Compass */}
        <Link 
          href="/branch" 
          className="bg-card border border-slate-200/60 dark:border-slate-800/40 rounded-xl p-6 shadow-sm flex flex-col justify-between hover:border-primary/50 hover:shadow-md hover:scale-[1.02] transform transition-all duration-300 text-left"
        >
          <div className="space-y-4">
            <div className="bg-primary/10 text-primary p-3 rounded-lg w-fit">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h3 className="font-extrabold text-slate-850 dark:text-slate-100 flex items-center gap-2 text-sm md:text-base">
                Branch Compass
                <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-bold">Active</span>
              </h3>
              <p className="text-muted-foreground dark:text-slate-400 text-xs leading-relaxed">
                Compare placement packages, transition statistics, and employment metrics from the official NIRF.
              </p>
            </div>
          </div>
          <div className="text-primary dark:text-primary-foreground text-xs font-bold flex items-center gap-1 mt-4 group">
            Compare Branches <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </Link>
      </div>

      {/* Accuracy & DPDP Notice */}
      <div className="w-full bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-xl p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 p-2 rounded-full">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-xs font-extrabold text-slate-800 dark:text-slate-100">DPDP Act & Data Accuracy Guarantee</h4>
            <p className="text-[11px] text-muted-foreground dark:text-slate-400 leading-snug">
              All processing is anonymous. Cutoffs cite verified URL sources and data confidence tiers.
            </p>
          </div>
        </div>
        <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-950 border dark:border-slate-800 px-3.5 py-2 rounded-lg shadow-sm">
          Source Accuracy: <span className="text-emerald-500 dark:text-emerald-400 font-extrabold">100% Verified</span>
        </div>
      </div>
    </div>
  );
}
