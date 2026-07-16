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
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Markdown } from '@/components/ui/markdown'

import { DailyReport, type DailySummary } from './daily-report'

// 报告 JSON 由外部应用生成、结构不固定。这里做通用渲染：
// 命中这些 key 的字符串字段按 AI 文字总结（Markdown）渲染，其余按统计数据渲染。
const NARRATIVE_KEYS = new Set([
  'summary',
  'ai_summary',
  'aisummary',
  'narrative',
  'report',
  'analysis',
  'overview',
  'description',
  'content',
  'text',
])

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isDailySummary(value: unknown): value is DailySummary {
  if (!isPlainObject(value)) return false
  return (
    value.report_type === 'user_daily_summary' ||
    ('usage' in value && 'identity' in value)
  )
}

function humanizeKey(key: string): string {
  return key.replaceAll(/[_-]+/g, ' ').trim()
}

function formatScalar(value: unknown): string {
  if (value == null) return '—'
  if (typeof value === 'number') return value.toLocaleString()
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return String(value)
}

function JsonValue({ value }: { value: unknown }): ReactNode {
  if (value == null || typeof value !== 'object') {
    return (
      <span className='font-mono break-all tabular-nums'>
        {formatScalar(value)}
      </span>
    )
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className='text-muted-foreground'>—</span>
    }
    if (value.every(isPlainObject)) {
      return <ObjectTable rows={value as Record<string, unknown>[]} />
    }
    return (
      <span className='break-all'>{value.map(formatScalar).join(', ')}</span>
    )
  }
  return <ObjectGrid obj={value as Record<string, unknown>} />
}

function ObjectGrid({ obj }: { obj: Record<string, unknown> }) {
  const entries = Object.entries(obj)
  if (entries.length === 0) {
    return <span className='text-muted-foreground'>—</span>
  }
  return (
    <dl className='grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2'>
      {entries.map(([key, value]) => (
        <div
          key={key}
          className='border-border/40 flex flex-col gap-0.5 border-b pb-2'
        >
          <dt className='text-muted-foreground text-xs'>{humanizeKey(key)}</dt>
          <dd className='text-sm'>
            <JsonValue value={value} />
          </dd>
        </div>
      ))}
    </dl>
  )
}

function ObjectTable({ rows }: { rows: Record<string, unknown>[] }) {
  const columns = [
    ...rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key))
      return set
    }, new Set<string>()),
  ]
  return (
    <div className='overflow-x-auto'>
      <table className='w-full text-sm'>
        <thead>
          <tr className='text-muted-foreground border-b text-left text-xs'>
            {columns.map((column) => (
              <th key={column} className='py-1.5 pr-4 font-medium'>
                {humanizeKey(column)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={JSON.stringify(row)} className='border-border/40 border-b'>
              {columns.map((column) => (
                <td key={column} className='py-1.5 pr-4 align-top'>
                  <JsonValue value={row[column]} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ReportViewer({ content }: { content: unknown }) {
  const { t } = useTranslation()

  // 已知的「每日使用总结」结构走定制化渲染，其余走通用兜底渲染。
  if (isDailySummary(content)) {
    return <DailyReport data={content} />
  }

  if (!isPlainObject(content)) {
    return (
      <Card>
        <CardContent className='pt-2'>
          <JsonValue value={content} />
        </CardContent>
      </Card>
    )
  }

  const narratives: [string, string][] = []
  const stats: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(content)) {
    if (
      typeof value === 'string' &&
      value.trim() &&
      NARRATIVE_KEYS.has(key.toLowerCase())
    ) {
      narratives.push([key, value])
    } else {
      stats[key] = value
    }
  }

  const hasStats = Object.keys(stats).length > 0

  return (
    <div className='flex flex-col gap-4'>
      {narratives.map(([key, value]) => (
        <Card key={key}>
          <CardHeader>
            <CardTitle>
              {NARRATIVE_KEYS.has(key.toLowerCase()) &&
              key.toLowerCase() !== 'summary'
                ? humanizeKey(key)
                : t('AI Summary')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Markdown>{value}</Markdown>
          </CardContent>
        </Card>
      ))}

      {hasStats && (
        <Card>
          <CardHeader>
            <CardTitle>{t('Statistics')}</CardTitle>
          </CardHeader>
          <CardContent>
            <ObjectGrid obj={stats} />
          </CardContent>
        </Card>
      )}

      <details className='bg-muted/30 rounded-lg border p-3'>
        <summary className='text-muted-foreground cursor-pointer text-xs select-none'>
          {t('Raw JSON')}
        </summary>
        <pre className='mt-2 overflow-x-auto text-xs'>
          {JSON.stringify(content, null, 2)}
        </pre>
      </details>
    </div>
  )
}
