import { apiClient, unwrap } from './client'

export type RebindStatus = 'pending' | 'approved' | 'rejected'

export interface RebindRequest {
  id: number
  user_id: number
  new_device_uid: string
  status: RebindStatus
  approved_by: number | null
  approved_at: string | null
  created_at: string
  user?: { id: number; name: string; employee_no: string | null } | null
}

export const devicesApi = {
  rebindRequests() {
    return unwrap<RebindRequest[]>(apiClient.get('/devices/rebind-requests'))
  },
  approveRebind(id: number) {
    return unwrap<{ id: number; status: RebindStatus }>(
      apiClient.post(`/devices/rebind-requests/${id}/approve`),
    )
  },
  rejectRebind(id: number) {
    return unwrap<{ id: number; status: RebindStatus }>(
      apiClient.post(`/devices/rebind-requests/${id}/reject`),
    )
  },
}
