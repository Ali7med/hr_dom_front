import { apiClient, unwrap } from './client'

// أنواع يدوية (بدون لمس العقد) — مبنية على BE-30/BE-31 المنفّذة.

// ===== العملات (BE-30) =====
export interface Currency {
  id: number
  code: string
  name: string
  symbol: string | null
}
export interface CurrencyPayload {
  code: string
  name: string
  symbol?: string | null
}

// ===== قواعد الراتب (BE-31) =====
export type OvertimeMode = 'manual' | 'percent' | 'fixed_per_hour'
export interface SalaryRule {
  id: number
  user_id: number
  base_salary: string | number
  currency_id: number
  overtime_mode: OvertimeMode
  overtime_value: string | number | null
  currency?: Currency | null
}
export interface SalaryRulePayload {
  base_salary: number
  currency_id: number
  overtime_mode: OvertimeMode
  overtime_value?: number | null
}

// ===== شرائح العقوبات (BE-31) =====
export type PenaltyAppliesTo = 'late' | 'absence'
export type DeductionType = 'percent' | 'fixed'
export interface PenaltyRule {
  id: number
  applies_to: PenaltyAppliesTo
  from_minutes: number
  to_minutes: number | null
  deduction_type: DeductionType
  value: string | number
}
export interface PenaltyRulePayload {
  applies_to: PenaltyAppliesTo
  from_minutes: number
  to_minutes?: number | null
  deduction_type: DeductionType
  value: number
}

// ===== المكافآت/البدلات/الخصومات (BE-31) =====
export type BonusType = 'bonus' | 'allowance' | 'deduction'
export interface Bonus {
  id: number
  user_id: number
  period: string
  type: BonusType
  amount: string | number
  currency_id: number
  reason: string
  currency?: Currency | null
  user?: { id: number; name: string } | null
}
export interface BonusPayload {
  user_id: number
  period: string
  type: BonusType
  amount: number
  currency_id: number
  reason: string
}
export interface BonusListParams {
  user_id?: number
  period?: string
  type?: BonusType
}

export const currenciesApi = {
  list() {
    return unwrap<Currency[]>(apiClient.get('/currencies'))
  },
  create(payload: CurrencyPayload) {
    return unwrap<Currency>(apiClient.post('/currencies', payload))
  },
  update(id: number, payload: Partial<CurrencyPayload>) {
    return unwrap<Currency>(apiClient.put(`/currencies/${id}`, payload))
  },
  remove(id: number) {
    return unwrap<{ deleted: boolean }>(apiClient.delete(`/currencies/${id}`))
  },
}

export const salaryRulesApi = {
  list() {
    return unwrap<SalaryRule[]>(apiClient.get('/salary-rules'))
  },
  forUser(userId: number) {
    return unwrap<SalaryRule | null>(apiClient.get(`/users/${userId}/salary-rule`))
  },
  upsert(userId: number, payload: SalaryRulePayload) {
    return unwrap<SalaryRule>(apiClient.put(`/users/${userId}/salary-rule`, payload))
  },
}

export const penaltyRulesApi = {
  list() {
    return unwrap<PenaltyRule[]>(apiClient.get('/penalty-rules'))
  },
  create(payload: PenaltyRulePayload) {
    return unwrap<PenaltyRule>(apiClient.post('/penalty-rules', payload))
  },
  update(id: number, payload: Partial<PenaltyRulePayload>) {
    return unwrap<PenaltyRule>(apiClient.put(`/penalty-rules/${id}`, payload))
  },
  remove(id: number) {
    return unwrap<{ deleted: boolean }>(apiClient.delete(`/penalty-rules/${id}`))
  },
}

export const bonusesApi = {
  list(params: BonusListParams = {}) {
    return unwrap<Bonus[]>(apiClient.get('/bonuses', { params }))
  },
  create(payload: BonusPayload) {
    return unwrap<Bonus>(apiClient.post('/bonuses', payload))
  },
  update(id: number, payload: Partial<BonusPayload>) {
    return unwrap<Bonus>(apiClient.put(`/bonuses/${id}`, payload))
  },
  remove(id: number) {
    return unwrap<{ deleted: boolean }>(apiClient.delete(`/bonuses/${id}`))
  },
}
