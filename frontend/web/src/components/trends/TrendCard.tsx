'use client'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Trend, useTrendStore } from '@/store/trends'
import MiniSparkline from './MiniSparkline'

interface TrendCardProps {
  trend: Trend
  index: number
}

export default function TrendCard({ trend, index }: TrendCardProps) {
  const [mounted, setMounted] = useState(false)
  const { selectedTrendId, selectTrend } = useTrendStore()
  const isSelected = selectedTrendId === trend.id

  useEffect(() => {
    setMounted(true)
  }, [])

  const statusBadges = {
    emerging: (
      <span className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wider text-[var(--color-signal-emerging)] bg-[var(--color-signal-emerging)]/15 border border-[var(--color-signal-emerging)]/25 px-2.5 py-0.5 rounded-full uppercase">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-signal-emerging)] pulse-dot"></span>
        Emerging
      </span>
    ),
    trending: (
      <span className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wider text-[var(--color-signal-trending)] bg-[var(--color-signal-trending)]/15 border border-[var(--color-signal-trending)]/25 px-2.5 py-0.5 rounded-full uppercase">
        Trending
      </span>
    ),
    declining: (
      <span className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wider text-[var(--color-signal-declining)] bg-[var(--color-signal-declining)]/15 border border-[var(--color-signal-declining)]/25 px-2.5 py-0.5 rounded-full uppercase">
        Declining
      </span>
    ),
  }

  // Generate a mock peak day estimate
  const peakDays = Math.abs(Math.sin(index) * 14).toFixed(0)

  return (
    <motion.div
      initial={{ y: 30, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4, delay: index * 0.05, ease: [0.22, 1, 0.36, 1] }}
      onClick={() => selectTrend(isSelected ? null : trend.id)}
      className={`cursor-pointer transition-all duration-300 rounded-xl p-4 flex flex-col gap-3.5 border ${
        isSelected
          ? 'bg-[var(--color-bg-overlay)] border-[var(--color-accent-primary)] shadow-[var(--shadow-glow-indigo)] -translate-y-0.5'
          : 'bg-[var(--color-bg-surface)] border-[var(--color-border)] hover:border-[var(--color-border-active)] hover:-translate-y-0.5 hover:shadow-[0_0_25px_rgba(99,102,241,0.08)]'
      }`}
    >
      {/* Row 1: Name & Status */}
      <div className="flex items-start justify-between">
        <h4 className="font-semibold text-sm text-[var(--color-text-primary)] tracking-wide">
          {trend.name}
        </h4>
        {statusBadges[trend.status]}
      </div>

      {/* Row 2: Platforms */}
      <div className="flex flex-wrap gap-1.5">
        {trend.platforms.map((platform) => (
          <span
            key={platform}
            className="text-[10px] font-mono font-medium px-2 py-0.5 rounded bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] border border-[var(--color-border)]"
          >
            #{platform}
          </span>
        ))}
      </div>

      {/* Row 3: Sparkline */}
      <MiniSparkline status={trend.status} seed={index} />

      {/* Row 4: Virality Progress & Peak Forecast */}
      <div className="flex flex-col gap-1.5 mt-1">
        <div className="flex items-center justify-between text-[11px] font-mono text-[var(--color-text-secondary)]">
          <span>
            {trend.status === 'declining' ? 'Mainstream exit' : `Peak in ${peakDays} days`}
          </span>
          <span className="font-semibold text-[var(--color-text-primary)]">
            Virality {trend.virality_score}%
          </span>
        </div>
        <div className="w-full h-1.5 rounded-full bg-[var(--color-bg-elevated)] overflow-hidden border border-white/5">
          <div
            className="h-full bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] rounded-full transition-all duration-1000 ease-out"
            style={{ width: mounted ? `${trend.virality_score}%` : '0%' }}
          />
        </div>
      </div>
    </motion.div>
  )
}
