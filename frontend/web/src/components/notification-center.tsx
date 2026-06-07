"use client";

import React, { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  getNotifications, 
  getNotificationPreferences, 
  saveNotificationPreferences, 
  markNotificationAsRead, 
  markAllNotificationsAsRead,
  Notification,
  NotificationPreferences 
} from "@/lib/api";
import { 
  Bell, 
  Settings, 
  Check, 
  CheckCheck, 
  Mail, 
  Smartphone, 
  MessageSquare, 
  AlertCircle, 
  Clock, 
  BellOff, 
  X, 
  ExternalLink 
} from "lucide-react";

export default function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Queries
  const { data: notifications = [], isLoading: isNotificationsLoading } = useQuery<Notification[]>({
    queryKey: ["notifications"],
    queryFn: getNotifications,
    refetchInterval: 15000, // auto-refresh notifications every 15s
  });

  const { data: preferences, isLoading: isPreferencesLoading } = useQuery<NotificationPreferences>({
    queryKey: ["notificationPreferences"],
    queryFn: getNotificationPreferences,
    enabled: isSettingsOpen, // only load when modal opens
  });

  // Mutations
  const markReadMutation = useMutation({
    mutationFn: markNotificationAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  });

  const markAllReadMutation = useMutation({
    mutationFn: markAllNotificationsAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    }
  });

  const savePrefsMutation = useMutation({
    mutationFn: saveNotificationPreferences,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notificationPreferences"] });
      setIsSettingsOpen(false);
    }
  });

  // Local preferences state for form editing
  const [localPrefs, setLocalPrefs] = useState<NotificationPreferences | null>(null);

  useEffect(() => {
    if (preferences) {
      setLocalPrefs(JSON.parse(JSON.stringify(preferences)));
    }
  }, [preferences]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => n.unread).length;

  const handleToggleChannel = (channel: keyof NotificationPreferences["channels"]) => {
    if (!localPrefs) return;
    setLocalPrefs({
      ...localPrefs,
      channels: {
        ...localPrefs.channels,
        [channel]: !localPrefs.channels[channel]
      }
    });
  };

  const handleToggleCategory = (category: keyof NotificationPreferences["categories"]) => {
    if (!localPrefs) return;
    setLocalPrefs({
      ...localPrefs,
      categories: {
        ...localPrefs.categories,
        [category]: !localPrefs.categories[category]
      }
    });
  };

  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    if (localPrefs) {
      savePrefsMutation.mutate(localPrefs);
    }
  };

  const getCategoryColor = (cat: Notification["category"]) => {
    switch (cat) {
      case "ALLOTMENT": return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "DEADLINE": return "bg-rose-50 text-rose-700 border-rose-200";
      case "ALERT": return "bg-amber-50 text-amber-700 border-amber-200";
      case "SYSTEM":
      default:
        return "bg-blue-50 text-blue-700 border-blue-200";
    }
  };

  const formatTime = (isoString: string) => {
    const diffMs = Date.now() - new Date(isoString).getTime();
    const diffMins = Math.floor(diffMs / 1000 / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-full hover:bg-slate-100 transition-colors text-slate-600 focus:outline-none"
        aria-label="Notification Center"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-rose-500 text-white font-bold text-[10px] w-4.5 h-4.5 rounded-full flex items-center justify-center border-2 border-white animate-pulse">
            {unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Dropdown Header */}
          <div className="border-b p-3 bg-slate-50 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-800 text-xs uppercase tracking-wider">Alerts Feed</span>
              {unreadCount > 0 && (
                <span className="bg-rose-100 text-rose-800 text-[9px] px-1.5 py-0.5 rounded font-bold">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllReadMutation.mutate()}
                  className="text-[10px] text-blue-900 hover:underline font-bold flex items-center gap-0.5"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3 h-3" /> Mark all read
                </button>
              )}
              <button
                onClick={() => {
                  setIsSettingsOpen(true);
                  setIsOpen(false);
                }}
                className="p-1 rounded hover:bg-slate-200 text-slate-500"
                title="Notification Settings"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* List Content */}
          <div className="max-h-96 overflow-y-auto divide-y divide-slate-100">
            {isNotificationsLoading ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                <div className="w-5 h-5 border-2 border-blue-900 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                Loading alerts feed...
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center gap-2">
                <BellOff className="w-8 h-8 text-slate-350" />
                <span>No notifications yet.</span>
              </div>
            ) : (
              notifications.slice(0, 10).map((n) => (
                <div
                  key={n.id}
                  className={`p-3.5 hover:bg-slate-50 transition-colors flex gap-2.5 items-start ${
                    n.unread ? "bg-blue-50/20" : ""
                  }`}
                >
                  {/* Category dot */}
                  <div className="mt-1 flex-shrink-0">
                    <span className={`w-2 h-2 rounded-full inline-block ${
                      n.category === "ALLOTMENT" ? "bg-emerald-500" :
                      n.category === "DEADLINE" ? "bg-rose-500" :
                      n.category === "ALERT" ? "bg-amber-500" : "bg-blue-500"
                    }`} />
                  </div>

                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex justify-between items-start gap-1">
                      <h4 className={`text-xs text-slate-800 leading-snug break-words ${n.unread ? "font-bold" : "font-medium"}`}>
                        {n.title}
                      </h4>
                      {n.unread && (
                        <button
                          onClick={() => markReadMutation.mutate(n.id)}
                          className="text-[9px] text-blue-800 hover:text-blue-900 font-semibold flex-shrink-0"
                          title="Mark read"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 leading-normal break-words">
                      {n.body}
                    </p>
                    <div className="flex items-center justify-between text-[8px] text-slate-400 pt-1">
                      <span className="inline-flex items-center gap-1 font-mono uppercase">
                        {n.exam_relevance}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {formatTime(n.timestamp)}
                      </span>
                    </div>

                    {n.source_url && (
                      <a
                        href={n.source_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-0.5 text-[8px] text-blue-900 font-semibold hover:underline pt-1"
                      >
                        Official Website
                        <ExternalLink className="w-2 h-2" />
                      </a>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-4 bg-slate-50 border-b flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Settings className="w-5 h-5 text-blue-900" />
                <h3 className="font-bold text-slate-800 text-sm">Notification Channels & Settings</h3>
              </div>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="p-1 rounded-lg hover:bg-slate-200 text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {isPreferencesLoading || !localPrefs ? (
              <div className="p-8 text-center text-slate-400 text-xs">
                <div className="w-5 h-5 border-2 border-blue-900 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                Loading settings preferences...
              </div>
            ) : (
              <form onSubmit={handleSavePreferences} className="p-6 space-y-6">
                {/* Channels Section */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Communication Channels</h4>
                  <p className="text-[10px] text-slate-500">Enable where you wish to receive post-exam real-time alerts.</p>
                  
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    {/* Push */}
                    <button
                      type="button"
                      onClick={() => handleToggleChannel("push")}
                      className={`flex items-center justify-between p-3 rounded-lg border text-left transition-all ${
                        localPrefs.channels.push 
                          ? "bg-blue-50 border-blue-300 text-blue-900" 
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Bell className="w-4 h-4 text-blue-900" />
                        <span className="text-xs font-semibold">Web Push</span>
                      </div>
                      <span className="text-[10px] font-bold">{localPrefs.channels.push ? "ON" : "OFF"}</span>
                    </button>

                    {/* Email */}
                    <button
                      type="button"
                      onClick={() => handleToggleChannel("email")}
                      className={`flex items-center justify-between p-3 rounded-lg border text-left transition-all ${
                        localPrefs.channels.email 
                          ? "bg-blue-50 border-blue-300 text-blue-900" 
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-blue-900" />
                        <span className="text-xs font-semibold">Email</span>
                      </div>
                      <span className="text-[10px] font-bold">{localPrefs.channels.email ? "ON" : "OFF"}</span>
                    </button>

                    {/* WhatsApp */}
                    <button
                      type="button"
                      onClick={() => handleToggleChannel("whatsapp")}
                      className={`flex items-center justify-between p-3 rounded-lg border text-left transition-all ${
                        localPrefs.channels.whatsapp 
                          ? "bg-blue-50 border-blue-300 text-blue-900" 
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-blue-900" />
                        <span className="text-xs font-semibold">WhatsApp</span>
                      </div>
                      <span className="text-[10px] font-bold">{localPrefs.channels.whatsapp ? "ON" : "OFF"}</span>
                    </button>

                    {/* SMS */}
                    <button
                      type="button"
                      onClick={() => handleToggleChannel("sms")}
                      className={`flex items-center justify-between p-3 rounded-lg border text-left transition-all ${
                        localPrefs.channels.sms 
                          ? "bg-blue-50 border-blue-300 text-blue-900" 
                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <Smartphone className="w-4 h-4 text-blue-900" />
                        <span className="text-xs font-semibold">SMS Alerts</span>
                      </div>
                      <span className="text-[10px] font-bold">{localPrefs.channels.sms ? "ON" : "OFF"}</span>
                    </button>
                  </div>
                </div>

                {/* Categories Section */}
                <div className="space-y-3 border-t pt-4">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Alert Categories</h4>
                  <p className="text-[10px] text-slate-500">Configure what types of updates trigger notifications.</p>

                  <div className="space-y-2 pt-1">
                    {/* Allotments */}
                    <label className="flex items-center justify-between p-2 rounded hover:bg-slate-50 cursor-pointer">
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-slate-700">Seat Allotment Updates</span>
                        <span className="text-[9px] text-slate-400">Allotment results, round closures, and upgrade status.</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={localPrefs.categories.allotments}
                        onChange={() => handleToggleCategory("allotments")}
                        className="w-4 h-4 rounded text-blue-900 focus:ring-blue-900 border-slate-300 transition-all cursor-pointer"
                      />
                    </label>

                    {/* Deadlines */}
                    <label className="flex items-center justify-between p-2 rounded hover:bg-slate-50 cursor-pointer">
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-slate-700">Critical Deadlines</span>
                        <span className="text-[9px] text-slate-400">Form submissions, reporting dates, choice lock windows.</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={localPrefs.categories.deadlines}
                        onChange={() => handleToggleCategory("deadlines")}
                        className="w-4 h-4 rounded text-blue-900 focus:ring-blue-900 border-slate-300 transition-all cursor-pointer"
                      />
                    </label>

                    {/* Alerts */}
                    <label className="flex items-center justify-between p-2 rounded hover:bg-slate-50 cursor-pointer">
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-slate-700">Official News & Announcements</span>
                        <span className="text-[9px] text-slate-400">CET updates, fee changes, brochure and syllabus updates.</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={localPrefs.categories.alerts}
                        onChange={() => handleToggleCategory("alerts")}
                        className="w-4 h-4 rounded text-blue-900 focus:ring-blue-900 border-slate-300 transition-all cursor-pointer"
                      />
                    </label>

                    {/* System */}
                    <label className="flex items-center justify-between p-2 rounded hover:bg-slate-50 cursor-pointer">
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-slate-700">Platform Updates</span>
                        <span className="text-[9px] text-slate-400">New ML model version releases, placement updates, and server notifications.</span>
                      </div>
                      <input
                        type="checkbox"
                        checked={localPrefs.categories.system}
                        onChange={() => handleToggleCategory("system")}
                        className="w-4 h-4 rounded text-blue-900 focus:ring-blue-900 border-slate-300 transition-all cursor-pointer"
                      />
                    </label>
                  </div>
                </div>

                {/* Save Buttons */}
                <div className="flex gap-3 justify-end border-t pt-4">
                  <button
                    type="button"
                    onClick={() => setIsSettingsOpen(false)}
                    className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-lg font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savePrefsMutation.isPending}
                    className="text-xs bg-blue-900 hover:bg-blue-800 disabled:bg-blue-300 text-white px-4 py-2 rounded-lg font-bold"
                  >
                    {savePrefsMutation.isPending ? "Saving..." : "Save Preferences"}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
