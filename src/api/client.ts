import axios, {
  type AxiosError,
  type InternalAxiosRequestConfig,
} from 'axios'
import { i18n } from '@/locales'

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

// حماية النشر: في بناء الإنتاج يجب أن يكون عنوان الـ API عبر HTTPS (وإلا تُرسَل
// التوكنات على HTTP). نحذّر بوضوح؛ والأفضل فحص مماثل في خطّ CI/النشر.
if (import.meta.env.PROD && !/^https:\/\//i.test(baseURL)) {
  console.error(
    `[security] VITE_API_BASE_URL is not HTTPS in a production build: "${baseURL}". ` +
      'Tokens would be sent over an insecure channel. Set an https:// API origin.',
  )
}

// المصادقة عبر كوكيز HttpOnly يضبطها الباك (BE-SEC/ADR-0003):
// - withCredentials: يرسل/يستقبل الكوكيز.
// - withXSRFToken + xsrf*: axios يقرأ كوكي XSRF-TOKEN ويرسله في ترويسة X-XSRF-TOKEN
//   (double-submit CSRF). يتطلّب أن يكون الـ API نفس-أصل (وكيل Vite في التطوير).
const authClientConfig = {
  baseURL,
  withCredentials: true,
  withXSRFToken: true,
  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-XSRF-TOKEN',
  headers: { Accept: 'application/json' },
}

export const apiClient = axios.create(authClientConfig)

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

// تجديد الجلسة مرة واحدة متزامنة (single-flight). العميل المجرّد بلا interceptors
// كي لا يُطلق فشلُ التجديد (401) خطّافَ onUnauthorized مبكراً. الكوكي يحمل التوكن.
const bareClient = axios.create(authClientConfig)
let refreshPromise: Promise<boolean> | null = null

async function refreshSession(): Promise<boolean> {
  try {
    await bareClient.post('/auth/refresh', {})
    return true
  } catch {
    return false
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
      !NO_REFRESH.some((path) => url.includes(path))

    if (refreshable) {
      config!._retry = true
      refreshPromise = refreshPromise ?? refreshSession()
      const ok = await refreshPromise
      refreshPromise = null
      if (ok) {
        // الكوكيز جُدّدت من الباك — أعِد الطلب الأصلي كما هو.
        return apiClient(config!)
      }
    }

    const errors: ApiError[] = error.response?.data?.errors ?? [
      { code: 'network_error', message: error.message },
    ]

    if (status === 401) {
      onUnauthorized?.()
    }

    // رسائل ودّية موحّدة للحالات غير المرتبطة بالحقول (شبكة/معدّل/خادم)؛
    // أمّا 4xx (403/422/...) فنُبقي رسالة الباك الدقيقة كما هي.
    const isNetwork = status === undefined || errors[0]?.code === 'network_error'
    let message: string
    if (isNetwork) message = i18n.global.t('errors.network')
    else if (status === 429) message = i18n.global.t('errors.rateLimited')
    else if (status >= 500) message = i18n.global.t('errors.server')
    else message = errors[0]?.message ?? error.message

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
