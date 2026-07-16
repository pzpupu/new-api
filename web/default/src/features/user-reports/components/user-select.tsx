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
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Combobox,
  ComboboxCollection,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox'
import { searchUsers } from '@/features/users/api'
import { useDebounce } from '@/hooks/use-debounce'

// 管理员用的用户选择器：按关键词做服务端搜索，覆盖任意规模的用户量
// （后端 /api/user/search 支持按用户名或 ID 搜索）。清除按钮可回到「查看自己」。
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
  const [inputValue, setInputValue] = useState('')
  // 记住选中项的展示名：选完后搜索词会变、结果里可能不再含该用户，
  // 靠它保证输入框仍显示「用户名 (#id)」而不是退化成「#id」。
  const [selectedLabel, setSelectedLabel] = useState<string>()
  const keyword = useDebounce(inputValue.trim(), 300)

  const usersQuery = useQuery({
    queryKey: ['user-reports', 'user-search', keyword],
    queryFn: () => searchUsers({ keyword, page_size: 20 }),
    staleTime: 60_000,
  })

  // 结果 id 列表 + id->展示名映射；把当前选中项并入，保证选中值即使不在
  // 当前搜索结果里也能正确显示。
  const { itemIds, labelMap } = useMemo(() => {
    const ids: string[] = []
    const map = new Map<string, string>()
    for (const user of usersQuery.data?.data?.items ?? []) {
      const id = String(user.id)
      if (!map.has(id)) ids.push(id)
      map.set(id, `${user.username} (#${user.id})`)
    }
    if (value != null && !map.has(String(value))) {
      const id = String(value)
      map.set(id, selectedLabel ?? `#${value}`)
      ids.unshift(id)
    }
    return { itemIds: ids, labelMap: map }
  }, [usersQuery.data, value, selectedLabel])

  return (
    <Combobox
      items={itemIds}
      value={value != null ? String(value) : null}
      onValueChange={(next: string | null) => {
        setSelectedLabel(next ? labelMap.get(next) : undefined)
        onChange(next ? Number(next) : undefined)
      }}
      onInputValueChange={(text: string) => setInputValue(text)}
      itemToStringLabel={(id: string) => labelMap.get(id) ?? `#${id}`}
      filter={null}
    >
      <ComboboxInput
        showClear
        placeholder={t('Search user')}
        className={className}
      />
      <ComboboxContent>
        <ComboboxList>
          <ComboboxCollection>
            {(id: string) => (
              <ComboboxItem key={id} value={id}>
                {labelMap.get(id) ?? `#${id}`}
              </ComboboxItem>
            )}
          </ComboboxCollection>
        </ComboboxList>
        <ComboboxEmpty>{t('No users found')}</ComboboxEmpty>
      </ComboboxContent>
    </Combobox>
  )
}
