import { apiClient, unwrap, type Envelope } from './client'
import type { Pagination } from './users'

// أنواع يدوية مبنية على عقد BE-66 (ShiftSwaps) — تبديل/تنازل الورديات.
// الموظف يطلب التبديل (من التطبيق)، والمشرف يعتمد فتُحدَّث جداول الطرفين.
// بنية السجل دفاعية (BE-66 غير منشور).

export type ShiftSwapStatus = 'pending' | 'approved' | 'rejected'

// تمثيل مبسّط لجدول وردية (BE-12) كما قد يأتي مضمّناً في طلب التبديل.
export interface SwapSchedule {
  id: number
  work_date?: string | null
  weekday?: number | null
  shift?: { id: number; name: string; start_time?: string | null; end_time?: string | null } | null
}

export interface ShiftSwap {
  id: number
  requester_id: number
  requester?: { id: number; name: string; employee_no?: string | null } | null
  my_schedule_id: number
  my_schedule?: SwapSchedule | null
  with_user_id: number
  with_user?: { id: number; name: string; employee_no?: string | null } | null
  with_schedule_id?: number | null // null = تنازل (بلا مقابل)
  with_schedule?: SwapSchedule | null
  note?: string | null
  status: ShiftSwapStatus
  approved_by?: number | null
  approver?: { id: number; name: string } | null
  approved_at?: string | null
}

export interface ShiftSwapListParams {
  status?: ShiftSwapStatus
  per_page?: number
  page?: number
}

export const shiftSwapsApi = {
  // سجلّ طلبات التبديل (للمشرف، فلتر حالة + ترقيم) — shifts.manage.
  async list(
    params: ShiftSwapListParams = {},
  ): Promise<{ data: ShiftSwap[]; pagination?: Pagination }> {
    const res = await apiClient.get<Envelope<ShiftSwap[]>>('/shift-swaps', { params })
    return { data: res.data.data, pagination: res.data.meta?.pagination as Pagination | undefined }
  },
  approve(id: number) {
    return unwrap<ShiftSwap>(apiClient.post(`/shift-swaps/${id}/approve`))
  },
  reject(id: number) {
    return unwrap<ShiftSwap>(apiClient.post(`/shift-swaps/${id}/reject`))
  },
}
