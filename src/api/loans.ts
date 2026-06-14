import { apiClient, unwrap, type Envelope } from './client'
import type { Pagination } from './users'

// أنواع يدوية مبنية على عقد BE-67 (Loans) — السلف والمستحقات.
// سلفة بمبلغ + أقساط شهرية تُخصم آلياً في الرواتب من شهر البدء حتى السداد.
// بنية السجل دفاعية (BE-67 غير منشور).

export type LoanStatus = 'active' | 'settled' | 'pending' | 'rejected'

export interface LoanInstallment {
  id?: number
  period: string // YYYY-MM
  amount: number
  deducted_at?: string | null // null = لم يُخصَم بعد
}

export interface Loan {
  id: number
  user_id: number
  user?: { id: number; name: string; employee_no?: string | null } | null
  amount: number
  installments: number
  start_period: string // YYYY-MM
  status: LoanStatus
  reason?: string | null
  created_by?: number | null
  // قد يأتي محسوباً من الباك (اختياري — نشتقّه عند الغياب).
  installment_amount?: number | null
  installments_paid?: number | null
  remaining_amount?: number | null
  installments_schedule?: LoanInstallment[] | null
}

export interface LoanListParams {
  user_id?: number
  status?: LoanStatus
  per_page?: number
  page?: number
}

export interface LoanPayload {
  user_id: number
  amount: number
  installments: number
  start_period: string // YYYY-MM
  reason?: string | null
}

export const loansApi = {
  // سجلّ السلف (فلاتر + ترقيم) — payroll.manage_rules.
  async list(
    params: LoanListParams = {},
  ): Promise<{ data: Loan[]; pagination?: Pagination }> {
    const res = await apiClient.get<Envelope<Loan[]>>('/loans', { params })
    return { data: res.data.data, pagination: res.data.meta?.pagination as Pagination | undefined }
  },
  // تفاصيل سلفة + جدول الأقساط.
  get(id: number) {
    return unwrap<Loan>(apiClient.get(`/loans/${id}`))
  },
  create(payload: LoanPayload) {
    return unwrap<Loan>(apiClient.post('/loans', payload))
  },
  // إلغاء سلفة (إن لم يبدأ الخصم).
  remove(id: number) {
    return unwrap<{ deleted: boolean }>(apiClient.delete(`/loans/${id}`))
  },
}
