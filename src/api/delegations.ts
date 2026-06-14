import { apiClient, unwrap } from './client'

// أنواع يدوية مبنية على عقد BE-69 (Delegations) — تفويض الموافقات.
// المعتمِد يفوّض موافقاته لبديل مؤقّت ضمن فترة ونطاق (إجازات/أذونات/إضافي/الكل).
// بنية السجل دفاعية (BE-69 غير منشور).

export type DelegationScope = 'leaves' | 'excuses' | 'overtime' | 'all'

export interface ApprovalDelegation {
  id: number
  from_user_id: number
  from_user?: { id: number; name: string } | null
  to_user_id: number
  to_user?: { id: number; name: string } | null
  scope: DelegationScope
  from_date: string
  to_date: string
  created_at?: string | null
}

export interface ApprovalDelegationPayload {
  to_user_id: number
  scope: DelegationScope
  from_date: string
  to_date: string
}

export const delegationsApi = {
  list() {
    return unwrap<ApprovalDelegation[]>(apiClient.get('/approval-delegations'))
  },
  create(payload: ApprovalDelegationPayload) {
    return unwrap<ApprovalDelegation>(apiClient.post('/approval-delegations', payload))
  },
  remove(id: number) {
    return unwrap<{ deleted: boolean }>(apiClient.delete(`/approval-delegations/${id}`))
  },
}
