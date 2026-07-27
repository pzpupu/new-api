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
import { createFileRoute, redirect } from '@tanstack/react-router'
import z from 'zod'

import { DailyOverviewPage } from '@/features/daily-overview'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

// 仅按日期选择，持久化到 URL，刷新/分享/前进后退都稳定。
const dailyOverviewSearchSchema = z.object({
  date: z.string().optional().catch(undefined),
})

export const Route = createFileRoute('/_authenticated/daily-overview/')({
  // 管理员每日总览为全站聚合，路由级硬门禁：非管理员跳 403。
  beforeLoad: () => {
    const { auth } = useAuthStore.getState()

    if (!auth.user || auth.user.role < ROLE.ADMIN) {
      throw redirect({
        to: '/403',
      })
    }
  },
  validateSearch: dailyOverviewSearchSchema,
  component: DailyOverviewPage,
})
