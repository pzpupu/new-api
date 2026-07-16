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
import { ChevronRight, ExternalLink } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Card, CardContent } from '@/components/ui/card'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { formatQuotaWithCurrency } from '@/lib/currency'
import { cn } from '@/lib/utils'

import {
  formatCompact,
  formatDateTime,
  formatInt,
  formatSeconds,
  keyedLines,
  parseTopicSummary,
} from '../lib/format'
import type {
  DailyOverview,
  OverviewTokenBreakdown,
  OverviewUserBreakdown,
} from '../types'
import { Chip, ModelBars, SectionCard, StatInline } from './primitives'

interface Figure {
  label: string
  value: string
  title?: string
  hint?: string
}

// 折叠态行右侧对齐的紧凑指标（label 小写标签 + 等宽数值）。
function InlineMetric({ label, value }: { label: string; value: string }) {
  return (
    <span className='flex items-baseline gap-1.5'>
      <span className='text-muted-foreground text-[11px] tracking-wider uppercase'>
        {label}
      </span>
      <span className='font-mono text-sm tabular-nums'>{value}</span>
    </span>
  )
}

// 构造某用户 / token 的「使用总结」详情页链接（点击名称在新标签打开）。
function usageSummaryHref(params: {
  user?: number
  token?: number
  date?: string
}): string {
  const query = new URLSearchParams()
  if (params.user != null) query.set('user', String(params.user))
  if (params.token != null) query.set('token', String(params.token))
  if (params.date != null) query.set('date', params.date)
  const qs = query.toString()
  return qs ? `/user-reports?${qs}` : '/user-reports'
}

// 汇总所有用户各 token 的模型分布，得到全站模型使用总量。
function aggregateModels(users: OverviewUserBreakdown[]): {
  distribution: Record<string, number>
  topModel?: string
  uniqueModels: number
} {
  const distribution: Record<string, number> = {}
  for (const user of users) {
    for (const token of user.tokens ?? []) {
      const dist = token.model_distribution ?? {}
      for (const name of Object.keys(dist)) {
        distribution[name] = (distribution[name] ?? 0) + (dist[name] ?? 0)
      }
    }
  }
  const sorted = Object.entries(distribution).sort((a, b) => b[1] - a[1])
  return {
    distribution,
    topModel: sorted[0]?.[0],
    uniqueModels: sorted.length,
  }
}

