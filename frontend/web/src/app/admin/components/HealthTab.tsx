"use client";

import React from "react";
import { Database, Cpu, Activity, ShieldAlert, BarChart, Server } from "lucide-react";

interface HealthData {
  db_connection: string;
  redis_connection: string;
  total_submissions: number;
  anomalous_submissions: number;
  anomaly_rate: number;
  queue_counts: {
    unresolved: number;
    resolved: number;
    total: number;
  };
  timestamp: string;
}

interface HealthTabProps {
  data: HealthData | null;
  isLoading: boolean;
}

export default function HealthTab({ data, isLoading }: HealthTabProps) {
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-2xl p-6 h-32 animate-pulse space-y-3">
              <div className="h-4 bg-slate-100 rounded w-1/3" />
              <div className="h-8 bg-slate-100 rounded w-2/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-10 bg-white border rounded-2xl text-slate-500 text-sm">
        Diagnostics data could not be retrieved. Ensure the analytics microservice is online.
      </div>
    );
  }

  const isDbUp = data.db_connection === "healthy";
  const isRedisUp = data.redis_connection === "healthy";

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-bold text-slate-800">System Diagnostics & Telemetry</h2>
        <p className="text-xs text-slate-500">Live indicators of service connections and data pipelines.</p>
      </div>

      {/* Connection Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Postgres */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isDbUp ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-slate-800 text-sm">PostgreSQL Engine</div>
              <div className="text-[10px] text-slate-400">Stores master cutoffs & outcomes data</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${isDbUp ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
            <span className={`text-xs font-bold ${isDbUp ? "text-emerald-700" : "text-rose-700"}`}>
              {data.db_connection.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Redis */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isRedisUp ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"}`}>
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="font-bold text-slate-800 text-sm">Redis Cache Layer</div>
              <div className="text-[10px] text-slate-400">Caches public dashboard data (TTL=1h)</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${isRedisUp ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
            <span className={`text-xs font-bold ${isRedisUp ? "text-emerald-700" : "text-rose-700"}`}>
              {data.redis_connection.toUpperCase()}
            </span>
          </div>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Card 1 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-1 hover:shadow transition-shadow">
          <div className="text-slate-400 text-xs font-bold uppercase tracking-wide">Total Outcomes Submitted</div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-800">{data.total_submissions}</span>
            <span className="text-[10px] text-slate-400 font-medium">submissions</span>
          </div>
        </div>

        {/* Card 2 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-1 hover:shadow transition-shadow">
          <div className="text-slate-400 text-xs font-bold uppercase tracking-wide">Anomalies Detected</div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-amber-600">{data.anomalous_submissions}</span>
            <span className="text-[10px] text-slate-400 font-medium">flagged</span>
          </div>
        </div>

        {/* Card 3 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-1 hover:shadow transition-shadow">
          <div className="text-slate-400 text-xs font-bold uppercase tracking-wide">Anomaly Rate</div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-800">{(data.anomaly_rate * 100).toFixed(2)}%</span>
            <span className="text-[10px] text-slate-400 font-medium">overall submissions</span>
          </div>
        </div>

        {/* Card 4 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-1 hover:shadow transition-shadow">
          <div className="text-slate-400 text-xs font-bold uppercase tracking-wide">Review Queue Items</div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-blue-900">{data.queue_counts.unresolved}</span>
            <span className="text-[10px] text-slate-400 font-medium">pending resolution</span>
          </div>
        </div>
      </div>

      {/* Compliance / Security Warning Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 flex gap-4">
        <Server className="w-6 h-6 text-blue-900 flex-shrink-0" />
        <div className="space-y-1.5">
          <h4 className="text-sm font-bold text-blue-900">DPDP Act 2023 Compliance Monitor</h4>
          <p className="text-xs text-blue-800 leading-relaxed font-medium">
            This analytics panel displays metadata and aggregate telemetry only. In compliance with Chapter II Section 5 of the DPDP Act 2023, Student PII (Names, Phone Numbers, Emails) is strictly restricted to secure auth tables and never cached, written to server logs, or displayed on dashboards.
          </p>
        </div>
      </div>
    </div>
  );
}
