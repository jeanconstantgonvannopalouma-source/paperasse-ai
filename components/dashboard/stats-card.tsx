'use client'

import { useEffect, useRef, useState } from 'react'

// ─── Types ───────────────────────────────────────────────────
type TrendDirection = 'up' | 'down' | 'neutral'

interface StatsCardProps {
  title: string
  value: string | number
  icon: React.ReactNode
  description?: string
  trend?: {
    value: number
    direction: TrendDirection
    label?: string
  }
  loading?: boolean
  onClick?: () => void
}

// ─── Icônes de tendance ──────────────────────────────────────
function TrendUpIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  )
}

function TrendDownIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 17 13.5 8.5 8.5 13.5 2 7" />
      <polyline points="16 17 22 17 22 11" />
    </svg>
  )
}

// ─── Animation de comptage ───────────────────────────────────
function useCountAnimation(target: number, duration: number = 1000): number {
  const [count, setCount] = useState(0)
  const startTime = useRef<number | null>(null)
  const animationFrame = useRef<number | null>(null)

  useEffect(() => {
    if (target === 0) {
      setCount(0)
      return
    }

    function animate(timestamp: number) {
      if (!startTime.current) startTime.current = timestamp
      const progress = Math.min((timestamp - startTime.current) / duration, 1)

      // Easing function (ease-out)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.round(eased * target))

      if (progress < 1) {
        animationFrame.current = requestAnimationFrame(animate)
      }
    }

    animationFrame.current = requestAnimationFrame(animate)

    return () => {
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current)
      }
      startTime.current = null
    }
  }, [target, duration])

  return count
}

// ─── Skeleton Loader ─────────────────────────────────────────
function StatsCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="h-4 w-24 bg-gray-200 rounded" />
        <div className="h-10 w-10 bg-gray-200 rounded-lg" />
      </div>
      <div className="h-8 w-20 bg-gray-200 rounded mb-2" />
      <div className="h-3 w-32 bg-gray-100 rounded" />
    </div>
  )
}

// ─── Composant principal ─────────────────────────────────────
export function StatsCard({
  title,
  value,
  icon,
  description,
  trend,
  loading = false,
  onClick,
}: StatsCardProps) {
  // Si la valeur est un nombre, on anime le comptage
  const numericValue = typeof value === 'number' ? value : null
  const animatedValue = useCountAnimation(numericValue ?? 0)

  if (loading) {
    return <StatsCardSkeleton />
  }

  const trendColors: Record<TrendDirection, string> = {
    up: 'text-green-600 bg-green-50',
    down: 'text-red-600 bg-red-50',
    neutral: 'text-gray-600 bg-gray-50',
  }

  return (
    <div
      className={`
        bg-white rounded-xl border border-gray-200 p-6
        shadow-sm hover:shadow-md transition-all duration-300
        ${onClick ? 'cursor-pointer hover:border-blue-300 active:scale-[0.98]' : ''}
      `}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          onClick()
        }
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600">
          {icon}
        </div>
      </div>

      {/* Valeur */}
      <p className="text-3xl font-bold text-gray-900 tracking-tight">
        {numericValue !== null ? animatedValue.toLocaleString('fr-FR') : value}
      </p>

      {/* Description et tendance */}
      <div className="flex items-center justify-between mt-3">
        {description && (
          <p className="text-sm text-gray-400">{description}</p>
        )}

        {trend && (
          <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${trendColors[trend.direction]}`}>
            {trend.direction === 'up' && <TrendUpIcon />}
            {trend.direction === 'down' && <TrendDownIcon />}
            <span>
              {trend.direction === 'up' ? '+' : ''}
              {trend.value}%
            </span>
            {trend.label && <span className="text-gray-400 ml-1">{trend.label}</span>}
          </div>
        )}
      </div>
    </div>
  )
}