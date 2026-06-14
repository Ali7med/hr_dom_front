import { apiClient, unwrap, type Envelope } from './client'
import type { Pagination } from './users'

// أنواع يدوية مبنية على عقد BE-27 (Excuses) — الأذونات/الخروج المؤقّت.
// كيان مستقل بسير موافقة خفيف، بلا أثر مالي. بنية السجل دفاعية (BE-27 غير منشور).

export type ExcuseStatus = 'pending' | 'approved' | 'rejected'

export interface Excuse {
  id: number
  user_id: number
  user?: { id: number; name: string; employee_no?: string | null } | null
  department_id?: number | null
  department?: { id: number; name: string } | null
  date: string
  start_time: string
  end_time: string
  reason: string
  status: ExcuseStatus
  approved_by?: number | null
  approver?: { id: number; name: string } | null
  approved_at?: string | null
}

export interface ExcuseListParams {
  from?: string
  to?: string
  department_id?: number
  status?: ExcuseStatus
  per_page?: number
  page?: number
}

export interface ExcusePayload {
  user_id?: number | null // للتقديم بالنيابة؛ يُهمَل للذاتي
  date: string
  start_time: string
  end_time: string
  reason: string
}

export const excusesApi = {
  // سجلّ الأذونات (للمشرف، فلاتر + ترقيم) — excuses.view.
  async list(
    params: ExcuseListParams = {},
  ): Promise<{ data: Excuse[]; pagination?: Pagination }> {
    const res = await apiClient.get<Envelope<Excuse[]>>('/excuses', { params })
    return { data: res.data.data, pagination: res.data.meta?.pagination as Pagination | undefined }
  },
  // أذونات الموظف الحالي.
  mine() {
    return unwrap<Excuse[]>(apiClient.get('/excuses/mine'))
  },
  // تقديم إذن (ذاتي أو بالنيابة عبر user_id).
  create(payload: ExcusePayload) {
    return unwrap<Excuse>(apiClient.post('/excuses', payload))
  },
  approve(id: number) {
    return unwrap<Excuse>(apiClient.post(`/excuses/${id}/approve`))
  },
  reject(id: number) {
    return unwrap<Excuse>(apiClient.post(`/excuses/${id}/reject`))
  },
}
