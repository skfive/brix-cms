import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

export interface StatCardProps {
  /** "전체 포스트" */
  label: string
  /** "128" */
  value: string | number
  /** "+12 이번 주" */
  delta?: string
  trend?: 'up' | 'down' | 'neutral'
  icon: LucideIcon
}

const TREND_CLASS: Record<NonNullable<StatCardProps['trend']>, string> = {
  up: 'text-green-400',
  down: 'text-red-400',
  neutral: 'text-muted-foreground',
}

/**
 * 대시보드 통계 카드 — 명세 §7.3 / §8.3
 * 컨테이너: bg-card border border-border rounded-lg p-4
 */
export function StatCard({
  label,
  value,
  delta,
  trend = 'neutral',
  icon: Icon,
}: StatCardProps) {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="mt-2 text-3xl font-bold tracking-tight text-foreground">{value}</p>
      {delta && <p className={cn('mt-1 text-xs', TREND_CLASS[trend])}>{delta}</p>}
    </div>
  )
}
