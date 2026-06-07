"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import { getUpcomingEvents, UpcomingEvent } from "@/lib/api";
import { Calendar, Clock, Award, Users, AlertCircle } from "lucide-react";

export default function EventsTimeline() {
  const { data: events = [], isLoading, error } = useQuery<UpcomingEvent[]>({
    queryKey: ["upcomingEvents"],
    queryFn: getUpcomingEvents,
  });

  const getCategoryStyles = (category: UpcomingEvent["category"]) => {
    switch (category) {
      case "REGISTRATION":
        return { bg: "bg-blue-50 text-blue-700 border-blue-200", icon: Users };
      case "RESULT":
        return { bg: "bg-purple-50 text-purple-700 border-purple-200", icon: Award };
      case "COUNSELING":
        return { bg: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: Calendar };
      case "EXAM":
      default:
        return { bg: "bg-amber-50 text-amber-700 border-amber-200", icon: Clock };
    }
  };

  if (error) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex items-center gap-3 text-rose-800">
        <AlertCircle className="w-5 h-5 flex-shrink-0" />
        <div className="text-xs">
          <span className="font-bold">Failed to load events timeline:</span> {error.message || "Unknown error"}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm space-y-5 w-full">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-900" />
            Upcoming Admissions Timeline
          </h3>
          <p className="text-[11px] text-slate-500">Track critical registration, allotment, and choice filling dates.</p>
        </div>
        <span className="text-[10px] bg-blue-50 text-blue-900 font-bold px-2 py-0.5 rounded border border-blue-100 uppercase">
          Live Tracker
        </span>
      </div>

      {isLoading ? (
        // Loading skeletons
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 relative">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse space-y-2 border-l-2 md:border-l-0 md:border-t-2 border-slate-150 pl-3 md:pl-0 pt-0 md:pt-3">
              <div className="h-4 bg-slate-200 rounded w-2/3"></div>
              <div className="h-3 bg-slate-150 rounded w-1/2"></div>
              <div className="h-5 bg-slate-100 rounded-full w-1/3"></div>
            </div>
          ))}
        </div>
      ) : (
        // Timeline content
        <div className="relative">
          {/* Connecting line for larger screens */}
          <div className="absolute top-[17px] left-8 right-8 h-0.5 bg-slate-250 hidden md:block z-0" />

          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 relative z-10">
            {events.map((event, idx) => {
              const { bg, icon: Icon } = getCategoryStyles(event.category);
              const eventDate = new Date(event.date);
              
              return (
                <div 
                  key={event.id}
                  className="flex md:flex-col gap-4 md:gap-3 border-l-2 md:border-l-0 md:border-t-2 border-slate-200 pl-4 md:pl-0 pt-0 md:pt-4 hover:border-blue-900 transition-colors duration-250 group relative"
                >
                  {/* Timeline Dot icon overlay */}
                  <div className="absolute -left-[9px] md:left-4 -top-[1px] md:-top-[9px] bg-white p-0.5 rounded-full border border-slate-200 group-hover:border-blue-900 transition-colors z-20">
                    <div className="w-3 h-3 rounded-full bg-blue-900/10 group-hover:bg-blue-900/30 flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-900" />
                    </div>
                  </div>

                  {/* Icon Card */}
                  <div className="flex-1 space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[8px] px-1.5 py-0.5 rounded-full border font-bold uppercase tracking-wider ${bg}`}>
                        {event.category}
                      </span>
                      <span className="text-[8px] font-semibold text-slate-400 font-mono">
                        {event.exam.replace("_", " ")}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-slate-800 group-hover:text-blue-900 transition-colors leading-snug">
                      {event.title}
                    </h4>

                    <div className="text-[10px] text-slate-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      {eventDate.toLocaleDateString("en-IN", { month: "short", day: "numeric", year: "numeric" })}
                    </div>

                    {/* Countdown Badge */}
                    <div className="pt-1">
                      <span className="inline-flex items-center gap-1 text-[9px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
                        <Clock className="w-2.5 h-2.5" />
                        In {event.countdownDays} days
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
