import { apiClient, unwrap } from './client'

// أنواع يدوية مبنية على عقد BE-70 (NotificationSettings) — إعدادات إشعارات لكل شركة.
// الأسرار (توكن تلكرام + كلمة مرور SMTP) writeOnly: تُرسَل في PUT فقط ولا تُعاد في GET
// (يُعاد بدلها علم `*_set`). تُخزَّن مشفّرة على الخادم (ADR-0004).

export type MailEncryption = 'tls' | 'ssl' | null

// شكل GET: الإعدادات غير الحسّاسة + علمَا وجود الأسرار.
export interface NotificationSettings {
  telegram_enabled: boolean
  telegram_bot_token_set: boolean
  telegram_chat_ids: string[]
  smtp_enabled: boolean
  mail_host: string | null
  mail_port: number | null
  mail_encryption: MailEncryption
  mail_username: string | null
  mail_password_set: boolean
  mail_from_address: string | null
  mail_from_name: string | null
  notify_emails: string[]
}

// حمولة PUT: كل الحقول اختيارية؛ الأسرار تُرسَل عند الإدخال فقط (فارغ = إبقاء الحالي).
export interface NotificationSettingsPayload {
  telegram_enabled?: boolean
  telegram_bot_token?: string | null
  telegram_chat_ids?: string[]
  smtp_enabled?: boolean
  mail_host?: string | null
  mail_port?: number | null
  mail_encryption?: MailEncryption
  mail_username?: string | null
  mail_password?: string | null
  mail_from_address?: string | null
  mail_from_name?: string | null
  notify_emails?: string[]
}

export interface NotificationTestResult {
  sent?: boolean
  message?: string
}

export const notificationSettingsApi = {
  get(companyId: number) {
    return unwrap<NotificationSettings>(apiClient.get(`/companies/${companyId}/notification-settings`))
  },
  update(companyId: number, payload: NotificationSettingsPayload) {
    return unwrap<NotificationSettings>(apiClient.put(`/companies/${companyId}/notification-settings`, payload))
  },
  // إرسال رسالة/إيميل اختباري للتحقّق من الإعداد (لا يحفظ شيئاً).
  test(companyId: number, body: { channel: 'telegram' | 'email'; target?: string }) {
    return unwrap<NotificationTestResult>(
      apiClient.post(`/companies/${companyId}/notification-settings/test`, body),
    )
  },
}
