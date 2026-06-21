import { apiClient, unwrap, type Envelope } from './client'
import type { Pagination } from './users'

// أنواع يدوية مبنية على عقد BE-51 (Alerts) — تنبيهات المشرف للموظفين.
// (الردود بالغلاف الموحّد؛ الأنواع هنا تعكس ما يُرجِعه الباك المخطّط.)

export type AlertTargetType = 'all' | 'department' | 'users'
export type AlertChannel = 'push' | 'email' | 'telegram'
export type AlertFrequency = 'once' | 'daily' | 'weekly' | 'monthly'

// مُقِرّ بتنبيه (BE-52) — يظهر في تفاصيل التنبيه.
export interface AlertAcknowledger {
  user_id: number
  name: string
  employee_no?: string | null
  acknowledged_at?: string | null
}

export interface Alert {
  id: number
  title: string
  body: string
  target_type: AlertTargetType
  target_meta?: Record<string, unknown> | null
  requires_ack?: boolean
  channels?: AlertChannel[] | null
  frequency?: AlertFrequency
  repeat_until?: string | null
  next_run_at?: string | null
  recipients_count: number
  read_count: number
  ack_count?: number
  acknowledgers?: AlertAcknowledger[]
  created_at: string
  creator?: { id: number; name: string; employee_no?: string | null } | null
}

export interface AlertInput {
  title: string
  body: string
  target_type: AlertTargetType
  department_ids?: number[] | null
  user_ids?: number[] | null
  requires_ack?: boolean
  channels?: AlertChannel[]
  frequency?: AlertFrequency
  repeat_until?: string | null
  data?: Record<string, unknown> | null
}

export const alertsApi = {
  // قائمة التنبيهات المُرسَلة (مع عدّادات المستلمين/المقروء) — مرقّمة.
  async list(
    params: { per_page?: number; page?: number } = {},
  ): Promise<{ data: Alert[]; pagination?: Pagination }> {
    const res = await apiClient.get<Envelope<Alert[]>>('/alerts', { params })
    return { data: res.data.data, pagination: res.data.meta?.pagination as Pagination | undefined }
  },
  get(id: number) {
    return unwrap<Alert>(apiClient.get(`/alerts/${id}`))
  },
  // إنشاء تنبيه وإرساله (القنوات المختارة + صندوق وارد داخل التطبيق دائماً).
  create(payload: AlertInput) {
    return unwrap<Alert>(apiClient.post('/alerts', payload))
  },
  // حذف تنبيه (يزيله من السجل وصناديق الوارد).
  remove(id: number) {
    return unwrap<{ deleted?: boolean }>(apiClient.delete(`/alerts/${id}`))
  },
  // إعادة إرسال تنبيه سابق فوراً (ينسخه ويرسله كتنبيه جديد).
  resend(id: number) {
    return unwrap<Alert>(apiClient.post(`/alerts/${id}/resend`))
  },
}
