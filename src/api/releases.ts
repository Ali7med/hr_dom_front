import { apiClient, unwrap } from './client'

// ملاحظات الإصدارات «ما الجديد» (BE-99) — وسم Releases.
// محتوى عام ثنائي اللغة؛ الإدارة (CRUD) مقصورة على releases.manage (Super Admin).

export type ReleasePlatform = 'panel' | 'app' | 'all'

export interface LocalizedText {
  ar: string
  en: string
}

export interface ReleaseEntries {
  new?: LocalizedText[]
  improved?: LocalizedText[]
  fixed?: LocalizedText[]
}

export interface ReleaseItem {
  id: number
  platform: ReleasePlatform
  version: string
  released_at: string
  title?: LocalizedText | null
  is_published: boolean
  entries: ReleaseEntries
  created_at?: string
}

export interface ReleaseInput {
  platform: ReleasePlatform
  version: string
  released_at: string
  title?: LocalizedText | null
  is_published?: boolean
  entries: ReleaseEntries
}

export interface ReleaseListParams {
  platform?: ReleasePlatform
  include_unpublished?: boolean
  per_page?: number
}

export const releasesApi = {
  list(params: ReleaseListParams = {}) {
    return unwrap<ReleaseItem[]>(apiClient.get('/releases', { params }))
  },
  create(payload: ReleaseInput) {
    return unwrap<ReleaseItem>(apiClient.post('/releases', payload))
  },
  update(id: number, payload: ReleaseInput) {
    return unwrap<ReleaseItem>(apiClient.put(`/releases/${id}`, payload))
  },
  remove(id: number) {
    return unwrap<{ deleted: boolean }>(apiClient.delete(`/releases/${id}`))
  },
}

// تتبّع «آخر مشاهَدة» عبر تفضيلات المستخدم (BE-FE12) — مفتاح seen_release.panel.
// الدمج في /me/preferences سطحي (يستبدل المفتاح الأعلى)، فنقرأ الكائن الحالي ونحافظ على بقيّة المنصّات (app للموبايل).
export interface SeenRelease {
  panel?: string
  app?: string
}

export const releaseSeen = {
  async get(): Promise<SeenRelease> {
    try {
      const data = await unwrap<{ seen_release?: SeenRelease }>(apiClient.get('/me/preferences'))
      return data?.seen_release ?? {}
    } catch {
      return {}
    }
  },
  // يحافظ على المفاتيح الأخرى (app) عند تحديث panel.
  async setPanel(version: string): Promise<void> {
    const current = await this.get()
    try {
      await apiClient.put('/me/preferences', { seen_release: { ...current, panel: version } })
    } catch {
      // فشل المزامنة — تجاهل (تظهر النافذة مجدداً عند التحديث القادم فقط)
    }
  },
}
