// تخزين توكنات الجلسة في localStorage.
// يُستخدَم من apiClient (interceptor) ومن متجر المصادقة (auth store)
// لتفادي الاعتماد الدائري بينهما.

const ACCESS_KEY = 'hr_dom_access_token'
const REFRESH_KEY = 'hr_dom_refresh_token'

export const tokenStorage = {
  getAccess(): string | null {
    return localStorage.getItem(ACCESS_KEY)
  },
  getRefresh(): string | null {
    return localStorage.getItem(REFRESH_KEY)
  },
  set(access: string, refresh?: string | null): void {
    localStorage.setItem(ACCESS_KEY, access)
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh)
  },
  clear(): void {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
  },
}
