import { create } from 'zustand'

export interface Trend {
  id: string
  name: string
  status: 'emerging' | 'trending' | 'declining'
  virality_score: number
  confidence: number
  platforms: string[]
  peak_day?: string
  mainstream_eta?: string
  signal_count: number
  first_seen: string
  description?: string
}

interface TrendStore {
  trends: Trend[]
  selectedTrendId: string | null
  setTrends: (trends: Trend[]) => void
  addTrend: (trend: Trend) => void
  updateTrend: (id: string, patch: Partial<Trend>) => void
  selectTrend: (id: string | null) => void
}

export const useTrendStore = create<TrendStore>(
  (set) => ({
    trends: [],
    selectedTrendId: null,
    setTrends: (trends) => set({ trends }),
    addTrend: (trend) => set((s) => ({
      trends: [trend, ...s.trends.map((t) => t.id === trend.id ? null : t).filter(Boolean) as Trend[]].slice(0, 50),
    })),
    updateTrend: (id, patch) => set((s) => ({
      trends: s.trends.map((t) =>
        t.id === id ? { ...t, ...patch } : t
      ),
    })),
    selectTrend: (selectedTrendId) =>
      set({ selectedTrendId }),
  })
)
