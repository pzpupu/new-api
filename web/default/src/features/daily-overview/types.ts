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
// 每日总览列表项（不含正文），对应后端 service.DailyOverviewEntry。
export interface DailyOverviewEntry {
  date: string
  key: string
  size: number
  last_modified: number
}

// 每日总览正文由外部应用生成（report_type=daily_overview）。字段全部可选，
// 缺失/改名时优雅降级而非崩溃，与 user-reports 的 DailySummary 处理一致。
export interface OverviewLatency {
  avg_s?: number
  p50_s?: number
  p95_s?: number
}

export interface OverviewTokenBreakdown {
  token_id?: number
  token_name?: string
  requests?: number
  prompt_tokens?: number
  completion_tokens?: number
  quota?: number
  top_model?: string
  model_distribution?: Record<string, number>
  latency?: OverviewLatency
  task_types?: string[]
  topic_summary?: string
}

export interface OverviewUserBreakdown {
  user_id?: number
  username?: string
  total_requests?: number
  total_quota?: number
  tokens?: OverviewTokenBreakdown[]
}

export interface OverviewTotals {
  total_users?: number
  total_requests?: number
  total_prompt_tokens?: number
  total_completion_tokens?: number
  // 上游 total_tokens 可能异常，前端不采信，改用 prompt+completion 计算。
  total_tokens?: number
  total_quota?: number
}

export interface DailyOverview {
  date?: string
  generated_at?: string
  timezone?: string
  report_type?: string
  version?: string
  overview?: OverviewTotals
  users?: OverviewUserBreakdown[]
}

export interface ApiEnvelope<T> {
  success: boolean
  message?: string
  data?: T
}
