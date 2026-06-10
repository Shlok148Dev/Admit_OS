'use client'
import { useMemo } from 'react'
import { AreaChart, Area, ResponsiveContainer } from 'recharts'

interface MiniSparklineProps {
  status: 'emerging' | 'trending' | 'declining'
  seed: number
}

export default function MiniSparkline({ status, seed }: MiniSparklineProps) {
  const data = useMemo(() => {
    // Generate 7 pseudo-random points based on seed & status to keep it stable
    const points = []
    let current = status === 'emerging' ? 20 : status === 'trending' ? 50 : 80
    for (let i = 0; i < 7; i++) {
      const delta = (Math.sin(seed + i) * 15) + (status === 'emerging' ? 8 : status === 'declining' ? -8 : 2)
      current = Math.max(10, Math.min(100, current + delta))
      points.push({ value: current })
    }
    return points
  }, [status, seed])

  const colors = {
    emerging: { stroke: '#10b981', fill: 'url(#colorEmerging)' },
    trending: { stroke: '#f59e0b', fill: 'url(#colorTrending)' },
    declining: { stroke: '#ef4444', fill: 'url(#colorDeclining)' },
  }

  const activeColors = colors[status]

  return (
    <div className="w-full h-12 overflow-hidden opacity-85 select-none pointer-events-none">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
          <defs>
            <linearGradient id="colorEmerging" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
              <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
            </linearGradient>
            <linearGradient id="colorTrending" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25}/>
              <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.0}/>
            </linearGradient>
            <linearGradient id="colorDeclining" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25}/>
              <stop offset="95%" stopColor="#ef4444" stopOpacity={0.0}/>
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={activeColors.stroke}
            strokeWidth={1.5}
            fill={activeColors.fill}
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
