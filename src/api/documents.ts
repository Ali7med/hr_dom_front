import { apiClient, unwrap } from './client'

// أنواع يدوية مبنية على عقد BE-68 (Documents) — مستندات الموظف.
// رفع ملفات لكل موظف بأنواع + تاريخ انتهاء + تنبيه قبل الانتهاء. التخزين خارج public
// والتنزيل برابط موقّع. بنية السجل دفاعية (BE-68 غير منشور).

export interface EmployeeDocument {
  id: number
  user_id: number
  type: string
  title?: string | null
  path?: string | null
  size_bytes?: number | null
  expiry_date?: string | null
  uploaded_by?: number | null
  uploader?: { id: number; name: string } | null
  created_at?: string | null
}

export interface DocumentUploadPayload {
  type: string
  title?: string | null
  expiry_date?: string | null
  file: File
}

export const documentsApi = {
  // مستندات موظف — documents.view.
  listForUser(userId: number) {
    return unwrap<EmployeeDocument[]>(apiClient.get(`/users/${userId}/documents`))
  },
  // رفع مستند (multipart) — documents.manage.
  upload(userId: number, payload: DocumentUploadPayload) {
    const fd = new FormData()
    fd.append('type', payload.type)
    if (payload.title) fd.append('title', payload.title)
    if (payload.expiry_date) fd.append('expiry_date', payload.expiry_date)
    fd.append('file', payload.file)
    return unwrap<EmployeeDocument>(
      apiClient.post(`/users/${userId}/documents`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
    )
  },
  remove(documentId: number) {
    return unwrap<{ deleted: boolean }>(apiClient.delete(`/documents/${documentId}`))
  },
  // تنزيل المستند (رابط موقّع) — نجلبه كـ blob ونحفظه.
  async download(documentId: number): Promise<Blob> {
    const res = await apiClient.get(`/documents/${documentId}/download`, { responseType: 'blob' })
    return res.data as Blob
  },
}
