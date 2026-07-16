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

import type { ApiEnvelope, DailyOverview, DailyOverviewEntry } from './types'

// 列出 S3 中已有的每日总览日期（后端 AdminAuth，仅管理员）。
export async function listDailyOverviews(): Promise<
  ApiEnvelope<DailyOverviewEntry[]>
> {
  const res = await api.get('/api/user_report/daily_overview')
  return res.data
}

// 拉取某天的每日总览正文（不存在时后端返回 data:null 表示空态）。
export async function getDailyOverview(
  date: string
): Promise<ApiEnvelope<DailyOverview | null>> {
  const res = await api.get(
    `/api/user_report/daily_overview/content?date=${encodeURIComponent(date)}`
  )
  return res.data
}
