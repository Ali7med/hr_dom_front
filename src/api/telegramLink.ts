import { apiClient, unwrap } from './client'

// أنواع مبنية على عقد BE-75 (ApprovalBot) — ربط حساب تيليجرام لبوت الموافقات.
// GET الحالة من :8000: { linked, telegram_username, bot_username }. POST يولّد كوداً + رابط deep-link.

export interface TelegramLinkStatus {
  linked: boolean
  telegram_username: string | null
  bot_username: string | null
}

// استجابة توليد الكود — أسماء حقول دفاعية (deep_link/link/url) + كود + انتهاء.
export interface TelegramLinkCode {
  deep_link?: string | null
  link?: string | null
  url?: string | null
  code?: string | null
  expires_at?: string | null
  bot_username?: string | null
}

export const telegramLinkApi = {
  get() {
    return unwrap<TelegramLinkStatus>(apiClient.get('/me/telegram-link'))
  },
  // يولّد كوداً لمرة واحدة ويُرجِع رابط deep-link للبوت.
  create() {
    return unwrap<TelegramLinkCode>(apiClient.post('/me/telegram-link'))
  },
  remove() {
    return unwrap<{ unlinked?: boolean }>(apiClient.delete('/me/telegram-link'))
  },
}

// يستخرج رابط الـ deep-link من الاستجابة (أيّ اسم حقل متاح).
export function deepLinkOf(c: TelegramLinkCode | null | undefined): string | null {
  return c?.deep_link ?? c?.link ?? c?.url ?? null
}
