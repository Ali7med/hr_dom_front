import { apiClient, unwrap } from './client'

// إعدادات الشركة (BE-05). الأرقام العشرية تصل كنصوص من Laravel (decimal cast).
export interface CompanySettings {
  id?: number
  company_id?: number
  day_hours: number | string
  default_grace_minutes: number
  weekend_days: string[]
  hourly_leave_hours_per_day: number | string
  hourly_leave_needs_approval: boolean
  hourly_leave_monthly_cap: number | null
  notify_channels: string[]
  settings: Record<string, unknown>
}

export interface Company {
  id: number
  name: string
  slug: string
  base_currency_id: number | null
  timezone: string | null
  is_active: boolean
  settings?: CompanySettings | null
}

export interface CompanyCreatePayload {
  name: string
  slug: string
  base_currency_id?: number | null
  timezone?: string | null
  source_company_id?: number | null
}

export type CompanyUpdatePayload = Partial<
  Pick<Company, 'name' | 'slug' | 'base_currency_id' | 'timezone' | 'is_active'>
>

export type CompanySettingsPayload = Partial<Omit<CompanySettings, 'id' | 'company_id'>>

export const companiesApi = {
  list() {
    return unwrap<Company[]>(apiClient.get('/companies'))
  },
  get(id: number) {
    return unwrap<Company>(apiClient.get(`/companies/${id}`))
  },
  create(payload: CompanyCreatePayload) {
    return unwrap<Company>(apiClient.post('/companies', payload))
  },
  update(id: number, payload: CompanyUpdatePayload) {
    return unwrap<Company>(apiClient.put(`/companies/${id}`, payload))
  },
  remove(id: number) {
    return unwrap<{ deleted: boolean }>(apiClient.delete(`/companies/${id}`))
  },
  getSettings(id: number) {
    return unwrap<CompanySettings>(apiClient.get(`/companies/${id}/settings`))
  },
  updateSettings(id: number, payload: CompanySettingsPayload) {
    return unwrap<CompanySettings>(apiClient.put(`/companies/${id}/settings`, payload))
  },
  importSettings(id: number, sourceCompanyId: number) {
    return unwrap<CompanySettings>(
      apiClient.post(`/companies/${id}/import-settings`, { source_company_id: sourceCompanyId }),
    )
  },
}
