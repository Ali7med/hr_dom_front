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
}
