import { apiClient, type Envelope } from './client'
import type { ReportRow, ReportResult } from './reports'

// فلاتر تقرير أرصدة الإجازات (BE-25).
export interface LeaveBalanceReportParams {
  q?: string
  department_id?: number
  balance_type?: 'normal' | 'sick'
  per_page?: number
  page?: number
}

// فلاتر تقرير الإجازات العام/المجمّع (BE-25).
export interface LeavesReportParams {
  from?: string
  to?: string
  department_id?: number
  leave_type_id?: number
  status?: 'pending' | 'approved' | 'rejected'
  group_by?: 'department' | 'type' | 'status'
  per_page?: number
  page?: number
}

interface ReportMeta {
  report?: { title: string; headings: string[] }
  pagination?: { total: number; per_page: number; current_page: number; last_page: number }
}

async function fetchReport(path: string, params: Record<string, unknown>): Promise<ReportResult> {
  const res = await apiClient.get<Envelope<ReportRow[]>>(path, { params })
  const meta = (res.data.meta ?? {}) as ReportMeta
  return {
    rows: res.data.data ?? [],
    title: meta.report?.title ?? '',
    headings: meta.report?.headings ?? [],
    pagination: meta.pagination,
  }
}

async function downloadReport(
  path: string,
  params: Record<string, unknown>,
  format: 'excel' | 'pdf',
): Promise<Blob> {
  const res = await apiClient.get(path, { params: { ...params, export: format }, responseType: 'blob' })
  return res.data as Blob
}

// تُمرَّر الفلاتر كسجلّ مبني حسب الوضع (الأنواع أعلاه توثيقية للحقول المتاحة).
export const leaveReportsApi = {
  balances: (p: Record<string, unknown> = {}) => fetchReport('/reports/leave-balances', p),
  balancesDownload: (p: Record<string, unknown>, format: 'excel' | 'pdf') =>
    downloadReport('/reports/leave-balances', p, format),
  leaves: (p: Record<string, unknown> = {}) => fetchReport('/reports/leaves', p),
  leavesDownload: (p: Record<string, unknown>, format: 'excel' | 'pdf') =>
    downloadReport('/reports/leaves', p, format),
}
