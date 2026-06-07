"use client";

import React, { useState, useEffect } from "react";
import { Lock, ShieldCheck, RefreshCw, LogOut } from "lucide-react";
import QueueTab from "./components/QueueTab";
import HealthTab from "./components/HealthTab";
import PerformanceTab from "./components/PerformanceTab";

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  const [activeTab, setActiveTab] = useState<"queue" | "health" | "performance">("queue");
  const [queueItems, setQueueItems] = useState([]);
  const [healthData, setHealthData] = useState(null);
  const [performanceData, setPerformanceData] = useState(null);

  const [isLoading, setIsLoading] = useState(false);

  // Retrieve basic auth details from state/session
  const getAuthHeader = () => {
    return "Basic " + btoa(`${username}:${password}`);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === "admin" && password === "admin_secure_pass123") {
      setIsAuthenticated(true);
      setLoginError("");
      sessionStorage.setItem("admin_user", username);
      sessionStorage.setItem("admin_pass", password);
    } else {
      setLoginError("Invalid username or password");
    }
  };

  useEffect(() => {
    // Restore session on mount
    const savedUser = sessionStorage.getItem("admin_user");
    const savedPass = sessionStorage.getItem("admin_pass");
    if (savedUser && savedPass) {
      setUsername(savedUser);
      setPassword(savedPass);
      setIsAuthenticated(true);
    }
  }, []);

  const fetchData = async () => {
    if (!isAuthenticated) return;
    setIsLoading(true);
    const headers = {
      "Authorization": getAuthHeader(),
      "Content-Type": "application/json"
    };

    try {
      // 1. Fetch queue items
      const qRes = await fetch("/v1/analytics/admin/queue", { headers });
      if (qRes.ok) setQueueItems(await qRes.json());

      // 2. Fetch health data
      const hRes = await fetch("/v1/analytics/admin/health", { headers });
      if (hRes.ok) setHealthData(await hRes.json());

      // 3. Fetch performance data
      const pRes = await fetch("/v1/analytics/admin/performance", { headers });
      if (pRes.ok) setPerformanceData(await pRes.json());

    } catch (e) {
      console.error("Error loading analytics data:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUsername("");
    setPassword("");
    sessionStorage.removeItem("admin_user");
    sessionStorage.removeItem("admin_pass");
  };

  // Login view if unauthenticated
  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center py-20 px-4">
        <form onSubmit={handleLogin} className="bg-white border border-slate-200 rounded-3xl p-8 max-w-md w-full shadow-lg space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-blue-50 text-blue-900 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
              <Lock className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-black text-slate-800">ADMIT OS Admin</h1>
            <p className="text-xs text-slate-500">Sign in to access SME Review and telemetry systems.</p>
          </div>

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600">Username</label>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900/10 focus:border-blue-900"
                placeholder="Enter admin username"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-900/10 focus:border-blue-900"
                placeholder="Enter password"
              />
            </div>
            {loginError && <p className="text-rose-600 text-xs font-bold text-center">{loginError}</p>}
          </div>

          <button
            type="submit"
            className="w-full bg-blue-900 hover:bg-blue-950 text-white rounded-xl py-2.5 text-sm font-bold transition-all shadow-md shadow-blue-100"
          >
            Authenticate Access
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      {/* Admin header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shadow-inner">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-black text-slate-800">SME Verification Panel</h1>
            <p className="text-xs text-slate-400">Authenticated as Subject-Matter Expert: Admin</p>
          </div>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="flex-1 md:flex-initial inline-flex items-center justify-center gap-1.5 border border-slate-200 text-slate-600 hover:bg-slate-50 px-4 py-2 rounded-xl text-xs font-semibold transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} /> Refresh
          </button>
          <button
            onClick={handleLogout}
            className="inline-flex items-center justify-center gap-1.5 border border-rose-200 hover:bg-rose-50 text-rose-600 px-4 py-2 rounded-xl text-xs font-semibold transition-all"
          >
            <LogOut className="w-3.5 h-3.5" /> Sign Out
          </button>
        </div>
      </div>

      {/* Tabs list */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveTab("queue")}
          className={`pb-3 text-xs font-bold transition-all relative ${
            activeTab === "queue" ? "text-blue-900" : "text-slate-400 hover:text-slate-600"
          }`}
        >
          Verification Queue
          {activeTab === "queue" && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-900 rounded-full" />}
        </button>
        <button
          onClick={() => setActiveTab("health")}
          className={`pb-3 text-xs font-bold transition-all relative ${
            activeTab === "health" ? "text-blue-900" : "text-slate-400 hover:text-slate-600"
          }`}
        >
          Health Diagnostics
          {activeTab === "health" && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-900 rounded-full" />}
        </button>
        <button
          onClick={() => setActiveTab("performance")}
          className={`pb-3 text-xs font-bold transition-all relative ${
            activeTab === "performance" ? "text-blue-900" : "text-slate-400 hover:text-slate-600"
          }`}
        >
          Model Performance
          {activeTab === "performance" && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-900 rounded-full" />}
        </button>
      </div>

      {/* Tab components */}
      <div className="transition-all">
        {activeTab === "queue" && (
          <QueueTab items={queueItems} isLoading={isLoading} authHeader={getAuthHeader()} onRefresh={fetchData} />
        )}
        {activeTab === "health" && (
          <HealthTab data={healthData} isLoading={isLoading} />
        )}
        {activeTab === "performance" && (
          <PerformanceTab data={performanceData} isLoading={isLoading} />
        )}
      </div>
    </div>
  );
}
