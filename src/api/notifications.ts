import { apiClient } from './client'

// مركز الإشعارات الموحّد (BE-96) — feed الأحداث التشغيلية المنشورة من كل الميزات،
// مفلتراً تلقائياً بصلاحيات المستخدم وشركته. يستهلكه جرس النابار (FE-52).

export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error'

export interface NotificationItem {
  id: number
  // نوع/مصدر الإشعار (device_rebind_requested · backup_succeeded · backup_failed · queue_job_failed · document_expiring …)
  type: string
  severity: NotificationSeverity
  title: string
  body?: string | null
  // مسار اللوحة للانتقال عند النقر (مثل /settings/devices).
  link?: string | null
  data?: Record<string, unknown> | null
  read_at?: string | null
  created_at: string
}

export interface NotificationFeed {
  items: NotificationItem[]
  unreadCount: number
}

export const notificationsApi = {
  // feed كامل + عدّاد غير المقروء من meta. فلاتر اختيارية (unread/type/per_page).
  async list(params?: { unread?: boolean; type?: string; per_page?: number }): Promise<NotificationFeed> {
    const res = await apiClient.get('/me/notifications', { params })
    const meta = (res.data.meta ?? {}) as { unread_count?: number }
    return {
      items: (res.data.data ?? []) as NotificationItem[],
      unreadCount: Number(meta.unread_count ?? 0),
    }
  },

  // عدّاد غير المقروء فقط (للاستطلاع الخفيف للشارة).
  async unreadCount(): Promise<number> {
    const res = await apiClient.get('/me/notifications/unread-count')
    const data = (res.data.data ?? {}) as { unread_count?: number }
    return Number(data.unread_count ?? 0)
  },

  async markRead(id: number): Promise<void> {
    await apiClient.post(`/me/notifications/${id}/read`)
  },

  async markAllRead(): Promise<void> {
    await apiClient.post('/me/notifications/read-all')
  },
}
