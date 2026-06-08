import { apiClient, type Envelope } from './client'

// أنواع يدوية (بدون لمس العقد) — مبنية على سلوك BE-22 المنفّذ.
export type ReportType = 'attendance' | 'late-absence' | 'timesheet'

export interface ReportFilters {
  from?: string
  to?: string
  period?: string
  department_id?: number
  user_id?: number
  per_page?: number
  page?: number
}

export type ReportRow = Record<string, string | number | null>

interface ReportMeta {
  report?: { title: string; headings: string[] }
  pagination?: { total: number; per_page: number; current_page: number; last_page: number }
}

export interface ReportResult {
  rows: ReportRow[]
  title: string
  headings: string[]
  pagination?: ReportMeta['pagination']
}

export const reportsApi = {
  async fetch(type: ReportType, filters: ReportFilters = {}): Promise<ReportResult> {
    const res = await apiClient.get<Envelope<ReportRow[]>>(`/reports/${type}`, { params: filters })
    const meta = (res.data.meta ?? {}) as ReportMeta
    return {
      rows: res.data.data ?? [],
      title: meta.report?.title ?? '',
      headings: meta.report?.headings ?? [],
      pagination: meta.pagination,
    }
  },
  async download(type: ReportType, filters: ReportFilters, format: 'excel' | 'pdf'): Promise<Blob> {
    const res = await apiClient.get(`/reports/${type}`, {
      params: { ...filters, export: format },
      responseType: 'blob',
    })
    return res.data as Blob
  },
}

// يطلق تنزيل ملف من Blob في المتصفّح.
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
