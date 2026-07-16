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

import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ROLE } from '@/lib/roles'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'

// Known shape of report_type === 'user_daily_summary' (v1.x). All fields are
// optional so a missing/renamed field degrades gracefully rather than crashing.
interface StatBucket {
  total?: number
  avg?: number
  p50?: number
  p95?: number
  p99?: number
  max?: number
  note?: string
}

interface TopPrompt {
  text?: string
  count?: number
  models?: string[]
  is_truncated?: boolean
}

export interface DailySummary {
  version?: string
  report_type?: string
  report_date?: string
  timezone?: string
  generated_at?: string
  identity?: { user_id?: number; token_id?: number; token_name?: string }
  usage?: {
    total_requests?: number
    stream_requests?: number
    non_stream_requests?: number
    stream_rate?: number
    prompt_tokens?: StatBucket
    completion_tokens?: StatBucket
    quota?: { total?: number; avg?: number }
  }
  latency?: { use_time_seconds?: StatBucket; first_token_ms?: StatBucket }
  models?: {
    distribution?: Record<string, number>
    top_model?: string
    unique_models?: number
  }
  hourly_distribution?: Record<string, number>
  content_analysis?: {
    available_rate?: number
    truncated_rate?: number
    unique_prompts?: number
    analyzed_requests?: number
    top_prompts?: TopPrompt[]
  }
  topic_summary?: string
  task_types?: string[]
  insights?: string[]
  metadata?: Record<string, unknown>
}

// ---- formatting helpers -----------------------------------------------------

function trimZeros(text: string): string {
  return text.includes('.') ? text.replace(/\.?0+$/, '') : text
}

function formatCompact(value?: number): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const abs = Math.abs(value)
  if (abs >= 1e9) return `${trimZeros((value / 1e9).toFixed(2))}B`
  if (abs >= 1e6) return `${trimZeros((value / 1e6).toFixed(2))}M`
  if (abs >= 1e4) return `${trimZeros((value / 1e3).toFixed(1))}K`
  return value.toLocaleString()
}

function formatInt(value?: number): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return Math.round(value).toLocaleString()
}

function formatSeconds(value?: number): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return Number.isInteger(value) ? `${value}s` : `${value.toFixed(1)}s`
}

function formatPercent(rate?: number): string {
  if (rate == null || !Number.isFinite(rate)) return '—'
  return `${trimZeros((rate * 100).toFixed(1))}%`
}

function formatBytes(value?: number): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let n = value
  let i = 0
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i += 1
  }
  return `${trimZeros(n.toFixed(1))} ${units[i]}`
}

function formatDateTime(iso?: string): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  // Locale-neutral YYYY-MM-DD HH:mm so the report reads consistently
  // regardless of browser locale.
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

// ---- presentational primitives ---------------------------------------------

function SectionCard({
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

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className='bg-background inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium'>
      {children}
    </span>
  )
}

function StatInline({ items }: { items: { label: string; value: string }[] }) {
  return (
    <div className='flex flex-wrap gap-x-5 gap-y-1.5'>
      {items.map((item) => (
        <div key={item.label} className='flex items-baseline gap-1.5'>
          <span className='text-muted-foreground text-[10px] tracking-wider uppercase'>
            {item.label}
          </span>
          <span className='font-mono text-sm tabular-nums'>{item.value}</span>
        </div>
      ))}
    </div>
  )
}

// ---- sections ---------------------------------------------------------------

interface Figure {
  label: string
  value: string
  title?: string
  hint?: string
}

