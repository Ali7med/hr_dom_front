import { apiClient, unwrap, type Envelope } from './client'
import type { LeaveType, LeaveRequest } from './leaves'

// بوابة الموظف على الويب (ESS — FE-36): مسارات ذاتية مرتبطة بـ auth (بلا صلاحية إدارية).
// تستهلك /leaves/mine + /me/leave-types + /me/leave-balances + /me/attendance.
// مبنيّة Contract-First مع تدهور آمن: إن لم ينفّذها الباك بعد (403/404) تُعطَّل الميزة برسالة.

// رصيد إجازة الموظف الحالي — بنية دفاعية (الباك قد يُعيد balance_type أو leave_type).
export interface MyLeaveBalance {
  leave_type_id?: number | null
  leave_type_name?: string | null
  balance_type?: string | null
  balance?: string | number | null
  balance_days?: string | number | null
  used?: string | number | null
}

// سجل حضور للموظف الحالي — بنية دفاعية (أسماء حقول متعدّدة محتملة).
export interface MyAttendanceRecord {
  id?: number
  date: string
  check_in_at?: string | null
  check_out_at?: string | null
  status?: string | null
  late_minutes?: number | null
  worked_hours?: string | number | null
  shift_name?: string | null
}

// ملخّص الفترة (من meta) — كله اختياري ودفاعي.
export interface MyAttendanceSummary {
  present_days?: number
  absent_days?: number
  late_count?: number
  leave_days?: number
  worked_hours?: string | number
}

export const myLeavesApi = {
  // طلبات الإجازة للموظف الحالي.
  list() {
    return unwrap<LeaveRequest[]>(apiClient.get('/leaves/mine'))
  },
  // أنواع الإجازات المتاحة للتقديم الذاتي (FE-36).
  types() {
    return unwrap<LeaveType[]>(apiClient.get('/me/leave-types'))
  },
  // أرصدة إجازات الموظف الحالي (FE-36).
  balances() {
    return unwrap<MyLeaveBalance[]>(apiClient.get('/me/leave-balances'))
  },
}

export const myAttendanceApi = {
  // سجلات حضور الموظف الحالي لشهر (YYYY-MM) + ملخّص الفترة في meta.summary (إن وُجد).
  async list(month: string): Promise<{ records: MyAttendanceRecord[]; summary: MyAttendanceSummary }> {
    const res = await apiClient.get<Envelope<MyAttendanceRecord[]>>('/me/attendance', { params: { month } })
    const meta = (res.data.meta ?? {}) as Record<string, unknown>
    return {
      records: res.data.data ?? [],
      summary: (meta.summary as MyAttendanceSummary | undefined) ?? {},
    }
  },
}
