import { apiClient, unwrap, type Envelope } from './client'
import type { Pagination } from './users'

// إدارة عامل الطابور من اللوحة (BE-86، وسم System، صلاحية queue.manage — Super Admin).
export interface QueueStatus {
  running: boolean
  driver: 'process' | 'supervisor'
  worker_count?: number
  worker_pids?: number[]
  last_heartbeat_at?: string | null
  heartbeat_age_seconds?: number | null
  heartbeat_stale_after?: number
  pending_jobs: number
  reserved_jobs: number
  failed_jobs: number
  started_at?: string | null
  queue_connection?: string
}

export interface FailedJob {
  id: number
  uuid: string
  connection?: string
  queue?: string
  job_name?: string | null
  exception: string
  failed_at: string
}

export const queueApi = {
  status() {
    return unwrap<QueueStatus>(apiClient.get('/system/queue/status'))
  },
  // start يردّ 409 إن كان يعمل أصلاً ما لم force=true.
  start(force = false) {
    return unwrap<QueueStatus>(apiClient.post('/system/queue/start', force ? { force: true } : {}))
  },
  stop() {
    return unwrap<QueueStatus>(apiClient.post('/system/queue/stop'))
  },
  restart() {
    return unwrap<QueueStatus>(apiClient.post('/system/queue/restart'))
  },
  async failed(params: { per_page?: number; page?: number } = {}): Promise<{ data: FailedJob[]; pagination?: Pagination }> {
    const res = await apiClient.get<Envelope<FailedJob[]>>('/system/queue/failed', { params })
    return { data: res.data.data, pagination: res.data.meta?.pagination as Pagination | undefined }
  },
  retry(id: number | string) {
    return unwrap(apiClient.post(`/system/queue/failed/${id}/retry`))
  },
  forget(id: number | string) {
    return unwrap(apiClient.delete(`/system/queue/failed/${id}`))
  },
  retryAll() {
    return unwrap(apiClient.post('/system/queue/failed/retry-all'))
  },
  flush() {
    return unwrap(apiClient.delete('/system/queue/failed'))
  },
}
