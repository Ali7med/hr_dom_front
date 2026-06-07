import { apiClient, unwrap } from './client'

// توكنات الجلسة (refresh_token قد يكون null في تدفّق SSO).
export interface TokenPayload {
  access_token: string
  refresh_token: string | null
  token_type: string
  expires_in: number | null
}

// رد الدخول عندما يكون 2FA مفعّلاً: لا تُسلَّم التوكنات إلا بعد التحقق.
export interface TwoFactorChallenge {
  requires_2fa: true
  challenge: string
  expires_in: number
}

export type LoginResult = TokenPayload | TwoFactorChallenge

export function isTwoFactorChallenge(
  result: LoginResult,
): result is TwoFactorChallenge {
  return (result as TwoFactorChallenge).requires_2fa === true
}

// المستخدم الحالي (GET /auth/me) مع شركته وأدواره وصلاحياته.
export interface AuthUser {
  id: number
  name: string
  email: string | null
  employee_no: string | null
  status: string
  company_id: number | null
  company: Record<string, unknown> | null
  department: Record<string, unknown> | null
  two_factor_enabled: boolean
  roles: string[]
  permissions: string[]
  // Super Admin يتجاوز كل فحوص الصلاحيات (لا تظهر أدواره/صلاحياته ضمن سياق الفريق).
  is_super_admin: boolean
}

export const authApi = {
  login(username: string, password: string) {
    return unwrap<LoginResult>(
      apiClient.post('/auth/login', { username, password }),
    )
  },
  verifyTwoFactor(challenge: string, code: string) {
    return unwrap<TokenPayload>(
      apiClient.post('/auth/2fa/verify', { challenge, code }),
    )
  },
  ssoExchange(code: string) {
    return unwrap<TokenPayload>(apiClient.post('/auth/sso/exchange', { code }))
  },
  logout() {
    return unwrap<{ message: string }>(apiClient.post('/auth/logout'))
  },
  me() {
    return unwrap<AuthUser>(apiClient.get('/auth/me'))
  },
}
