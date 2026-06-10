import { apiClient, unwrap, type Envelope } from './client'
import type { Pagination } from './users'

export type LeaveKind = 'hourly' | 'daily' | 'long' | 'sick'
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'auto'
export type AffectsBalance = 'normal' | 'sick' | 'none'
export type BalanceType = 'normal' | 'sick'

export interface LeaveType {
  id: number
  company_id: number | null
  name: string
  kind: LeaveKind
  needs_approval: boolean
  affects_balance: AffectsBalance | null
  is_paid: boolean
  max_days_per_request: number | null
  max_hours_per_day: number | null
  allowed_from: string | null
  allowed_to: string | null
}

export interface LeaveTypePayload {
  name: string
  kind: LeaveKind
  needs_approval?: boolean
  affects_balance?: AffectsBalance
  is_paid?: boolean
  max_days_per_request?: number | null
  max_hours_per_day?: number | null
  allowed_from?: string | null
  allowed_to?: string | null
}

export interface LeaveRequest {
  id: number
  user_id: number
  leave_type_id: number
  start_at: string
  end_at: string
  hours: string | number | null
  days: string | number | null
  is_paid: boolean
  source: string | null
  status: LeaveStatus
  approved_by: number | null
  approved_at: string | null
  user?: { id: number; name: string; employee_no: string | null } | null
  leave_type?: { id: number; name: string; kind: LeaveKind } | null
}

export interface LeaveListParams {
  user_id?: number
  status?: LeaveStatus
  from?: string
  to?: string
  per_page?: number
  page?: number
}

export interface LeaveRequestPayload {
  leave_type_id: number
  start_at: string
  end_at: string
  hours?: number
  user_id?: number
  source?: 'app' | 'panel'
}

export interface LeaveBalance {
  id: number
  user_id: number
  company_id: number | null
  balance_type: BalanceType
  balance_days: string | number
}

export interface LeaveBalancePayload {
  balance_type: BalanceType
  balance_days: number
  mode?: 'set' | 'increment'
}

export const leaveTypesApi = {
  list() {
    return unwrap<LeaveType[]>(apiClient.get('/leave-types'))
  },
  create(payload: LeaveTypePayload) {
    return unwrap<LeaveType>(apiClient.post('/leave-types', payload))
  },
  update(id: number, payload: Partial<LeaveTypePayload>) {
    return unwrap<LeaveType>(apiClient.put(`/leave-types/${id}`, payload))
  },
  remove(id: number) {
    return unwrap<{ deleted: boolean }>(apiClient.delete(`/leave-types/${id}`))
  },
}

export const leavesApi = {
  async list(params: LeaveListParams = {}): Promise<{ data: LeaveRequest[]; pagination?: Pagination }> {
    const res = await apiClient.get<Envelope<LeaveRequest[]>>('/leaves', { params })
    return { data: res.data.data, pagination: res.data.meta?.pagination as Pagination | undefined }
  },
  create(payload: LeaveRequestPayload) {
    return unwrap<LeaveRequest>(apiClient.post('/leaves', payload))
  },
  approve(id: number) {
    return unwrap<LeaveRequest>(apiClient.post(`/leaves/${id}/approve`))
  },
  reject(id: number) {
    return unwrap<LeaveRequest>(apiClient.post(`/leaves/${id}/reject`))
  },
}

export const leaveBalancesApi = {
  list(userId: number) {
    return unwrap<LeaveBalance[]>(apiClient.get(`/users/${userId}/leave-balances`))
  },
  upsert(userId: number, payload: LeaveBalancePayload) {
    return unwrap<LeaveBalance>(apiClient.put(`/users/${userId}/leave-balances`, payload))
  },
}
