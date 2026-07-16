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
// 数值格式化助手，与 user-reports 的 daily-report.tsx 同款；此处独立一份，
// 让 daily-overview 特性自包含、不影响既有 user-reports 特性。

function trimZeros(text: string): string {
  return text.includes('.') ? text.replace(/\.?0+$/, '') : text
}

// 紧凑计数：K/M/B，缺失/非有限值显示 em dash。
export function formatCompact(value?: number): string {
  if (value == null || !Number.isFinite(value)) return '—'
  const abs = Math.abs(value)
  if (abs >= 1e9) return `${trimZeros((value / 1e9).toFixed(2))}B`
  if (abs >= 1e6) return `${trimZeros((value / 1e6).toFixed(2))}M`
  if (abs >= 1e4) return `${trimZeros((value / 1e3).toFixed(1))}K`
  return value.toLocaleString()
}

export function formatInt(value?: number): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return Math.round(value).toLocaleString()
}

export function formatSeconds(value?: number): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return Number.isInteger(value) ? `${value}s` : `${value.toFixed(1)}s`
}

// 按报告自身时区显示 YYYY-MM-DD HH:mm，跨时区查看也一致。
export function formatDateTime(iso?: string, timeZone?: string): string {
  if (!iso) return '—'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  try {
    return new Intl.DateTimeFormat('sv-SE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: timeZone || undefined,
    }).format(date)
  } catch {
    return iso
  }
}

// 解析 topic_summary：保留 "•" 要点，剔除冗余的日期/标签抬头行（标签已由 chips 承载）。
export function parseTopicSummary(
  text?: string,
  reportDate?: string
): { leadLines: string[]; bullets: string[] } {
  const lines = (text ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  const bullets = lines
    .filter((line) => line.startsWith('•'))
    .map((line) => line.replace(/^•\s*/, ''))
  const leadLines = lines.filter(
    (line) =>
      !line.startsWith('•') &&
      !line.startsWith('标签') &&
      !(reportDate != null && line.includes(reportDate))
  )
  return { leadLines, bullets }
}

// 为可能重复的文本行生成稳定唯一的 React key（内容派生，非数组下标）。
export function keyedLines(lines: string[]): { key: string; text: string }[] {
  const seen = new Map<string, number>()
  return lines.map((text) => {
    const seq = seen.get(text) ?? 0
    seen.set(text, seq + 1)
    return { key: seq === 0 ? text : `${text}#${seq}`, text }
  })
}
