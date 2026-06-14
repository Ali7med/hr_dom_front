import { apiClient, unwrap } from './client'
import type { Payroll } from './payroll'

// قسيمة راتب الموظف الحالي (BE-26) = سجل الراتب المُولَّد المخزّن (BE-32) لنفسه.
// نعيد استخدام نوع Payroll؛ المسارات مرتبطة بـ auth id (بلا صلاحية خاصة).
export type Payslip = Payroll

export const payslipsApi = {
  // قائمة فترات قسائم الموظف الحالي.
  list() {
    return unwrap<Payslip[]>(apiClient.get('/me/payslips'))
  },
  // تفاصيل قسيمة فترة (breakdown).
  get(period: string) {
    return unwrap<Payslip>(apiClient.get(`/me/payslips/${period}`))
  },
  // تنزيل PDF لفترة.
  async downloadPdf(period: string): Promise<Blob> {
    const res = await apiClient.get(`/me/payslips/${period}`, {
      params: { format: 'pdf' },
      responseType: 'blob',
    })
    return res.data as Blob
  },
}
