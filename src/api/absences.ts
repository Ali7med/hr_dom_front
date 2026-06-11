import { apiClient, unwrap, type Envelope } from './client'
import type { Pagination } from './users'

// أنواع يدوية مبنية على عقد BE-16 (Absences) — معالجة الغياب لـ HR.
// أرشيف/متابعة بلا أثر مالي. الردود بالغلاف الموحّد؛ الأنواع تعكس ما يُرجِعه الباك المخطّط.
// البنية دفاعية (كائن مُضمّن أو معرّف مسطّح) لأن الباك (BE-16) لم يُنشر بعد.

export type AbsenceStatus = 'unresolved' | 'resolved'

// نوع معالجة الغياب (قابل للتخصيص: إجازة/إيفاد/تعذّر بصمة…).
export interface AbsenceResolutionType {
  id: number
  name: string
  is_active: boolean
}

export interface AbsenceResolutionTypePayload {
  name: string
  is_active?: boolean
}

export interface Absence {
  id: number
  user_id: number
  user?: { id: number; name: string; employee_no?: string | null } | null
  department_id?: number | null
  department?: { id: number; name: string } | null
  date: string
  shift_id?: number | null
  shift?: { id: number; name: string } | null
  reason?: string | null
  status: AbsenceStatus
  resolution_type_id?: number | null
  resolution_type?: { id: number; name: string } | null
  note?: string | null
  resolved_at?: string | null
}

export interface AbsenceListParams {
  from?: string
  to?: string
  department_id?: number
  user_id?: number
  status?: AbsenceStatus
  per_page?: number
  page?: number
}

export interface AbsenceResolvePayload {
  resolution_type_id: number
  note?: string | null
}

export const absencesApi = {
  // سجلّ الغيابات (فلاتر + ترقيم).
  async list(
    params: AbsenceListParams = {},
  ): Promise<{ data: Absence[]; pagination?: Pagination }> {
    const res = await apiClient.get<Envelope<Absence[]>>('/absences', { params })
    return { data: res.data.data, pagination: res.data.meta?.pagination as Pagination | undefined }
  },
  // تأشير معالجة على غياب (بلا أثر مالي).
  resolve(id: number, payload: AbsenceResolvePayload) {
    return unwrap<Absence>(apiClient.post(`/absences/${id}/resolve`, payload))
  },
}

export const absenceResolutionTypesApi = {
  list() {
    return unwrap<AbsenceResolutionType[]>(apiClient.get('/absence-resolution-types'))
  },
  create(payload: AbsenceResolutionTypePayload) {
    return unwrap<AbsenceResolutionType>(apiClient.post('/absence-resolution-types', payload))
  },
  update(id: number, payload: Partial<AbsenceResolutionTypePayload>) {
    return unwrap<AbsenceResolutionType>(apiClient.put(`/absence-resolution-types/${id}`, payload))
  },
  remove(id: number) {
    return unwrap<{ deleted: boolean }>(apiClient.delete(`/absence-resolution-types/${id}`))
  },
}
