import { apiClient, unwrap, type Envelope } from './client'
import type { Pagination } from './users'

// أنواع مبنية على عقد BE-73 (Onboarding) — مسارات التعيين/إنهاء التعيين.
// قوالب مهام قابلة للتخصيص + سير مهام لكل موظف بنسبة إنجاز. الأشكال مطابقة لاستجابة :8000.

export type OnboardingType = 'onboarding' | 'offboarding'
export type ProcessStatus = 'in_progress' | 'completed'
export type TaskStatus = 'pending' | 'done'

// ===== القوالب =====
export interface TemplateItem {
  id?: number
  position?: number
  title: string
  assignee_role?: string | null
  due_offset_days?: number | null
}

export interface OnboardingTemplate {
  id: number
  type: OnboardingType
  name: string
  items: TemplateItem[]
}

export interface OnboardingTemplatePayload {
  type: OnboardingType
  name: string
  items: { title: string; assignee_role?: string | null; due_offset_days?: number | null }[]
}

// ===== السير ومهامه =====
export interface OnboardingTask {
  id: number
  title: string
  assignee_role?: string | null
  assignee_user_id?: number | null
  assignee_name?: string | null
  due_date?: string | null
  status: TaskStatus
  done_at?: string | null
  done_by?: number | null
}

export interface OnboardingProcess {
  id: number
  user_id: number
  user_name?: string | null
  employee_no?: string | null
  type: OnboardingType
  template_id?: number | null
  start_date: string
  status: ProcessStatus
  progress: number // 0-100
  tasks_done: number
  tasks_total: number
  tasks?: OnboardingTask[]
}

export interface ProcessListParams {
  type?: OnboardingType
  status?: ProcessStatus
  user_id?: number
  per_page?: number
  page?: number
}

export interface OnboardingProcessPayload {
  user_id: number
  type: OnboardingType
  template_id?: number | null
  start_date: string
}

export const onboardingTemplatesApi = {
  list(type?: OnboardingType) {
    return unwrap<OnboardingTemplate[]>(apiClient.get('/onboarding-templates', { params: type ? { type } : {} }))
  },
  create(payload: OnboardingTemplatePayload) {
    return unwrap<OnboardingTemplate>(apiClient.post('/onboarding-templates', payload))
  },
  update(id: number, payload: OnboardingTemplatePayload) {
    return unwrap<OnboardingTemplate>(apiClient.put(`/onboarding-templates/${id}`, payload))
  },
  remove(id: number) {
    return unwrap<{ deleted: boolean }>(apiClient.delete(`/onboarding-templates/${id}`))
  },
}

export const onboardingProcessesApi = {
  async list(params: ProcessListParams = {}): Promise<{ data: OnboardingProcess[]; pagination?: Pagination }> {
    const res = await apiClient.get<Envelope<OnboardingProcess[]>>('/onboarding-processes', { params })
    return { data: res.data.data, pagination: res.data.meta?.pagination as Pagination | undefined }
  },
  get(id: number) {
    return unwrap<OnboardingProcess>(apiClient.get(`/onboarding-processes/${id}`))
  },
  create(payload: OnboardingProcessPayload) {
    return unwrap<OnboardingProcess>(apiClient.post('/onboarding-processes', payload))
  },
}

export const onboardingTasksApi = {
  complete(taskId: number) {
    return unwrap<OnboardingTask & { progress?: number; process_status?: ProcessStatus }>(
      apiClient.post(`/onboarding-tasks/${taskId}/complete`),
    )
  },
}
