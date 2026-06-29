import { apiClient, unwrap } from './client'

// خدمة ذاتية لتغيير كلمة المرور والإيميل (BE-97 — وسم Profile).
// شكل الاستجابة بسيط/غير محدّد — نُبقيه permissive ولا نخترع حقولاً.

export interface ChangePasswordPayload {
  current_password: string
  new_password: string
  new_password_confirmation: string
}

export interface ChangeEmailPayload {
  new_email: string
  current_password: string
}

export const accountApi = {
  changePassword(payload: ChangePasswordPayload) {
    return unwrap<unknown>(apiClient.post('/me/password', payload))
  },
  changeEmail(payload: ChangeEmailPayload) {
    return unwrap<unknown>(apiClient.post('/me/email', payload))
  },
}
