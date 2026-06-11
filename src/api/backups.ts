import { apiClient, unwrap, type Envelope } from './client'
import type { Pagination } from './users'

// أنواع يدوية مبنية على عقد BE-64/BE-65 (Backups) — إدارة النسخ الاحتياطية (Super Admin).
// الردود بالغلاف الموحّد؛ بنية سجلّ النسخة دفاعية لأن الباك (BE-64/65) لم يُنشر بعد.

export type BackupStatus = 'success' | 'failed' | 'running' | 'pending'
export type BackupFrequency = 'daily' | 'weekly' | 'monthly'

export interface Backup {
  id: number
  status: BackupStatus | string
  // الحجم قد يأتي بايتات (size_bytes/size) أو نصّاً جاهزاً (size_human).
  size_bytes?: number | null
  size?: number | null
  size_human?: string | null
  filename?: string | null
  error?: string | null
  created_at: string
}

export interface BackupSettings {
  scheduled_enabled: boolean
  frequency: BackupFrequency
  run_at: string // HH:mm
  retention_count: number | null // null = بلا حدّ
  attach_to_message: boolean
  notify_telegram_chat_ids: string[]
  notify_emails: string[]
}

export type BackupSettingsPayload = Partial<BackupSettings>

export const backupsApi = {
  // سجلّ النسخ (مرقّم).
  async list(
    params: { per_page?: number; page?: number } = {},
  ): Promise<{ data: Backup[]; pagination?: Pagination }> {
    const res = await apiClient.get<Envelope<Backup[]>>('/backups', { params })
    return { data: res.data.data, pagination: res.data.meta?.pagination as Pagination | undefined }
  },
  // تشغيل نسخة آنية (غير متزامن عبر الطابور — 202).
  create() {
    return unwrap<Backup | null>(apiClient.post('/backups'))
  },
  remove(id: number) {
    return unwrap<{ deleted: boolean }>(apiClient.delete(`/backups/${id}`))
  },
  // تنزيل ملف النسخة (رابط موقّع مؤقّت — نجلبه كـ blob ونحفظه).
  async download(id: number): Promise<Blob> {
    const res = await apiClient.get(`/backups/${id}/download`, { responseType: 'blob' })
    return res.data as Blob
  },
  getSettings() {
    return unwrap<BackupSettings>(apiClient.get('/backups/settings'))
  },
  updateSettings(payload: BackupSettingsPayload) {
    return unwrap<BackupSettings>(apiClient.put('/backups/settings', payload))
  },
}
