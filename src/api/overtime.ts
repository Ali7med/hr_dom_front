import { apiClient, unwrap, type Envelope } from './client'
import type { Pagination } from './users'

// أنواع يدوية مبنية على عقد BE-29 (Overtime) — طلبات العمل الإضافي.
// طلب مسبق + اعتماد، ثم الساعات المعتمَدة تدخل محرّك الرواتب. بنية السجل دفاعية (BE-29 غير منشور).

export type OvertimeStatus = 'pending' | 'approved' | 'rejected'

export interface OvertimeRequest {
  id: number
  user_id: number
  user?: { id: number; name: string; employee_no?: string | null } | null
  department_id?: number | null
  department?: { id: number; name: string } | null
  date: string
  hours: number
  reason: string
  status: OvertimeStatus
  approved_by?: number | null
  approver?: { id: number; name: string } | null
  approved_at?: string | null
}

export interface OvertimeListParams {
  from?: string
  to?: string
  department_id?: number
  status?: OvertimeStatus
  per_page?: number
  page?: number
}

export interface OvertimePayload {
  user_id?: number | null // للتقديم بالنيابة؛ يُهمَل للذاتي
  date: string
  hours: number
  reason: string
}

export const overtimeApi = {
  // سجلّ طلبات الإضافي (للمشرف، فلاتر + ترقيم) — overtime.view.
  async list(
    params: OvertimeListParams = {},
  ): Promise<{ data: OvertimeRequest[]; pagination?: Pagination }> {
    const res = await apiClient.get<Envelope<OvertimeRequest[]>>('/overtime-requests', { params })
    return { data: res.data.data, pagination: res.data.meta?.pagination as Pagination | undefined }
  },
  // طلبات الموظف الحالي.
  mine() {
    return unwrap<OvertimeRequest[]>(apiClient.get('/overtime-requests/mine'))
  },
  // تقديم طلب إضافي (ذاتي أو بالنيابة عبر user_id).
  create(payload: OvertimePayload) {
    return unwrap<OvertimeRequest>(apiClient.post('/overtime-requests', payload))
  },
  approve(id: number) {
    return unwrap<OvertimeRequest>(apiClient.post(`/overtime-requests/${id}/approve`))
  },
  reject(id: number) {
    return unwrap<OvertimeRequest>(apiClient.post(`/overtime-requests/${id}/reject`))
  },
}
