'use client'
import { useState, useEffect, useRef } from 'react'
import PageTransition from '@/components/motion/PageTransition'
import TrendGlobe from '@/components/3d/TrendGlobe'
import AnimatedStatCard from '@/components/dashboard/AnimatedStatCard'
import EmergingStrip from '@/components/dashboard/EmergingStrip'
import TrendCard from '@/components/trends/TrendCard'
import TrendCardSkeleton from '@/components/trends/TrendCardSkeleton'
import { useTrendStore, Trend } from '@/store/trends'

// --- Mock Data Generator ---
function generateMockTrends(count = 20): Trend[] {
  const names = [
    'NeuralLace', 'SilentDisco', 'QuantumSkin',
    'VoidAesthetic', 'SyntheticDrift',
    'MicroCulture', 'PlatformDecay', 'NoiseCore',
    'GhostCommerce', 'LiminalSpaces',
  ]
  const platforms = [
    'reddit', 'twitter', 'discord',
    'hackernews', 'tiktok',
  ]
  const statuses = [
    'emerging', 'trending', 'declining',
  ] as const

  return Array.from({ length: count }, (_, i) => ({
    id: `mock-${i}-${Math.random().toString(36).substr(2, 5)}`,
    name: names[i % names.length] + ` ${i + 1}`,
    status: statuses[i % 3],
    virality_score: Math.floor(Math.random() * 85) + 15,
    confidence: Number((Math.random() * 0.4 + 0.6).toFixed(2)),
    platforms: [platforms[i % platforms.length], platforms[(i + 2) % platforms.length]],
    signal_count: Math.floor(Math.random() * 8000) + 1500,
    first_seen: new Date(Date.now() - Math.random() * 7 * 86400000).toISOString(),
    description: 'An emerging cultural signal showing strong micro-community momentum across platforms.',
  }))
}

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false)
  const { trends, setTrends, addTrend } = useTrendStore()
  const [signalsPerMin, setSignalsPerMin] = useState(1847)
  const generatorIndex = useRef(20)

  // Initialize state and setup interval
  useEffect(() => {
    setMounted(true)
    const initialTrends = generateMockTrends(20)
    setTrends(initialTrends)

    // Simulate real-time live feed (add new mock trend every 8s)
    const liveFeedInterval = setInterval(() => {
      const platforms = ['reddit', 'twitter', 'discord', 'hackernews', 'tiktok', 'youtube']
      const statuses = ['emerging', 'trending'] as const
      const names = ['HyperObject', 'CyberGrid', 'SolarPunk', 'NeoTokyo', 'MetaLayer', 'AstroMesh']
      
      const newTrend: Trend = {
        id: `live-${Date.now()}`,
        name: `${names[Math.floor(Math.random() * names.length)]} ${generatorIndex.current++}`,
        status: statuses[Math.floor(Math.random() * statuses.length)],
        virality_score: Math.floor(Math.random() * 50) + 40,
        confidence: Number((Math.random() * 0.3 + 0.7).toFixed(2)),
        platforms: [platforms[Math.floor(Math.random() * platforms.length)]],
        signal_count: Math.floor(Math.random() * 200) + 50,
        first_seen: new Date().toISOString(),
        description: 'Realtime incoming cultural signal detected from public community posts.',
      }
      
      addTrend(newTrend)
    }, 8000)

    // Live updating signals count
    const signalsInterval = setInterval(() => {
      setSignalsPerMin(prev => prev + Math.floor(Math.random() * 7) - 3)
    }, 1500)

    return () => {
      clearInterval(liveFeedInterval)
      clearInterval(signalsInterval)
    }
  }, [setTrends, addTrend])

  if (!mounted) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          <div className="lg:col-span-3 h-[70vh] bg-[var(--color-bg-surface)] rounded-2xl skeleton border border-[var(--color-border)]"></div>
          <div className="lg:col-span-2 flex flex-col gap-6">
            <div className="grid grid-cols-3 gap-4">
              <div className="h-24 skeleton"></div>
              <div className="h-24 skeleton"></div>
              <div className="h-24 skeleton"></div>
            </div>
            <div className="h-10 skeleton"></div>
            <div className="flex flex-col gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-40 skeleton"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <PageTransition>
      <div className="max-w-7xl mx-auto px-6 py-6 min-h-[calc(100vh-100px)]">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
          
          {/* LEFT COLUMN: Sticky 3D Globe */}
          <div className="lg:col-span-3 lg:sticky lg:top-24 h-[60vh] lg:h-[75vh] bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-2xl overflow-hidden relative group">
            {/* Context Overlay */}
            <div className="absolute top-5 left-5 z-10 pointer-events-none">
              <div className="font-mono text-[10px] tracking-wider text-[var(--color-text-muted)] uppercase mb-0.5">SPATIAL INDEX</div>
              <h2 className="text-sm font-bold text-[var(--color-text-primary)]">SIGNAL DISTRIBUTION MAP</h2>
            </div>
            
            <TrendGlobe interactive={true} />
            
            {/* Visual corner borders for technical sci-fi style */}
            <div className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-[#6366f1]/30 rounded-tl" />
            <div className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-[#6366f1]/30 rounded-tr" />
            <div className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-[#6366f1]/30 rounded-bl" />
            <div className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-[#6366f1]/30 rounded-br" />
          </div>

          {/* RIGHT COLUMN: Live metrics, emerging pills, and card list */}
          <div className="lg:col-span-2 flex flex-col gap-6 max-h-[85vh] lg:overflow-y-auto pr-1 pb-10 scrollbar-thin">
            
            {/* Metric counters */}
            <div className="grid grid-cols-3 gap-4">
              <AnimatedStatCard
                title="Trends Today"
                value={247}
                badgeText="+18%"
                badgeColor="emerald"
                colorClass="text-[var(--color-signal-emerging)]"
              />
              <AnimatedStatCard
                title="Avg Virality"
                value={73}
                suffix="%"
                badgeText="STABLE"
                badgeColor="indigo"
                colorClass="text-[var(--color-signal-trending)]"
              />
              <AnimatedStatCard
                title="Signals/min"
                value={signalsPerMin}
                badgeText="LIVE"
                badgeColor="amber"
                colorClass="text-[var(--color-text-primary)] animate-pulse"
              />
            </div>

            {/* Horizontal Emerging Strip */}
            <EmergingStrip />

            {/* main Signal Feed list */}
            <div>
              <div className="flex items-center justify-between border-b border-[var(--color-border)] pb-3 mb-4">
                <h3 className="text-xs font-mono uppercase tracking-wider text-[var(--color-text-primary)] flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-[var(--color-accent-primary)] rounded-full animate-ping"></span>
                  GLOBAL SIGNAL STREAM
                </h3>
                <span className="text-[10px] font-mono text-[var(--color-text-muted)]">
                  SHOWING {trends.length} NODES
                </span>
              </div>

              <div className="flex flex-col gap-4">
                {trends.length === 0 ? (
                  Array.from({ length: 6 }).map((_, i) => <TrendCardSkeleton key={i} />)
                ) : (
                  trends.map((trend, index) => (
                    <TrendCard key={trend.id} trend={trend} index={index} />
                  ))
                )}
              </div>
            </div>

          </div>

        </div>
      </div>
    </PageTransition>
  )
}
