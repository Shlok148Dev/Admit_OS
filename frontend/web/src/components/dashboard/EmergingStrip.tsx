'use client'
import { useTrendStore } from '@/store/trends'

export default function EmergingStrip() {
  const { trends, selectedTrendId, selectTrend } = useTrendStore()
  const emergingTrends = trends.filter(t => t.status === 'emerging').slice(0, 10)

  if (emergingTrends.length === 0) return null

  return (
    <div className="mb-6">
      <h3 className="text-xs font-mono uppercase tracking-wider text-[var(--color-text-secondary)] mb-3 flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-signal-emerging)] pulse-dot"></span>
        EMERGING NOW
      </h3>
      <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-none select-none -mx-1 px-1">
        {emergingTrends.map((trend) => {
          const isSelected = selectedTrendId === trend.id
          return (
            <button
              key={trend.id}
              onClick={() => selectTrend(isSelected ? null : trend.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium border whitespace-nowrap transition-all duration-200 ${
                isSelected
                  ? 'bg-[var(--color-signal-emerging)]/15 border-[var(--color-signal-emerging)] text-[var(--color-text-primary)] shadow-[var(--shadow-glow-emerald)]'
                  : 'bg-[var(--color-bg-surface)] border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-active)]'
              }`}
            >
              <span>{trend.name}</span>
              <span className="bg-[#12121e] px-1.5 py-0.5 rounded text-[10px] font-mono text-[var(--color-text-secondary)]">
                {trend.virality_score}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
