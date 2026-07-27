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
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

// 贴合报告卡片布局的骨架屏，比单个 spinner 更平滑。
const FIGURE_KEYS = ['requests', 'tokens', 'quota', 'latency', 'models']
const SECTION_KEYS = ['a', 'b']

export function ReportSkeleton() {
  return (
    <div className='mx-auto flex w-full max-w-7xl flex-col gap-4 pb-6 sm:gap-6'>
      <Card>
        <CardContent className='space-y-5'>
          <div className='space-y-2'>
            <Skeleton className='h-3 w-40' />
            <Skeleton className='h-8 w-64' />
            <Skeleton className='h-4 w-80 max-w-full' />
          </div>
          <div className='grid grid-cols-2 gap-4 border-t pt-4 sm:grid-cols-3 lg:grid-cols-5'>
            {FIGURE_KEYS.map((key) => (
              <div key={key} className='space-y-2'>
                <Skeleton className='h-3 w-16' />
                <Skeleton className='h-7 w-20' />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      {SECTION_KEYS.map((key) => (
        <Card key={key}>
          <CardHeader>
            <Skeleton className='h-4 w-28' />
          </CardHeader>
          <CardContent>
            <Skeleton className='h-24 w-full' />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
