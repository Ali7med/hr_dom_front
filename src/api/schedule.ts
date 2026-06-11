import { apiClient, unwrap } from './client'

// ===== الورديات =====
export interface Shift {
  id: number
  company_id: number | null
  name: string
  start_time: string
  end_time: string
  hours: number
  // نوافذ بصمة الوردية (BE-15):
  grace_minutes: number // دقائق السماح بعد البدء (ضمنها = حاضر في الوقت).
  early_checkin_minutes: number // السماح بالبصم قبل البدء بهذا العدد (0 = من البدء).
  absence_after_minutes: number | null // بعدها من البدء يُعلَّم غياباً (null = لا حدّ).
  crosses_midnight: boolean
}

export interface ShiftPayload {
  name: string
  start_time: string
  end_time: string
  hours: number
  grace_minutes?: number
  early_checkin_minutes?: number
  absence_after_minutes?: number | null
}

// ===== الجداول =====
// weekday باصطلاح Carbon: 0=الأحد … 6=السبت.
export interface Schedule {
  id: number
  company_id: number | null
  user_id: number
  shift_id: number
  work_date: string | null
  weekday: number | null
  shift?: Pick<Shift, 'id' | 'name' | 'start_time' | 'end_time'> | null
}

export interface SchedulePayload {
  user_id: number
  shift_id: number
  work_date?: string | null
  weekday?: number | null
}

export interface ScheduleListParams {
  user_id?: number
  from?: string
  to?: string
}

// ===== العطل الرسمية =====
export interface Holiday {
  id: number
  company_id: number | null
  date: string
  name: string
}

export interface HolidayPayload {
  date: string
  name: string
}

export const shiftsApi = {
  list() {
    return unwrap<Shift[]>(apiClient.get('/shifts'))
  },
  create(payload: ShiftPayload) {
    return unwrap<Shift>(apiClient.post('/shifts', payload))
  },
  update(id: number, payload: Partial<ShiftPayload>) {
    return unwrap<Shift>(apiClient.put(`/shifts/${id}`, payload))
  },
  remove(id: number) {
    return unwrap<{ deleted: boolean }>(apiClient.delete(`/shifts/${id}`))
  },
}

export const schedulesApi = {
  list(params: ScheduleListParams = {}) {
    return unwrap<Schedule[]>(apiClient.get('/schedules', { params }))
  },
  create(payload: SchedulePayload) {
    return unwrap<Schedule>(apiClient.post('/schedules', payload))
  },
  update(id: number, payload: Partial<SchedulePayload>) {
    return unwrap<Schedule>(apiClient.put(`/schedules/${id}`, payload))
  },
  remove(id: number) {
    return unwrap<{ deleted: boolean }>(apiClient.delete(`/schedules/${id}`))
  },
}

export const holidaysApi = {
  list() {
    return unwrap<Holiday[]>(apiClient.get('/holidays'))
  },
  create(payload: HolidayPayload) {
    return unwrap<Holiday>(apiClient.post('/holidays', payload))
  },
  update(id: number, payload: Partial<HolidayPayload>) {
    return unwrap<Holiday>(apiClient.put(`/holidays/${id}`, payload))
  },
  remove(id: number) {
    return unwrap<{ deleted: boolean }>(apiClient.delete(`/holidays/${id}`))
  },
}
