import axios, { type AxiosError } from 'axios'
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

// خطّاف يُستدعى عند 401 (تُسجّله طبقة التطبيق لإعادة التوجيه/التجديد في FE-01).
let onUnauthorized: (() => void) | null = null
export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler
}

// رد: وحّد الأخطاء في ApiException، وعالج 401 مركزياً.
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<Envelope>) => {
    const status = error.response?.status
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
