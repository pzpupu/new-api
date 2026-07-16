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
import { Loader2 } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import { getUserReport, listUserReports } from './api'
import { ReportViewer } from './components/report-viewer'

function CenterState({ children }: { children: ReactNode }) {
  return (
    <div className='text-muted-foreground flex h-full min-h-40 items-center justify-center gap-2 text-sm'>
      {children}
    </div>
  )
}

export function UserReports() {
  const { t } = useTranslation()
  const role = useAuthStore((s) => s.auth.user?.role) ?? 0
  const isAdmin = role >= ROLE.ADMIN

  // 管理员可输入 user_id 查看他人；为空则查看自己。
  const [targetUserId, setTargetUserId] = useState<number | undefined>(
    undefined
  )
  const [userIdInput, setUserIdInput] = useState('')
  const [selectedTokenId, setSelectedTokenId] = useState<number | undefined>(
    undefined
  )
  const [selectedDate, setSelectedDate] = useState<string | undefined>(
    undefined
  )

  const listQuery = useQuery({
    queryKey: ['user-reports', 'list', targetUserId ?? 'self'],
    queryFn: () => listUserReports(targetUserId),
    select: (res) => (res.success ? (res.data ?? []) : []),
    staleTime: 60_000,
  })
  const entries = useMemo(() => listQuery.data ?? [], [listQuery.data])

  const tokenIds = useMemo(() => {
    const set = new Set<number>()
    entries.forEach((entry) => set.add(entry.token_id))
    return [...set].sort((a, b) => a - b)
  }, [entries])

  // 纯派生当前选中项：未选或选中项已失效时回退到最新，避免额外的 effect。
  const effectiveTokenId =
    selectedTokenId != null && tokenIds.includes(selectedTokenId)
      ? selectedTokenId
      : tokenIds[0]

  const dates = useMemo(
    () =>
      entries
        .filter((entry) => entry.token_id === effectiveTokenId)
        .map((entry) => entry.date),
    [entries, effectiveTokenId]
  )
  const effectiveDate =
    selectedDate != null && dates.includes(selectedDate)
      ? selectedDate
      : dates[0]

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
    select: (res) => (res.success ? (res.data ?? null) : null),
    staleTime: 60_000,
  })

  const commitUserId = () => {
    const trimmed = userIdInput.trim()
    const parsed = Number(trimmed)
    setTargetUserId(
      trimmed && Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
    )
    setSelectedTokenId(undefined)
    setSelectedDate(undefined)
  }

  const loadingState = (
    <CenterState>
      <Loader2 className='size-4 animate-spin' />
      {t('Loading...')}
    </CenterState>
  )

  let body: ReactNode
  if (listQuery.isLoading) {
    body = loadingState
  } else if (entries.length === 0) {
    body = <CenterState>{t('No reports found')}</CenterState>
  } else if (contentQuery.isLoading) {
    body = loadingState
  } else if (contentQuery.data == null) {
    body = <CenterState>{t('No report for the selected date')}</CenterState>
  } else {
    body = <ReportViewer content={contentQuery.data} />
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Usage Summary')}</SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        {isAdmin && (
          <Input
            value={userIdInput}
            onChange={(event) => setUserIdInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') commitUserId()
            }}
            onBlur={commitUserId}
            placeholder={t('User ID (admin)')}
            inputMode='numeric'
            className='h-8 w-36'
          />
        )}
        {tokenIds.length > 0 && (
          <Select
            value={effectiveTokenId != null ? String(effectiveTokenId) : ''}
            onValueChange={(value) => {
              if (value == null) return
              setSelectedTokenId(Number(value))
              setSelectedDate(undefined)
            }}
          >
            <SelectTrigger className='h-8 w-40'>
              <SelectValue placeholder={t('Select token')} />
            </SelectTrigger>
            <SelectContent>
              {tokenIds.map((id) => (
                <SelectItem key={id} value={String(id)}>
                  {`Token #${id}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {dates.length > 0 && (
          <Select
            value={effectiveDate ?? ''}
            onValueChange={(value) => setSelectedDate(value ?? undefined)}
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
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>{body}</SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
