/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

import { formatInt } from '../lib/format'

// 展示原件，与 user-reports 的 daily-report.tsx 同款视觉；此处独立一份保持特性自包含。

export function SectionCard({
  title,
  aside,
  children,
}: {
  title: string
  aside?: ReactNode
  children: ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className='text-sm font-semibold'>{title}</CardTitle>
        {aside != null && (
          <CardAction className='text-muted-foreground text-xs tabular-nums'>
            {aside}
          </CardAction>
        )}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

export function Chip({ children }: { children: ReactNode }) {
  return (
    <span className='bg-background inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium'>
      {children}
    </span>
  )
}

export function StatInline({
  items,
}: {
  items: { label: string; value: string }[]
}) {
  return (
    <div className='flex flex-wrap gap-x-5 gap-y-1.5'>
      {items.map((item) => (
        <div key={item.label} className='flex items-baseline gap-1.5'>
          <span className='text-muted-foreground text-[11px] tracking-wider uppercase'>
            {item.label}
          </span>
          <span className='font-mono text-sm tabular-nums'>{item.value}</span>
        </div>
      ))}
    </div>
  )
}

// 模型分布水平条：按请求数降序，占比相对总请求数，最高者高亮。
// previewCount 有值且条目更多时，默认只显示前 previewCount 条，可展开/收起全部。
export function ModelBars({
  distribution,
  topModel,
  totalRequests,
  topLabel,
  previewCount,
}: {
  distribution: Record<string, number>
  topModel?: string
  totalRequests: number
  topLabel: string
  previewCount?: number
}) {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)
  const rows = Object.entries(distribution).sort((a, b) => b[1] - a[1])
  const max = Math.max(1, ...rows.map((entry) => entry[1]))
  const denom = totalRequests > 0 ? totalRequests : max
  const canCollapse = previewCount != null && rows.length > previewCount
  const visible = canCollapse && !expanded ? rows.slice(0, previewCount) : rows
  return (
    <div className='flex flex-col gap-3'>
      {visible.map((entry) => {
        const name = entry[0]
        const count = entry[1]
        const isTop = name === topModel
        return (
          <div key={name}>
            <div className='mb-1 flex items-baseline justify-between gap-3'>
              <span className='truncate text-sm' title={name}>
                {name}
                {isTop && (
                  <span className='text-primary ml-2 text-[10px] font-semibold tracking-wider uppercase'>
                    {topLabel}
                  </span>
                )}
              </span>
              <span className='text-muted-foreground shrink-0 font-mono text-xs tabular-nums'>
                {formatInt(count)} · {Math.round((count / denom) * 100)}%
              </span>
            </div>
            <div className='bg-muted h-1.5 overflow-hidden rounded-full'>
              <div
                className={cn(
                  'h-full rounded-full',
                  isTop ? 'bg-primary' : 'bg-primary/40'
                )}
                style={{ width: `${(count / max) * 100}%` }}
              />
            </div>
          </div>
        )
      })}
      {canCollapse && (
        <button
          type='button'
          onClick={() => setExpanded((value) => !value)}
          className='text-muted-foreground hover:text-foreground self-start text-xs transition-colors'
        >
          {expanded
            ? t('Show less')
            : t('Show all {{total}} models', { total: rows.length })}
        </button>
      )}
    </div>
  )
}
