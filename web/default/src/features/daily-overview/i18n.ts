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
import i18n from '@/i18n/config'

// 「管理员每日总览」的翻译 key 在运行时注册，避免改动上游 locale JSON（便于与官方仓库对齐）。
// app 已有的通用 key（Requests / Total tokens / Quota / Models / Latency / Select date /
// Refresh / Retry / Loading... / Raw JSON 等）不在此重复，沿用现有翻译。
const resources: Record<string, Record<string, string>> = {
  en: {
    'Usage Overview': 'Usage Overview',
    'Daily usage overview': 'Daily usage overview',
    'Total users': 'Total users',
    'Active tokens': 'active tokens',
    'Models used': 'Models used',
    'Avg latency': 'Avg latency',
    'Prompt tokens': 'Prompt tokens',
    'Completion tokens': 'Completion tokens',
    Generated: 'Generated',
    top: 'top',
    unique: 'unique',
    'Top users': 'Top users',
    'No overview found': 'No overview found',
    'No overview for the selected date': 'No overview for the selected date',
    'Failed to load overview': 'Failed to load overview',
    'Previous day': 'Previous day',
    'Next day': 'Next day',
    'Show less': 'Show less',
    'Show all {{total}} models': 'Show all {{total}} models',
  },
  zhCN: {
    'Usage Overview': '使用总览',
    'Daily usage overview': '每日使用总览',
    'Total users': '用户总数',
    'Active tokens': '个活跃令牌',
    'Models used': '使用模型数',
    'Avg latency': '平均延迟',
    'Prompt tokens': '输入 Token',
    'Completion tokens': '输出 Token',
    Generated: '生成于',
    top: '最多',
    unique: '种',
    'Top users': '用户排行',
    'No overview found': '暂无总览',
    'No overview for the selected date': '所选日期暂无总览',
    'Failed to load overview': '加载总览失败',
    'Previous day': '前一天',
    'Next day': '后一天',
    'Show less': '收起',
    'Show all {{total}} models': '显示全部 {{total}} 个模型',
  },
  zhTW: {
    'Usage Overview': '使用總覽',
    'Daily usage overview': '每日使用總覽',
    'Total users': '使用者總數',
    'Active tokens': '個活躍權杖',
    'Models used': '使用模型數',
    'Avg latency': '平均延遲',
    'Prompt tokens': '輸入 Token',
    'Completion tokens': '輸出 Token',
    Generated: '產生於',
    top: '最多',
    unique: '種',
    'Top users': '使用者排行',
    'No overview found': '找不到總覽',
    'No overview for the selected date': '所選日期沒有總覽',
    'Failed to load overview': '載入總覽失敗',
    'Previous day': '前一天',
    'Next day': '後一天',
    'Show less': '收起',
    'Show all {{total}} models': '顯示全部 {{total}} 個模型',
  },
  ja: {
    'Usage Overview': '利用概況',
    'Daily usage overview': '日次利用概況',
    'Total users': 'ユーザー総数',
    'Active tokens': '個のアクティブトークン',
    'Models used': '使用モデル数',
    'Avg latency': '平均レイテンシ',
    'Prompt tokens': '入力トークン',
    'Completion tokens': '出力トークン',
    Generated: '生成日時',
    top: '最多',
    unique: '種類',
    'Top users': 'ユーザーランキング',
    'No overview found': '概況がありません',
    'No overview for the selected date': '選択した日付の概況はありません',
    'Failed to load overview': '概況の読み込みに失敗しました',
    'Previous day': '前日',
    'Next day': '翌日',
    'Show less': '折りたたむ',
    'Show all {{total}} models': '{{total}} 個のモデルをすべて表示',
  },
  ru: {
    'Usage Overview': 'Обзор использования',
    'Daily usage overview': 'Ежедневный обзор использования',
    'Total users': 'Всего пользователей',
    'Active tokens': 'активных токенов',
    'Models used': 'Моделей использовано',
    'Avg latency': 'Ср. задержка',
    'Prompt tokens': 'Входные токены',
    'Completion tokens': 'Выходные токены',
    Generated: 'Создано',
    top: 'топ',
    unique: 'уник.',
    'Top users': 'Топ пользователей',
    'No overview found': 'Обзор не найден',
    'No overview for the selected date': 'Нет обзора за выбранную дату',
    'Failed to load overview': 'Не удалось загрузить обзор',
    'Previous day': 'Предыдущий день',
    'Next day': 'Следующий день',
    'Show less': 'Свернуть',
    'Show all {{total}} models': 'Показать все {{total}} моделей',
  },
  fr: {
    'Usage Overview': "Aperçu d'utilisation",
    'Daily usage overview': "Aperçu d'utilisation quotidien",
    'Total users': "Nombre d'utilisateurs",
    'Active tokens': 'jetons actifs',
    'Models used': 'Modèles utilisés',
    'Avg latency': 'Latence moy.',
    'Prompt tokens': "Tokens d'entrée",
    'Completion tokens': 'Tokens de sortie',
    Generated: 'Généré',
    top: 'top',
    unique: 'uniques',
    'Top users': 'Utilisateurs principaux',
    'No overview found': 'Aucun aperçu trouvé',
    'No overview for the selected date':
      'Aucun aperçu pour la date sélectionnée',
    'Failed to load overview': "Échec du chargement de l'aperçu",
    'Previous day': 'Jour précédent',
    'Next day': 'Jour suivant',
    'Show less': 'Réduire',
    'Show all {{total}} models': 'Afficher les {{total}} modèles',
  },
  vi: {
    'Usage Overview': 'Tổng quan sử dụng',
    'Daily usage overview': 'Tổng quan sử dụng hằng ngày',
    'Total users': 'Tổng người dùng',
    'Active tokens': 'token hoạt động',
    'Models used': 'Số mô hình đã dùng',
    'Avg latency': 'Độ trễ TB',
    'Prompt tokens': 'Token đầu vào',
    'Completion tokens': 'Token đầu ra',
    Generated: 'Tạo lúc',
    top: 'cao nhất',
    unique: 'duy nhất',
    'Top users': 'Người dùng hàng đầu',
    'No overview found': 'Không tìm thấy tổng quan',
    'No overview for the selected date': 'Không có tổng quan cho ngày đã chọn',
    'Failed to load overview': 'Không tải được tổng quan',
    'Previous day': 'Ngày trước',
    'Next day': 'Ngày sau',
    'Show less': 'Thu gọn',
    'Show all {{total}} models': 'Hiển thị tất cả {{total}} mô hình',
  },
}

// overwrite=false：不覆盖 app 已有的同名 key。
for (const [lng, keys] of Object.entries(resources)) {
  i18n.addResourceBundle(lng, 'translation', keys, true, false)
}