// 单个 token：默认折叠，折叠头展示重点信息（名称/主力模型/请求/tokens/额度）；
// 展开后看明细（输入输出/延迟分位、任务类型、AI 总结、模型分布）。
function TokenRow({
  token,
  userId,
  reportDate,
}: {
  token: OverviewTokenBreakdown
  userId?: number
  reportDate?: string
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const distribution = token.model_distribution ?? {}
  const hasModels = Object.keys(distribution).length > 0
  const summary = parseTopicSummary(token.topic_summary, reportDate)
  const hasSummary = summary.leadLines.length > 0 || summary.bullets.length > 0
  const hasTaskTypes = token.task_types != null && token.task_types.length > 0
  const totalTokens = (token.prompt_tokens ?? 0) + (token.completion_tokens ?? 0)
  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className='border-border/50 rounded-lg border'
    >
      {/* 整行可折叠：底层覆盖式触发按钮吃掉整行点击；上层内容 pointer-events-none，
          唯独令牌名链接 pointer-events-auto 自己捕获点击，在新标签打开使用总结。 */}
      <div className='relative'>
        <CollapsibleTrigger
          aria-label={token.token_name || `Token #${token.token_id ?? ''}`}
          className='hover:bg-muted/40 focus-visible:ring-ring/50 absolute inset-0 rounded-lg transition-colors focus-visible:ring-2 focus-visible:outline-none'
        />
        <div className='pointer-events-none relative flex items-center gap-3 px-3 py-2'>
          <ChevronRight
            className={cn(
              'text-muted-foreground size-4 shrink-0 transition-transform',
              open && 'rotate-90'
            )}
            aria-hidden
          />
          <div className='min-w-0 flex-1'>
            <a
              href={usageSummaryHref({
                user: userId,
                token: token.token_id,
                date: reportDate,
              })}
              target='_blank'
              rel='noreferrer'
              title={t('Usage Summary')}
              className='pointer-events-auto inline-flex max-w-full items-center gap-1 text-sm font-medium hover:underline'
            >
              <span className='truncate'>
                {token.token_name || `Token #${token.token_id ?? ''}`}
              </span>
              <ExternalLink className='size-3 shrink-0 opacity-60' aria-hidden />
            </a>
            {token.top_model != null && (
              <span className='text-muted-foreground block truncate font-mono text-xs'>
                {token.top_model}
              </span>
            )}
            {hasTaskTypes && (
              <span className='mt-1 flex flex-wrap gap-1'>
                {token.task_types?.map((tag) => <Chip key={tag}>{tag}</Chip>)}
              </span>
            )}
          </div>
          <span className='hidden shrink-0 items-baseline gap-4 sm:flex'>
            <InlineMetric
              label={t('Requests')}
              value={formatInt(token.requests)}
            />
            <InlineMetric
              label={t('Total tokens')}
              value={formatCompact(totalTokens)}
            />
          </span>
          <span className='w-20 shrink-0 text-right font-mono text-sm tabular-nums'>
            {token.quota != null ? formatQuotaWithCurrency(token.quota) : '—'}
          </span>
        </div>
      </div>
      <CollapsibleContent>
        <div className='flex flex-col gap-3 px-3 pt-1 pb-3'>
          <StatInline
            items={[
              {
                label: t('Prompt tokens'),
                value: formatCompact(token.prompt_tokens),
              },
              {
                label: t('Completion tokens'),
                value: formatCompact(token.completion_tokens),
              },
              {
                label: t('Avg latency'),
                value: formatSeconds(token.latency?.avg_s),
              },
              { label: 'p50', value: formatSeconds(token.latency?.p50_s) },
              { label: 'p95', value: formatSeconds(token.latency?.p95_s) },
            ]}
          />
          {hasSummary && (
            <div>
              {keyedLines(summary.leadLines).map((line) => (
                <p
                  key={line.key}
                  className='text-foreground/90 mb-2 text-sm leading-relaxed'
                >
                  {line.text}
                </p>
              ))}
              {summary.bullets.length > 0 && (
                <ul className='flex flex-col gap-2'>
                  {keyedLines(summary.bullets).map((line) => (
                    <li
                      key={line.key}
                      className='text-foreground/90 before:bg-primary relative pl-4 text-sm leading-relaxed before:absolute before:top-2 before:left-0 before:size-1.5 before:rounded-full before:content-[""]'
                    >
                      {line.text}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {hasModels && (
            <ModelBars
              distribution={distribution}
              topModel={token.top_model}
              totalRequests={token.requests ?? 0}
              topLabel={t('top')}
              previewCount={3}
            />
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

// 单个用户：默认展开（不可折叠），顶部是用户汇总行，下面平铺该用户的 token 列表。
function UserBlock({
  user,
  rank,
  reportDate,
}: {
  user: OverviewUserBreakdown
  rank: number
  reportDate?: string
}) {
  const { t } = useTranslation()
  const tokens = user.tokens ?? []
  const totalTokens = tokens.reduce(
    (sum, token) =>
      sum + (token.prompt_tokens ?? 0) + (token.completion_tokens ?? 0),
    0
  )
  return (
    <div className='flex flex-col gap-2'>
      <div className='flex items-center gap-3 px-1'>
        <span className='text-muted-foreground w-6 shrink-0 text-right font-mono text-xs tabular-nums'>
          #{rank}
        </span>
        <div className='flex min-w-0 flex-1 items-center gap-2'>
          {/* 点击用户名在新标签打开该用户的使用总结详情 */}
          {user.user_id != null ? (
            <a
              href={usageSummaryHref({ user: user.user_id, date: reportDate })}
              target='_blank'
              rel='noreferrer'
              title={t('Usage Summary')}
              className='inline-flex min-w-0 items-center gap-1 text-sm font-semibold hover:underline'
            >
              <span className='truncate'>
                {user.username || `User #${user.user_id}`}
              </span>
              <ExternalLink className='size-3 shrink-0 opacity-60' aria-hidden />
            </a>
          ) : (
            <span className='truncate text-sm font-semibold'>
              {user.username || 'User'}
            </span>
          )}
          <span className='text-muted-foreground shrink-0 text-xs'>
            #{user.user_id} · {tokens.length} {t('Active tokens')}
          </span>
        </div>
        <span className='hidden shrink-0 items-baseline gap-4 sm:flex'>
          <InlineMetric
            label={t('Requests')}
            value={formatInt(user.total_requests)}
          />
          <InlineMetric
            label={t('Total tokens')}
            value={formatCompact(totalTokens)}
          />
        </span>
        <span className='w-20 shrink-0 text-right font-mono text-sm font-semibold tabular-nums'>
          {user.total_quota != null
            ? formatQuotaWithCurrency(user.total_quota)
            : '—'}
        </span>
      </div>
      {tokens.length > 0 && (
        <div className='flex flex-col gap-1.5 pl-2 sm:pl-9'>
          {tokens.map((token) => (
            <TokenRow
              key={token.token_id ?? token.token_name}
              token={token}
              userId={user.user_id}
              reportDate={reportDate}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function DailyOverviewReport({ data }: { data: DailyOverview }) {
  const { t } = useTranslation()

  const overview = data.overview ?? {}
  const users = data.users ?? []

  const sortedUsers = useMemo(
    () =>
      [...(data.users ?? [])].sort(
        (a, b) => (b.total_quota ?? 0) - (a.total_quota ?? 0)
      ),
    [data.users]
  )
  const models = useMemo(() => aggregateModels(data.users ?? []), [data.users])

  const promptTotal = overview.total_prompt_tokens ?? 0
  const completionTotal = overview.total_completion_tokens ?? 0
  const totalRequests = overview.total_requests ?? 0

  // 上游 overview.total_tokens 可能异常，改用 prompt+completion 计算。
  const figures: Figure[] = [
    {
      label: t('Total users'),
      value: formatInt(overview.total_users ?? users.length),
    },
    { label: t('Requests'), value: formatInt(totalRequests) },
    {
      label: t('Total tokens'),
      value: formatCompact(promptTotal + completionTotal),
      title: formatInt(promptTotal + completionTotal),
      hint: `${formatCompact(promptTotal)} / ${formatCompact(completionTotal)}`,
    },
    {
      label: t('Quota'),
      value:
        overview.total_quota != null
          ? formatQuotaWithCurrency(overview.total_quota)
          : '—',
    },
    { label: t('Models used'), value: formatInt(models.uniqueModels) },
  ]

  return (
    <div className='mx-auto flex w-full max-w-7xl flex-col gap-4 pb-6 sm:gap-6'>
      {/* Overview: date + org-wide key metrics */}
      <Card>
        <CardContent className='space-y-5'>
          <div>
            <div className='text-primary text-[11px] font-semibold tracking-[0.16em] uppercase'>
              {t('Daily usage overview')}
              {data.version != null && (
                <span className='text-muted-foreground'> · v{data.version}</span>
              )}
            </div>
            <h2 className='mt-1.5 text-2xl font-semibold tracking-tight tabular-nums sm:text-3xl'>
              {data.date}
            </h2>
            <div className='text-muted-foreground mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm'>
              {data.timezone != null && <span>{data.timezone}</span>}
              {data.generated_at != null && (
                <>
                  <span aria-hidden>·</span>
                  <span>
                    {t('Generated')}{' '}
                    {formatDateTime(data.generated_at, data.timezone)}
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

      {/* Aggregate model usage across all users — 默认只显示前 3 条，可展开全部 */}
      {models.uniqueModels > 0 && (
        <SectionCard
          title={t('Models')}
          aside={`${formatInt(models.uniqueModels)} ${t('unique')}`}
        >
          <ModelBars
            distribution={models.distribution}
            topModel={models.topModel}
            totalRequests={totalRequests}
            topLabel={t('top')}
            previewCount={3}
          />
        </SectionCard>
      )}

      {/* 用户排行：全部用户平铺展开，每个 token 默认折叠 */}
      {sortedUsers.length > 0 && (
        <SectionCard title={t('Top users')} aside={`${formatInt(users.length)}`}>
          <div className='divide-border/60 flex flex-col divide-y'>
            {sortedUsers.map((user, index) => (
              <div
                key={user.user_id ?? user.username ?? index}
                className='py-3 first:pt-0 last:pb-0'
              >
                <UserBlock
                  user={user}
                  rank={index + 1}
                  reportDate={data.date}
                />
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  )
}
