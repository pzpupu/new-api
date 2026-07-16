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
import { RefreshCw } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
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
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import './i18n'
import { getUserReport, listUserReports } from './api'
import { ReportSkeleton } from './components/report-skeleton'
import { ReportViewer } from './components/report-viewer'
import { UserSelect } from './components/user-select'

const route = getRouteApi('/_authenticated/user-reports/')

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

export function UserReports() {
  const { t } = useTranslation()
  const navigate = route.useNavigate()
  const search = route.useSearch()
  const role = useAuthStore((s) => s.auth.user?.role) ?? 0
  const isAdmin = role >= ROLE.ADMIN

  // 选中项持久化在 URL：token / date，以及管理员的目标 user。
  const targetUserId = isAdmin ? search.user : undefined

  const listQuery = useQuery({
    queryKey: ['user-reports', 'list', targetUserId ?? 'self'],
    queryFn: () => listUserReports(targetUserId),
    staleTime: 60_000,
  })
  const listEnvelope = listQuery.data
  const entries = useMemo(
    () => (listEnvelope?.success ? (listEnvelope.data ?? []) : []),
    [listEnvelope]
  )
  const listErrored = listQuery.isError || listEnvelope?.success === false

  // 每个 token 取一个名称（列表里同一 token 的名称一致）。
  const tokens = useMemo(() => {
    const nameById = new Map<number, string>()
    entries.forEach((entry) => {
      if (!nameById.has(entry.token_id)) {
        nameById.set(entry.token_id, entry.token_name ?? '')
      }
    })
    return [...nameById.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.id - b.id)
  }, [entries])

  // 纯派生当前选中项：未选或已失效时回退到最新，避免额外的 effect。
  const effectiveTokenId =
    search.token != null && tokens.some((token) => token.id === search.token)
      ? search.token
      : tokens[0]?.id
  const selectedToken = tokens.find((token) => token.id === effectiveTokenId)

  const dates = useMemo(
    () =>
      entries
        .filter((entry) => entry.token_id === effectiveTokenId)
        .map((entry) => entry.date),
    [entries, effectiveTokenId]
  )
  const effectiveDate =
    search.date != null && dates.includes(search.date) ? search.date : dates[0]

  const contentQuery = useQuery({
    queryKey: [
      'user-reports',
      'content',
      targetUserId ?? 'self',
      effectiveTokenId,
      effectiveDate,
    ],
    queryFn: () =>
      getUserReport({
        targetUserId,
        tokenId: effectiveTokenId as number,
        date: effectiveDate as string,
      }),
    enabled: effectiveTokenId != null && effectiveDate != null,
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
    if (effectiveTokenId != null && effectiveDate != null) {
      contentQuery.refetch()
    }
  }

  let body: ReactNode
  if (listQuery.isLoading) {
    body = <ReportSkeleton />
  } else if (listErrored) {
    body = (
      <ErrorState
        message={t('Failed to load reports')}
        retryLabel={t('Retry')}
        onRetry={() => listQuery.refetch()}
      />
    )
  } else if (entries.length === 0) {
    body = <CenterState>{t('No reports found')}</CenterState>
  } else if (contentQuery.isLoading) {
    body = <ReportSkeleton />
  } else if (contentErrored) {
    body = (
      <ErrorState
        message={t('Failed to load report')}
        retryLabel={t('Retry')}
        onRetry={() => contentQuery.refetch()}
      />
    )
  } else if (content == null) {
    body = <CenterState>{t('No report for the selected date')}</CenterState>
  } else {
    body = <ReportViewer content={content} />
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Usage Summary')}</SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        {isAdmin && (
          <UserSelect
            value={targetUserId}
            onChange={(user) =>
              navigate({
                search: (prev) => ({
                  ...prev,
                  user,
                  token: undefined,
                  date: undefined,
                }),
              })
            }
            className='w-56'
          />
        )}
        {tokens.length > 0 && (
          <Select
            value={effectiveTokenId != null ? String(effectiveTokenId) : ''}
            onValueChange={(value) => {
              if (value == null) return
              navigate({
                search: (prev) => ({
                  ...prev,
                  token: Number(value),
                  date: undefined,
                }),
              })
            }}
          >
            <SelectTrigger className='h-8 w-48'>
              <SelectValue placeholder={t('Select token')}>
                {selectedToken &&
                  (selectedToken.name || `Token #${selectedToken.id}`)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {tokens.map((token) => (
                <SelectItem key={token.id} value={String(token.id)}>
                  {token.name || `Token #${token.id}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {dates.length > 0 && (
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
