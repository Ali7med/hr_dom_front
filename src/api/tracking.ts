import { apiClient, unwrap } from './client'

// تتبّع مواقع الموظفين (BE-89، وسم Tracking، معزول بالشركة، صلاحيتا tracking.view/manage).

export interface TrackingSettings {
  interval_minutes: number
  working_hours_only: boolean
  retention_days: number
  updated_at?: string | null
}

export interface TrackingSettingsInput {
  interval_minutes: number
  working_hours_only: boolean
  retention_days: number
}

// عنصر في قائمة المُفعّل لهم التتبّع (+ آخر ظهور).
export interface TrackingEnrollment {
  user_id: number
  name: string
  employee_no: string | null
  department_id: number | null
  enabled_at: string | null
  last_seen_at: string | null
}

// نقطة في خط المسير (يرفعها التطبيق عبر /me/locations — MO-28).
export interface TrackPoint {
  lat: number
  lng: number
  accuracy?: number | null
  recorded_at: string
  battery?: number | null
  is_mock?: boolean
}

export interface UserTrack {
  user: { id: number; name: string; employee_no: string | null }
  points: TrackPoint[]
}

// ===== الخريطة الجماعية متعددة الموظفين (BE-92 / FE-48) =====
export interface TrackUser {
  id: number
  name: string
  employee_no: string | null
  department_id: number | null
}

// سلسلة مسير موظف واحد ضمن استجابة الخريطة الجماعية (نقاط مرتّبة زمنياً تصاعدياً).
export interface TrackSeries {
  user: TrackUser
  points: TrackPoint[]
}

// أحدث موقع لموظف مُفعّل (الوضع المباشر live).
export interface LivePosition {
  user: TrackUser
  last_seen_at: string | null
  point: TrackPoint | null
}

// مسارات عدّة موظفين + meta (قد تحمل علَم الاعتيان downsampling).
export interface TracksResult {
  series: TrackSeries[]
  meta: Record<string, unknown>
}

export interface TracksQuery {
  user_ids?: string // معرّفات مفصولة بفواصل، مثل 1,2,5
  department_id?: number
  from?: string
  to?: string
}

export interface EnrollResult {
  enrolled: number
  total_targeted: number
}

export const trackingApi = {
  // إعدادات الشركة — تتطلّب tracking.manage.
  getSettings() {
    return unwrap<TrackingSettings>(apiClient.get('/tracking/settings'))
  },
  updateSettings(payload: TrackingSettingsInput) {
    return unwrap<TrackingSettings>(apiClient.put('/tracking/settings', payload))
  },
  // قائمة المُفعّلين — تتطلّب tracking.view.
  listEnrollments() {
    return unwrap<TrackingEnrollment[]>(apiClient.get('/tracking/enrollments'))
  },
  // تفعيل لموظفين و/أو أقسام — تتطلّب tracking.manage.
  enroll(payload: { user_ids?: number[]; department_ids?: number[] }) {
    return unwrap<EnrollResult>(apiClient.post('/tracking/enrollments', payload))
  },
  unenroll(userId: number) {
    return unwrap<{ deleted?: boolean }>(apiClient.delete(`/tracking/enrollments/${userId}`))
  },
  // خط مسير موظف ضمن فترة (للخريطة) — تتطلّب tracking.view.
  getUserTrack(userId: number, params: { from?: string; to?: string } = {}) {
    return unwrap<UserTrack>(apiClient.get(`/users/${userId}/track`, { params }))
  },
  // مسارات عدّة موظفين بطلب واحد (الخريطة الجماعية) — تتطلّب tracking.view.
  // يقرأ meta مباشرةً لالتقاط علَم الاعتيان downsampling.
  async listTracks(params: TracksQuery = {}): Promise<TracksResult> {
    const res = await apiClient.get('/tracking/tracks', { params })
    return { series: res.data?.data ?? [], meta: res.data?.meta ?? {} }
  },
  // أحدث موقع لكل موظف مُفعّل (الوضع المباشر) — تتطلّب tracking.view.
  listPositions(params: { user_ids?: string; department_id?: number } = {}) {
    return unwrap<LivePosition[]>(apiClient.get('/tracking/positions', { params }))
  },
}
