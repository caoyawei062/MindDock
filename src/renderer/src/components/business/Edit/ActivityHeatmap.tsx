import React, { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'
import type { Note } from '@renderer/provider/ListProvider'

interface Props {
  notes: Note[]
}

const WEEKS = 52
const CELL_SIZE = 10
const CELL_GAP = 2
const CELL_STEP = CELL_SIZE + CELL_GAP

function toDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function colorClass(count: number): string {
  if (count === 0) return 'bg-muted/60 dark:bg-muted/40'
  if (count <= 2) return 'bg-emerald-200 dark:bg-emerald-900'
  if (count <= 4) return 'bg-emerald-400 dark:bg-emerald-700'
  if (count <= 7) return 'bg-emerald-500 dark:bg-emerald-600'
  return 'bg-emerald-600 dark:bg-emerald-500'
}

interface Cell {
  key: string
  date: Date
  count: number
  isFuture: boolean
}

interface TooltipState {
  key: string
  count: number
  date: Date
  x: number
  y: number
}

const MONTH_NAMES = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
const DAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', '']
const LEGEND_COUNTS = [0, 2, 4, 6, 8]

export const ActivityHeatmap: React.FC<Props> = ({ notes }) => {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  const { columns, monthLabels, activeDays, totalEdits } = useMemo(() => {
    const countMap = new Map<string, number>()
    for (const note of notes) {
      const d = new Date(note.updated_at)
      const key = toDateKey(d)
      countMap.set(key, (countMap.get(key) ?? 0) + 1)
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const start = new Date(today)
    start.setDate(today.getDate() - today.getDay())
    start.setDate(start.getDate() - (WEEKS - 1) * 7)

    const cols: Cell[][] = []
    for (let w = 0; w < WEEKS; w++) {
      const week: Cell[] = []
      for (let d = 0; d < 7; d++) {
        const date = new Date(start)
        date.setDate(start.getDate() + w * 7 + d)
        const key = toDateKey(date)
        week.push({ key, date, count: countMap.get(key) ?? 0, isFuture: date > today })
      }
      cols.push(week)
    }

    const labels: { text: string; col: number }[] = []
    let lastMonth = -1
    cols.forEach((week, i) => {
      const m = week[0].date.getMonth()
      if (m !== lastMonth) {
        if (lastMonth !== -1) labels.push({ text: MONTH_NAMES[m], col: i })
        lastMonth = m
      }
    })

    const active = [...countMap.keys()].filter((k) => {
      const d = new Date(k)
      return d >= start && d <= today
    }).length
    const total = [...countMap.values()].reduce((a, b) => a + b, 0)

    return { columns: cols, monthLabels: labels, activeDays: active, totalEdits: total }
  }, [notes])

  const DAY_LABEL_WIDTH = 28

  return (
    <div className="w-full max-w-2xl">
      <div className="flex items-baseline gap-2 mb-3">
        <span className="text-sm font-medium">
          过去一年活跃 <span className="text-primary">{activeDays}</span> 天
        </span>
        <span className="text-xs text-muted-foreground">共 {totalEdits} 次编辑</span>
      </div>

      <div className="overflow-x-auto">
        <div className="inline-block min-w-max">
          {/* Month labels */}
          <div className="relative h-4 mb-1" style={{ marginLeft: DAY_LABEL_WIDTH }}>
            {monthLabels.map(({ text, col }) => (
              <span
                key={`${text}-${col}`}
                className="absolute text-[10px] text-muted-foreground"
                style={{ left: col * CELL_STEP }}
              >
                {text}
              </span>
            ))}
          </div>

          <div className="flex" style={{ gap: CELL_GAP }}>
            {/* Day-of-week labels */}
            <div
              className="flex flex-col shrink-0"
              style={{ gap: CELL_GAP, width: DAY_LABEL_WIDTH - CELL_GAP }}
            >
              {DAY_LABELS.map((label, i) => (
                <div
                  key={i}
                  style={{ height: CELL_SIZE }}
                  className="flex items-center justify-end pr-1 text-[9px] text-muted-foreground leading-none"
                >
                  {label}
                </div>
              ))}
            </div>

            {/* Week columns */}
            {columns.map((week, wi) => (
              <div key={wi} className="flex flex-col" style={{ gap: CELL_GAP }}>
                {week.map((cell) => (
                  <div
                    key={cell.key}
                    style={{ width: CELL_SIZE, height: CELL_SIZE, borderRadius: 2 }}
                    className={cn(
                      'cursor-default transition-opacity',
                      cell.isFuture ? 'opacity-0 pointer-events-none' : colorClass(cell.count)
                    )}
                    onMouseEnter={(e) => {
                      if (cell.isFuture) return
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                      setTooltip({
                        key: cell.key,
                        count: cell.count,
                        date: cell.date,
                        x: rect.left + rect.width / 2,
                        y: rect.top
                      })
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  />
                ))}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-1 mt-2 justify-end text-[10px] text-muted-foreground">
            <span>少</span>
            {LEGEND_COUNTS.map((n) => (
              <div
                key={n}
                style={{ width: CELL_SIZE, height: CELL_SIZE, borderRadius: 2 }}
                className={colorClass(n)}
              />
            ))}
            <span>多</span>
          </div>
        </div>
      </div>

      {/* Hover tooltip via portal */}
      {tooltip &&
        createPortal(
          <div
            className="fixed z-[9999] pointer-events-none"
            style={{
              left: tooltip.x,
              top: tooltip.y - 8,
              transform: 'translate(-50%, -100%)'
            }}
          >
            <div className="bg-popover border border-border rounded-md px-2.5 py-1.5 shadow-md text-xs">
              <div className="font-medium text-foreground">
                {tooltip.date.toLocaleDateString('zh-CN', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </div>
              <div className="text-muted-foreground mt-0.5">
                {tooltip.count === 0 ? '暂无编辑记录' : `${tooltip.count} 次编辑`}
              </div>
            </div>
            {/* Arrow */}
            <div className="flex justify-center">
              <div className="w-2 h-2 bg-popover border-b border-r border-border rotate-45 -mt-1" />
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}
