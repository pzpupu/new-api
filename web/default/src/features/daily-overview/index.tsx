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
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ReportSkeleton } from '@/features/user-reports/components/report-skeleton'

import './i18n'
import { getDailyOverview, listDailyOverviews } from './api'
import { DailyOverviewReport } from './components/daily-overview-report'

const route = getRouteApi('/_authenticated/daily-overview/')

function CenterState({ children }: { children: ReactNode }) {
  return (
    <div className='text-muted-foreground flex h-full min-h-40 items-center justify-center gap-2 text-sm'>
      {children}
    </div>
  )
}

function ErrorState({
  message,
  retryLabel,
  onRetry,
}: {
  message: string
  retryLabel: string
  onRetry: () => void
}) {
  return (
    <div className='flex h-full min-h-40 flex-col items-center justify-center gap-3 text-sm'>
      <span className='text-muted-foreground'>{message}</span>
      <Button variant='outline' size='sm' onClick={onRetry}>
        {retryLabel}
      </Button>
    </div>
  )
}

export function DailyOverviewPage() {
  const { t } = useTranslation()
  const navigate = route.useNavigate()
  const search = route.useSearch()

  const listQuery = useQuery({
    queryKey: ['daily-overview', 'list'],
    queryFn: () => listDailyOverviews(),
    staleTime: 60_000,
  })
  const listEnvelope = listQuery.data
  const entries = useMemo(
    () => (listEnvelope?.success ? (listEnvelope.data ?? []) : []),
    [listEnvelope]
  )
  const listErrored = listQuery.isError || listEnvelope?.success === false

  const dates = useMemo(() => entries.map((entry) => entry.date), [entries])
  // 纯派生当前选中日期：未选或已失效时回退到最新（列表已按日期倒序）。
  const effectiveDate =
    search.date != null && dates.includes(search.date) ? search.date : dates[0]

  const contentQuery = useQuery({
    queryKey: ['daily-overview', 'content', effectiveDate],
    queryFn: () => getDailyOverview(effectiveDate as string),
    enabled: effectiveDate != null,
    staleTime: 60_000,
  })
  const contentEnvelope = contentQuery.data
  const content = contentEnvelope?.success
    ? (contentEnvelope.data ?? null)
    : null
  const contentErrored =
    contentQuery.isError || contentEnvelope?.success === false

  const isFetching = listQuery.isFetching || contentQuery.isFetching
  const refetchAll = () => {
    listQuery.refetch()
    if (effectiveDate != null) {
      contentQuery.refetch()
    }
  }

  // 相邻日期步进：dates 已按日期倒序（最新在前），下标越大日期越旧。
  const dateIndex = effectiveDate != null ? dates.indexOf(effectiveDate) : -1
  const olderDate = dateIndex >= 0 ? dates[dateIndex + 1] : undefined
  const newerDate = dateIndex > 0 ? dates[dateIndex - 1] : undefined
  const goToDate = useCallback(
    (nextDate?: string) => {
      if (nextDate == null) return
      navigate({ search: (prev) => ({ ...prev, date: nextDate }) })
    },
    [navigate]
  )

  // 把相邻日期放进 ref，供全局键盘监听读取最新值，避免监听器随日期变化反复重订阅。
  const stepDatesRef = useRef<{ older?: string; newer?: string }>({})
  stepDatesRef.current = { older: olderDate, newer: newerDate }

  // 键盘 ← / → 快速翻天。焦点在输入框/下拉/按钮/弹窗上，或按键自动重复时不拦截。
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.repeat) return
      if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return
      }
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
      const el = document.activeElement as HTMLElement | null
      if (
        el != null &&
        (el.tagName === 'INPUT' ||
          el.tagName === 'TEXTAREA' ||
          el.tagName === 'SELECT' ||
          el.tagName === 'BUTTON' ||
          el.isContentEditable ||
          el.getAttribute('role') === 'combobox' ||
          el.getAttribute('role') === 'button' ||
          el.closest('[role="listbox"],[role="dialog"]') != null)
      ) {
        return
      }
      const older = stepDatesRef.current.older
      const newer = stepDatesRef.current.newer
      if (event.key === 'ArrowLeft' && older != null) {
        event.preventDefault()
        goToDate(older)
      } else if (event.key === 'ArrowRight' && newer != null) {
        event.preventDefault()
        goToDate(newer)
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [goToDate])

  let body: ReactNode
  if (listQuery.isLoading) {
    body = <ReportSkeleton />
  } else if (listErrored) {
    body = (
      <ErrorState
        message={t('Failed to load overview')}
        retryLabel={t('Retry')}
        onRetry={() => listQuery.refetch()}
      />
    )
  } else if (entries.length === 0) {
    body = <CenterState>{t('No overview found')}</CenterState>
  } else if (contentQuery.isLoading) {
    body = <ReportSkeleton />
  } else if (contentErrored) {
    body = (
      <ErrorState
        message={t('Failed to load overview')}
        retryLabel={t('Retry')}
        onRetry={() => contentQuery.refetch()}
      />
    )
  } else if (content == null) {
    body = <CenterState>{t('No overview for the selected date')}</CenterState>
  } else {
    body = <DailyOverviewReport data={content} />
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Usage Overview')}</SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        {dates.length > 0 && (
          <div className='flex items-center gap-1'>
            <Button
              variant='outline'
              size='icon'
              disabled={olderDate == null}
              onClick={() => goToDate(olderDate)}
              aria-label={t('Previous day')}
              title={t('Previous day')}
            >
              <ChevronLeft />
            </Button>
            <Select
              value={effectiveDate ?? ''}
              onValueChange={(value) =>
                navigate({
                  search: (prev) => ({ ...prev, date: value ?? undefined }),
                })
              }
            >
              <SelectTrigger className='h-8 w-40'>
                <SelectValue placeholder={t('Select date')} />
              </SelectTrigger>
              <SelectContent>
                {dates.map((date) => (
                  <SelectItem key={date} value={date}>
                    {date}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant='outline'
              size='icon'
              disabled={newerDate == null}
              onClick={() => goToDate(newerDate)}
              aria-label={t('Next day')}
              title={t('Next day')}
            >
              <ChevronRight />
            </Button>
          </div>
        )}
        <Button
          variant='outline'
          size='icon'
          onClick={refetchAll}
          aria-label={t('Refresh')}
          title={t('Refresh')}
        >
          <RefreshCw className={isFetching ? 'animate-spin' : undefined} />
        </Button>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>{body}</SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
