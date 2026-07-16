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
import { api } from '@/lib/api'

import type { ApiEnvelope, UserReportContent, UserReportEntry } from './types'

// targetUserId 为空 => 查看自己（/self 路由）；有值 => 管理员按 user_id 查看他人。
export async function listUserReports(
  targetUserId?: number
): Promise<ApiEnvelope<UserReportEntry[]>> {
  const path =
    targetUserId != null
      ? `/api/user_report?user_id=${targetUserId}`
      : '/api/user_report/self'
  const res = await api.get(path)
  return res.data
}

export async function getUserReport(params: {
  targetUserId?: number
  tokenId: number
  date: string
}): Promise<ApiEnvelope<UserReportContent | null>> {
  const query = new URLSearchParams({
    token_id: String(params.tokenId),
    date: params.date,
  })
  if (params.targetUserId != null) {
    query.set('user_id', String(params.targetUserId))
  }
  const base =
    params.targetUserId != null
      ? '/api/user_report/content'
      : '/api/user_report/self/content'
  const res = await api.get(`${base}?${query.toString()}`)
  return res.data
}
