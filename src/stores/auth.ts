import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { tokenStorage } from '@/api/tokenStorage'
import {
  authApi,
  isTwoFactorChallenge,
  type AuthUser,
  type TokenPayload,
  type TwoFactorChallenge,
} from '@/api/auth'

// متجر الجلسة: التوكنات + المستخدم الحالي + تدفّقات الدخول (login / 2FA / SSO / refresh).
export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref<string | null>(tokenStorage.getAccess())
  const refreshToken = ref<string | null>(tokenStorage.getRefresh())
  const user = ref<AuthUser | null>(null)
  const loading = ref(false)

  const isAuthenticated = computed(() => Boolean(accessToken.value))
  const roles = computed<string[]>(() => user.value?.roles ?? [])
  const permissions = computed<string[]>(() => user.value?.permissions ?? [])

  function setTokens(access: string, refresh?: string | null): void {
    accessToken.value = access
    if (refresh !== undefined) refreshToken.value = refresh
    tokenStorage.set(access, refresh)
  }

  function clear(): void {
    accessToken.value = null
    refreshToken.value = null
    user.value = null
    tokenStorage.clear()
  }

  function applyTokens(payload: TokenPayload): void {
    setTokens(payload.access_token, payload.refresh_token)
  }

  async function fetchUser(): Promise<AuthUser> {
    const me = await authApi.me()
    user.value = me
    return me
  }

  // دخول عادي: يعيد تحدّي 2FA إن كان مطلوباً، وإلا يُنشئ الجلسة ويعيد null.
  async function login(
    username: string,
    password: string,
  ): Promise<TwoFactorChallenge | null> {
    loading.value = true
    try {
      const result = await authApi.login(username, password)
      if (isTwoFactorChallenge(result)) return result
      applyTokens(result)
      await fetchUser()
      return null
    } finally {
      loading.value = false
    }
  }

  // إكمال تحدّي 2FA: يُصدر التوكنات ويحمّل المستخدم.
  async function verifyTwoFactor(challenge: string, code: string): Promise<void> {
    loading.value = true
    try {
      applyTokens(await authApi.verifyTwoFactor(challenge, code))
      await fetchUser()
    } finally {
      loading.value = false
    }
  }

  // استبدال كود SSO لمرة واحدة بتوكن حقيقي ثم تحميل المستخدم.
  async function completeSso(code: string): Promise<void> {
    applyTokens(await authApi.ssoExchange(code))
    await fetchUser()
  }

  async function logout(): Promise<void> {
    try {
      await authApi.logout()
    } catch {
      // التوكن قد يكون منتهياً/الشبكة مقطوعة — نظّف الجلسة محلياً على أي حال.
    }
    clear()
  }

  // عند الإقلاع: إن وُجد توكن دون مستخدم، حمّله؛ ونظّف الجلسة إن فشل.
  async function bootstrap(): Promise<void> {
    if (!accessToken.value || user.value) return
    try {
      await fetchUser()
    } catch {
      clear()
    }
  }

  return {
    accessToken,
    refreshToken,
    user,
    loading,
    isAuthenticated,
    roles,
    permissions,
    setTokens,
    clear,
    fetchUser,
    login,
    verifyTwoFactor,
    completeSso,
    logout,
    bootstrap,
  }
})
