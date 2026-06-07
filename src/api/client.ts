import axios, {
  type AxiosError,
  type InternalAxiosRequestConfig,
} from 'axios'
import { tokenStorage } from './tokenStorage'

// الغلاف الموحّد لكل ردود الـ API: { data, meta, errors }
export interface ApiError {
  code: string
  message: string
  field?: string
}

export interface Envelope<T = unknown> {
  data: T
  meta: Record<string, unknown>
  errors: ApiError[]
}

// استثناء موحّد يحمل أخطاء العقد (code/message/field) ورمز الحالة.
export class ApiException extends Error {
  readonly errors: ApiError[]
  readonly status?: number

  constructor(message: string, errors: ApiError[], status?: number) {
    super(message)
    this.name = 'ApiException'
    this.errors = errors
    this.status = status
  }

  /** أول خطأ (إن وُجد) للعرض السريع. */
  get first(): ApiError | undefined {
    return this.errors[0]
  }
}

const baseURL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1'

export const apiClient = axios.create({
  baseURL,
  headers: { Accept: 'application/json' },
})

// طلب: أرفق توكن الوصول إن وُجد.
apiClient.interceptors.request.use((config) => {
  const token = tokenStorage.getAccess()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// خطّاف يُستدعى عند انتهاء الجلسة نهائياً (تُسجّله طبقة التطبيق لإعادة التوجيه للدخول).
let onUnauthorized: (() => void) | null = null
export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler
}

// مسارات يكون فيها 401 فشلَ مصادقة حقيقياً لا توكناً منتهياً — لا تُجدَّد.
const NO_REFRESH = [
  '/auth/login',
  '/auth/2fa/verify',
  '/auth/refresh',
  '/auth/sso/exchange',
]

// تجديد توكن الوصول مرة واحدة متزامنة (single-flight) عبر axios مجرّد لتفادي التكرار.
let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  const refresh = tokenStorage.getRefresh()
  if (!refresh) return null
  try {
    const res = await axios.post<Envelope<{ access_token: string; refresh_token: string | null }>>(
      `${baseURL}/auth/refresh`,
      { refresh_token: refresh },
      { headers: { Accept: 'application/json' } },
    )
    const data = res.data.data
    tokenStorage.set(data.access_token, data.refresh_token)
    return data.access_token
  } catch {
    return null
  }
}

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean }

// رد: جدّد التوكن بصمت عند 401، وإلا وحّد الأخطاء في ApiException وأنهِ الجلسة.
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<Envelope>) => {
    const status = error.response?.status
    const config = error.config as RetriableConfig | undefined
    const url = config?.url ?? ''

    const refreshable =
      status === 401 &&
      config !== undefined &&
      !config._retry &&
      !NO_REFRESH.some((path) => url.includes(path)) &&
      tokenStorage.getRefresh() !== null

    if (refreshable) {
      config!._retry = true
      refreshPromise = refreshPromise ?? refreshAccessToken()
      const newToken = await refreshPromise
      refreshPromise = null
      if (newToken) {
        config!.headers.Authorization = `Bearer ${newToken}`
        return apiClient(config!)
      }
    }

    const errors: ApiError[] = error.response?.data?.errors ?? [
      { code: 'network_error', message: error.message },
    ]

    if (status === 401) {
      tokenStorage.clear()
      onUnauthorized?.()
    }

    const message = errors[0]?.message ?? error.message
    return Promise.reject(new ApiException(message, errors, status))
  },
)

/**
 * مساعد رفيع لفكّ الغلاف وإرجاع `data` فقط.
 * استعمل `apiClient` مباشرةً عند الحاجة لـ `meta` (الترقيم/الإجماليات).
 */
export async function unwrap<T>(
  promise: Promise<{ data: Envelope<T> }>,
): Promise<T> {
  const response = await promise
  return response.data.data
}
