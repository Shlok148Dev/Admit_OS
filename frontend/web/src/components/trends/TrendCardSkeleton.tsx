'use client'

export default function TrendCardSkeleton() {
  return (
    <div className="bg-[var(--color-bg-surface)] border border-[var(--color-border)] rounded-xl p-4 flex flex-col gap-4 h-[190px] justify-between select-none pointer-events-none">
      <div className="flex justify-between items-center">
        <div className="w-1/3 h-4 skeleton"></div>
        <div className="w-1/5 h-4 rounded-full skeleton"></div>
      </div>
      <div className="flex gap-2">
        <div className="w-16 h-3 rounded skeleton"></div>
        <div className="w-16 h-3 rounded skeleton"></div>
      </div>
      <div className="w-full h-12 rounded skeleton"></div>
      <div className="flex flex-col gap-2">
        <div className="flex justify-between">
          <div className="w-1/4 h-3 skeleton"></div>
          <div className="w-10 h-3 skeleton"></div>
        </div>
        <div className="w-full h-1.5 rounded-full skeleton"></div>
      </div>
    </div>
  )
}
