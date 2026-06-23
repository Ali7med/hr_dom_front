import { apiClient, type Envelope } from './client'
import type { Pagination } from './users'

// جدول التتبّع اليومي للحضور/الانصراف (BE-90، وسم Reports، صلاحية reports.view).
// أشكال الردود من العقد (DailyAttendanceRow + meta.summary). دفاعية حتى نشر BE-90.

export type DailyStatus = 'present' | 'missing_check_in' | 'missing_check_out' | 'missing_both' | 'on_leave'

export interface DailyAttendanceRow {
  date: string
  user_id: number
  employee_no: string | null
  name: string
  department: string | null
  shift_id: number | null
  shift_name: string | null
  shift_start: string | null
  shift_end: string | null
  check_in_at: string | null
  check_out_at: string | null
  status: DailyStatus
  late_minutes: number
  early_out_minutes: number
  deficiency_minutes: number
  excused_minutes: number
  net_deficiency_minutes: number
  justified: boolean
  excuse_id: number | null
  leave_type: string | null
}

// ملخّص meta.summary من BE-90: عدّادات لكل حالة + إجمالي النقص الصافي + إجمالي الصفوف.
export interface DailyAttendanceSummary {
  counts?: {
    present?: number
    missing_check_in?: number
    missing_check_out?: number
    missing_both?: number
    on_leave?: number
  }
  total_net_deficiency_minutes?: number
  total_rows?: number
}

export interface DailyAttendanceParams {
  date?: string
  from?: string
  to?: string
  // incomplete = اتحاد حالات النقص الثلاث (تيسير الفلتر).
  status?: DailyStatus | 'incomplete'
  justification?: 'any' | 'justified' | 'unjustified'
  department_id?: number
  user_id?: number
  per_page?: number
  page?: number
}

export const dailyAttendanceApi = {
  async list(
    params: DailyAttendanceParams = {},
  ): Promise<{ data: DailyAttendanceRow[]; summary?: DailyAttendanceSummary; pagination?: Pagination }> {
    const res = await apiClient.get<Envelope<DailyAttendanceRow[]>>('/reports/daily-attendance', { params })
    const meta = (res.data.meta ?? {}) as { summary?: DailyAttendanceSummary; pagination?: Pagination }
    return { data: res.data.data ?? [], summary: meta.summary, pagination: meta.pagination }
  },
  async download(params: DailyAttendanceParams, format: 'excel' | 'pdf' = 'excel'): Promise<Blob> {
    const res = await apiClient.get('/reports/daily-attendance', {
      params: { ...params, export: format },
      responseType: 'blob',
    })
    return res.data as Blob
  },
}
