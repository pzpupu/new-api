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
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Combobox } from '@/components/ui/combobox'
import { searchUsers } from '@/features/users/api'

// 管理员用的用户选择器：复用现有 Combobox + searchUsers。
// ponytail: 目前加载首页用户（前 100）在本地按用户名/ID 过滤，覆盖绝大多数实例；
// 若某实例用户量极大需要服务端搜索，再升级为按输入词查询。
export function UserSelect({
  value,
  onChange,
  className,
}: {
  value?: number
  onChange: (userId?: number) => void
  className?: string
}) {
  const { t } = useTranslation()
  const usersQuery = useQuery({
    queryKey: ['user-reports', 'user-options'],
    queryFn: () => searchUsers({ keyword: '', page_size: 100 }),
    staleTime: 300_000,
  })
  const options = useMemo(() => {
    const items = usersQuery.data?.data?.items ?? []
    return items.map((user) => ({
      value: String(user.id),
      label: `${user.username} (#${user.id})`,
    }))
  }, [usersQuery.data])

  return (
    <Combobox
      options={options}
      value={value != null ? String(value) : ''}
      onValueChange={(next) => onChange(next ? Number(next) : undefined)}
      placeholder={t('Search user')}
      searchPlaceholder={t('Search user')}
      emptyText={t('No users found')}
      allowCustomValue={false}
      className={className}
    />
  )
}
