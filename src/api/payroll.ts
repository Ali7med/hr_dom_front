import { apiClient, unwrap, type Envelope } from './client'

export interface PayrollCurrency {
  id: number
  code: string
  name: string
  symbol: string | null
}

export interface PayrollBreakdown {
  working_days?: number
  daily_rate?: number
  hourly_rate?: number
  late_days?: number
  absent_days?: number
  unpaid_leave_days?: number
  overtime_hours?: number
  overtime_mode?: string
  bonus_lines?: Array<Record<string, unknown>>
}

export interface Payroll {
  id: number
  user_id: number
  period: string
  currency_id: number | null
  fx_rate_to_base: string | number
  base_salary: string | number
  late_deduction: string | number
  absence_deduction: string | number
  unpaid_leave_deduction: string | number
  overtime_amount: string | number
  bonuses_amount: string | number
  net_salary: string | number
  breakdown: PayrollBreakdown | null
  generated_at: string | null
  user?: { id: number; name: string; employee_no: string | null } | null
  currency?: PayrollCurrency | null
}

export interface PayrollListParams {
  period?: string
  user_id?: number
}

export interface PayrollGeneratePayload {
  period: string
  user_id?: number
}

export const payrollApi = {
  list(params: PayrollListParams = {}) {
    return unwrap<Payroll[]>(apiClient.get('/payroll', { params }))
  },
  get(id: number) {
    return unwrap<Payroll>(apiClient.get(`/payroll/${id}`))
  },
  async generate(payload: PayrollGeneratePayload): Promise<{ data: Payroll[]; generated: number }> {
    const res = await apiClient.post<Envelope<Payroll[]>>('/payroll/generate', payload)
    const meta = (res.data.meta ?? {}) as { generated?: number }
    return { data: res.data.data ?? [], generated: meta.generated ?? 0 }
  },
  async download(params: PayrollListParams, format: 'excel' | 'pdf'): Promise<Blob> {
    const res = await apiClient.get('/payroll/export', {
      params: { ...params, format },
      responseType: 'blob',
    })
    return res.data as Blob
  },
}
