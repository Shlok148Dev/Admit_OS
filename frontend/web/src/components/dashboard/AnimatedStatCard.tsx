'use client'
import { useState, useEffect } from 'react'

interface AnimatedStatCardProps {
  title: string
  value: number
  suffix?: string
  badgeText?: string
  badgeColor?: 'emerald' | 'amber' | 'indigo'
  colorClass?: string
}

export default function AnimatedStatCard({
  title,
  value,
  suffix = '',
  badgeText,
  badgeColor = 'indigo',
  colorClass = 'text-[var(--color-text-primary)]',
}: AnimatedStatCardProps) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let startTimestamp: number | null = null
    const duration = 1200 // 1200ms

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp
      const progress = Math.min((timestamp - startTimestamp) / duration, 1)
      
      // easeOutQuart easing function
      const easeProgress = 1 - Math.pow(1 - progress, 4)
      
      setCount(Math.floor(easeProgress * value))
      
      if (progress < 1) {
        window.requestAnimationFrame(step)
      }
    }

    window.requestAnimationFrame(step)
  }, [value])

  const badgeColors = {
    emerald: 'bg-[var(--color-signal-emerging)]/15 text-[var(--color-signal-emerging)] border-[var(--color-signal-emerging)]/30',
    amber: 'bg-[var(--color-signal-trending)]/15 text-[var(--color-signal-trending)] border-[var(--color-signal-trending)]/30',
    indigo: 'bg-[var(--color-accent-primary)]/15 text-[var(--color-accent-primary)] border-[var(--color-accent-primary)]/30',
  }

  return (
    <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-xl p-5 hover:border-[var(--color-border-active)] transition-all duration-300">
      <div className="flex justify-between items-start mb-2">
        <span className="text-xs font-mono uppercase tracking-wider text-[var(--color-text-secondary)]">{title}</span>
        {badgeText && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${badgeColors[badgeColor]}`}>
            {badgeText}
          </span>
        )}
      </div>
      <div className="flex items-baseline gap-1">
        <span className={`text-3xl font-bold font-mono tracking-tight ${colorClass}`}>
          {count.toLocaleString()}
        </span>
        {suffix && <span className="text-sm text-[var(--color-text-secondary)]">{suffix}</span>}
      </div>
    </div>
  )
}
