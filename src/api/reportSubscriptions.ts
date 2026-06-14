import { apiClient, unwrap } from './client'

// أنواع يدوية مبنية على عقد BE-28 (اشتراكات التقارير المجدولة).
export type ReportFrequency = 'daily' | 'weekly' | 'monthly'
export type ReportFormat = 'excel' | 'pdf'
export type ReportChannel = 'email' | 'telegram'

export interface ReportSubscription {
  id: number
  report_type: string
  frequency: ReportFrequency
  format: ReportFormat
  channels: ReportChannel[]
  recipients: string[]
  is_active: boolean
  last_sent_at?: string | null
  created_by?: number | null
}

export interface ReportSubscriptionPayload {
  report_type: string
  frequency: ReportFrequency
  format?: ReportFormat
  channels?: ReportChannel[]
  recipients?: string[]
  is_active?: boolean
}

export const reportSubscriptionsApi = {
  list() {
    return unwrap<ReportSubscription[]>(apiClient.get('/report-subscriptions'))
  },
  create(payload: ReportSubscriptionPayload) {
    return unwrap<ReportSubscription>(apiClient.post('/report-subscriptions', payload))
  },
  update(id: number, payload: ReportSubscriptionPayload) {
    return unwrap<ReportSubscription>(apiClient.put(`/report-subscriptions/${id}`, payload))
  },
  remove(id: number) {
    return unwrap<{ deleted: boolean }>(apiClient.delete(`/report-subscriptions/${id}`))
  },
}
