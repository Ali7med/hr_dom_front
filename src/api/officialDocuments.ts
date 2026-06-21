import { apiClient } from './client'

// توليد المستندات الرسمية (BE-78): شهادة راتب / كتاب تعريف كـ PDF فوري (بلا تخزين).
export type OfficialDocType = 'salary-certificate' | 'employment-letter'

export const officialDocumentsApi = {
  // توليد مستند رسمي لموظف (PDF) — يتطلّب official_docs.generate.
  // period اختياري (لشهادة الراتب فقط؛ فارغ = أحدث كشف راتب).
  async downloadForUser(userId: number, type: OfficialDocType, period?: string): Promise<Blob> {
    const res = await apiClient.get(`/users/${userId}/official-documents/${type}`, {
      params: period ? { period } : {},
      responseType: 'blob',
    })
    return res.data as Blob
  },
}