function ModelBars({
  distribution,
  topModel,
  totalRequests,
  topLabel,
}: {
  distribution: Record<string, number>
  topModel?: string
  totalRequests: number
  topLabel: string
}) {
  const rows = Object.entries(distribution).sort((a, b) => b[1] - a[1])
  const max = Math.max(1, ...rows.map(([, count]) => count))
  const denom = totalRequests > 0 ? totalRequests : max
  return (
    <div className='flex flex-col gap-3'>
      {rows.map(([name, count]) => {
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
    </div>
  )
}

function HourlyRhythm({
  distribution,
  peakLabel,
}: {
  distribution: Record<string, number>
  peakLabel: string
}) {
  const hours = Array.from({ length: 24 }, (_, hour) => {
    const key = String(hour).padStart(2, '0')
    return { hour, count: distribution[key] ?? distribution[String(hour)] ?? 0 }
  })
  const max = Math.max(1, ...hours.map((entry) => entry.count))
  const peak = hours.reduce((best, entry) =>
    entry.count > best.count ? entry : best
  )
  return (
    <div>
      <div className='flex h-28 items-end gap-[3px]'>
        {hours.map(({ hour, count }) => {
          const isPeak = count > 0 && hour === peak.hour
          let barColor = 'bg-primary/30'
          if (count === 0) barColor = 'bg-muted'
          else if (isPeak) barColor = 'bg-primary'
          return (
            <div
              key={hour}
              className='flex h-full flex-1 flex-col justify-end'
              title={`${String(hour).padStart(2, '0')}:00 · ${count}`}
            >
              <div
                className={cn(
                  'w-full rounded-sm transition-[height]',
                  barColor
                )}
                style={{
                  height: `${count === 0 ? 2 : Math.max(6, (count / max) * 100)}%`,
                }}
              />
            </div>
          )
        })}
      </div>
      <div className='text-muted-foreground mt-1.5 flex justify-between text-[10px] tabular-nums'>
        <span>00</span>
        <span>06</span>
        <span>12</span>
        <span>18</span>
        <span>23</span>
      </div>
      <div className='text-muted-foreground mt-1 text-xs'>
        {peakLabel} {String(peak.hour).padStart(2, '0')}:00 ·{' '}
        {formatInt(peak.count)}
      </div>
    </div>
  )
}

function PromptCard({ prompt, index }: { prompt: TopPrompt; index: number }) {
  return (
    <div className='bg-muted/40 rounded-lg p-3.5'>
      <div className='mb-1.5 flex items-center justify-between gap-2'>
        <span className='text-muted-foreground font-mono text-xs'>
          #{index + 1}
        </span>
        <span className='bg-muted rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums'>
          ×{formatInt(prompt.count)}
        </span>
      </div>
      <p className='text-foreground/90 line-clamp-3 text-sm leading-relaxed whitespace-pre-wrap'>
        {prompt.text}
      </p>
      {prompt.models != null && prompt.models.length > 0 && (
        <div className='mt-2 flex flex-wrap gap-1'>
          {prompt.models.map((model) => (
            <span
              key={model}
              className='bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px]'
            >
              {model}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ---- main -------------------------------------------------------------------

export function DailyReport({ data }: { data: DailySummary }) {
  const { t } = useTranslation()
  const role = useAuthStore((s) => s.auth.user?.role) ?? 0
  const isAdmin = role >= ROLE.ADMIN

  const usage = data.usage ?? {}
  const promptTotal = usage.prompt_tokens?.total ?? 0
  const completionTotal = usage.completion_tokens?.total ?? 0
  const totalRequests = usage.total_requests ?? 0

  const figures: Figure[] = [
    {
      label: t('Requests'),
      value: formatInt(totalRequests),
      hint:
        usage.stream_rate != null
          ? `${formatPercent(usage.stream_rate)} ${t('streaming')}`
          : undefined,
    },
    {
      label: t('Total tokens'),
      value: formatCompact(promptTotal + completionTotal),
      title: formatInt(promptTotal + completionTotal),
      hint: `${formatCompact(promptTotal)} / ${formatCompact(completionTotal)}`,
    },
    {
      label: t('Quota'),
      value: formatCompact(usage.quota?.total),
      title: formatInt(usage.quota?.total),
    },
    {
      label: t('Avg latency'),
      value: formatSeconds(data.latency?.use_time_seconds?.avg),
    },
    {
      label: t('Models used'),
      value: formatInt(data.models?.unique_models),
    },
  ]

  // Parse the LLM topic summary: keep "•" bullets, drop the redundant
  // date/tag header lines (task_types chips already carry the tags).
  const summaryLines = (data.topic_summary ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  const bullets = summaryLines
    .filter((line) => line.startsWith('•'))
    .map((line) => line.replace(/^•\s*/, ''))
  const leadLines = summaryLines.filter(
    (line) =>
      !line.startsWith('•') &&
      !line.startsWith('标签') &&
      !(data.report_date != null && line.includes(data.report_date))
  )

  const topPrompts = data.content_analysis?.top_prompts ?? []
  const meta = data.metadata ?? {}

  return (
    <div className='mx-auto flex w-full max-w-7xl flex-col gap-4 pb-6 sm:gap-6'>
      {/* Overview: identity + key metrics */}
      <Card>
        <CardContent className='space-y-5'>
          <div>
            <div className='text-primary text-[11px] font-semibold tracking-[0.16em] uppercase'>
              {t('Daily usage summary')}
              {data.version != null && (
                <span className='text-muted-foreground'>
                  {' '}
                  · v{data.version}
                </span>
              )}
            </div>
            <h2 className='mt-1.5 text-2xl font-semibold tracking-tight break-all sm:text-3xl'>
              {data.identity?.token_name ??
                `Token #${data.identity?.token_id ?? ''}`}
            </h2>
            <div className='text-muted-foreground mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm'>
              <span className='tabular-nums'>{data.report_date}</span>
              {data.identity?.token_id != null && (
                <>
                  <span aria-hidden>·</span>
                  <span>Token #{data.identity.token_id}</span>
                </>
              )}
              {data.identity?.user_id != null && (
                <>
                  <span aria-hidden>·</span>
                  <span>User #{data.identity.user_id}</span>
                </>
              )}
              {data.timezone != null && (
                <>
                  <span aria-hidden>·</span>
                  <span>{data.timezone}</span>
                </>
              )}
              {data.generated_at != null && (
                <>
                  <span aria-hidden>·</span>
                  <span>
                    {t('Generated')} {formatDateTime(data.generated_at)}
                  </span>
                </>
              )}
            </div>
          </div>
          <div className='grid grid-cols-2 gap-x-6 gap-y-4 border-t pt-4 sm:grid-cols-3 lg:grid-cols-5'>
            {figures.map((figure) => (
              <div key={figure.label}>
                <div className='text-muted-foreground text-[11px] tracking-wider uppercase'>
                  {figure.label}
                </div>
                <div
                  className='mt-1 font-mono text-2xl font-semibold tracking-tight tabular-nums'
                  title={figure.title}
                >
                  {figure.value}
                </div>
                {figure.hint != null && (
                  <div className='text-muted-foreground mt-0.5 text-xs'>
                    {figure.hint}
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* AI briefing — task-type chips + digest bullets */}
      {(bullets.length > 0 ||
        leadLines.length > 0 ||
        (data.task_types?.length ?? 0) > 0) && (
        <SectionCard title={t('AI Summary')}>
          {data.task_types != null && data.task_types.length > 0 && (
            <div className='mb-3 flex flex-wrap gap-1.5'>
              {data.task_types.map((tag) => (
                <Chip key={tag}>{tag}</Chip>
              ))}
            </div>
          )}
          {leadLines.map((line) => (
            <p key={line} className='text-foreground/90 mb-2 leading-relaxed'>
              {line}
            </p>
          ))}
          {bullets.length > 0 && (
            <ul className='flex flex-col gap-2'>
              {bullets.map((bullet) => (
                <li
                  key={bullet}
                  className='text-foreground/90 before:text-primary relative pl-4 text-sm leading-relaxed before:absolute before:left-0 before:content-["▸"]'
                >
                  {bullet}
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      )}

      {/* Hourly rhythm — signature timeline */}
      {data.hourly_distribution != null && (
        <SectionCard title={t('Activity by hour')}>
          <HourlyRhythm
            distribution={data.hourly_distribution}
            peakLabel={t('Peak')}
          />
        </SectionCard>
      )}

      {/* Models + Token usage */}
      <div className='grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-2'>
        {data.models?.distribution != null && (
          <SectionCard
            title={t('Models')}
            aside={`${formatInt(data.models.unique_models)} ${t('unique')}`}
          >
            <ModelBars
              distribution={data.models.distribution}
              topModel={data.models.top_model}
              totalRequests={totalRequests}
              topLabel={t('top')}
            />
          </SectionCard>
        )}

        {(usage.prompt_tokens != null || usage.completion_tokens != null) && (
          <SectionCard title={t('Token usage')}>
            <div className='flex flex-col gap-4'>
              {usage.prompt_tokens != null && (
                <div>
                  <div className='mb-1 flex items-baseline justify-between'>
                    <span className='text-muted-foreground text-xs'>
                      {t('Prompt tokens')}
                    </span>
                    <span className='font-mono text-lg font-semibold tabular-nums'>
                      {formatCompact(usage.prompt_tokens.total)}
                    </span>
                  </div>
                  <StatInline
                    items={[
                      {
                        label: 'avg',
                        value: formatInt(usage.prompt_tokens.avg),
                      },
                      {
                        label: 'p50',
                        value: formatInt(usage.prompt_tokens.p50),
                      },
                      {
                        label: 'p95',
                        value: formatInt(usage.prompt_tokens.p95),
                      },
                      {
                        label: 'max',
                        value: formatInt(usage.prompt_tokens.max),
                      },
                    ]}
                  />
                </div>
              )}
              {usage.completion_tokens != null && (
                <div>
                  <div className='mb-1 flex items-baseline justify-between'>
                    <span className='text-muted-foreground text-xs'>
                      {t('Completion tokens')}
                    </span>
                    <span className='font-mono text-lg font-semibold tabular-nums'>
                      {formatCompact(usage.completion_tokens.total)}
                    </span>
                  </div>
                  <StatInline
                    items={[
                      {
                        label: 'avg',
                        value: formatInt(usage.completion_tokens.avg),
                      },
                      {
                        label: 'p50',
                        value: formatInt(usage.completion_tokens.p50),
                      },
                      {
                        label: 'p95',
                        value: formatInt(usage.completion_tokens.p95),
                      },
                      {
                        label: 'max',
                        value: formatInt(usage.completion_tokens.max),
                      },
                    ]}
                  />
                </div>
              )}
            </div>
          </SectionCard>
        )}
      </div>

      {/* Latency */}
      {data.latency?.use_time_seconds != null && (
        <SectionCard title={t('Latency')}>
          <StatInline
            items={[
              {
                label: 'avg',
                value: formatSeconds(data.latency.use_time_seconds.avg),
              },
              {
                label: 'p50',
                value: formatSeconds(data.latency.use_time_seconds.p50),
              },
              {
                label: 'p95',
                value: formatSeconds(data.latency.use_time_seconds.p95),
              },
              {
                label: 'p99',
                value: formatSeconds(data.latency.use_time_seconds.p99),
              },
              {
                label: 'max',
                value: formatSeconds(data.latency.use_time_seconds.max),
              },
            ]}
          />
        </SectionCard>
      )}

      {/* Top prompts — what the token actually did */}
      {topPrompts.length > 0 && (
        <SectionCard
          title={t('Top prompts')}
          aside={
            data.content_analysis?.analyzed_requests != null
              ? `${formatInt(data.content_analysis.analyzed_requests)} ${t('analyzed')}`
              : undefined
          }
        >
          <div className='grid grid-cols-1 gap-3 md:grid-cols-2'>
            {topPrompts.slice(0, 6).map((prompt, index) => (
              <PromptCard
                key={prompt.text ?? JSON.stringify(prompt)}
                prompt={prompt}
                index={index}
              />
            ))}
          </div>
        </SectionCard>
      )}

      {/* Metadata footer — admin only */}
      {isAdmin && (
        <SectionCard
          title={t('Details')}
          aside={<Chip>{t('Admin only')}</Chip>}
        >
          <div className='text-muted-foreground flex flex-wrap gap-x-6 gap-y-2 text-xs'>
            {typeof meta.consume_log_count === 'number' && (
              <span>
                {t('Logs analyzed')}:{' '}
                <span className='text-foreground font-mono tabular-nums'>
                  {formatInt(meta.consume_log_count)}
                </span>
              </span>
            )}
            {typeof meta.cwli_total_bytes_scanned === 'number' && (
              <span>
                {t('Data scanned')}:{' '}
                <span className='text-foreground font-mono'>
                  {formatBytes(meta.cwli_total_bytes_scanned)}
                </span>
              </span>
            )}
            {typeof meta.llm_channel_used === 'string' && (
              <span>
                {t('Summary channel')}:{' '}
                <span className='text-foreground font-mono'>
                  {meta.llm_channel_used}
                </span>
              </span>
            )}
          </div>
          <details className='mt-3'>
            <summary className='text-muted-foreground cursor-pointer text-xs select-none'>
              {t('Raw JSON')}
            </summary>
            <pre className='bg-muted/30 mt-2 overflow-x-auto rounded-lg border p-3 text-xs'>
              {JSON.stringify(data, null, 2)}
            </pre>
          </details>
        </SectionCard>
      )}
    </div>
  )
}
