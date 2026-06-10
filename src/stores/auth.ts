import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import {
  authApi,
  isTwoFactorChallenge,
  type AuthUser,
  type TwoFactorChallenge,
} from '@/api/auth'

// متجر الجلسة: المستخدم الحالي + تدفّقات الدخول (login / 2FA / SSO / refresh / logout).
// المصادقة عبر كوكيز HttpOnly يضبطها الباك (BE-SEC/ADR-0003) — لا توكنات في الواجهة.
// «مسجّل دخول» = وجود مستخدم مُحمَّل من /auth/me (الكوكي صالح).
export const useAuthStore = defineStore('auth', () => {
  const user = ref<AuthUser | null>(null)
  const loading = ref(false)

  const isAuthenticated = computed(() => user.value !== null)
  const roles = computed<string[]>(() => user.value?.roles ?? [])
  const permissions = computed<string[]>(() => user.value?.permissions ?? [])
  const isSuperAdmin = computed(() => user.value?.is_super_admin === true)

  // فحص صلاحية واحدة (مع تجاوز Super Admin).
  function can(permission: string): boolean {
    return isSuperAdmin.value || permissions.value.includes(permission)
  }

  // يكفي امتلاك أيٍّ من الصلاحيات المعطاة (قائمة فارغة = مسموح).
  function canAny(perms: string[]): boolean {
    return isSuperAdmin.value || perms.length === 0 || perms.some(can)
  }

  function hasRole(role: string): boolean {
    return isSuperAdmin.value || roles.value.includes(role)
  }

  function clear(): void {
    user.value = null
  }

  async function fetchUser(): Promise<AuthUser> {
    const me = await authApi.me()
    user.value = me
    return me
  }

  // دخول عادي: يعيد تحدّي 2FA إن كان مطلوباً، وإلا تُضبط الكوكيز ويُحمّل المستخدم.
  async function login(
    username: string,
    password: string,
  ): Promise<TwoFactorChallenge | null> {
    loading.value = true
    try {
      const result = await authApi.login(username, password)
      if (isTwoFactorChallenge(result)) return result
      // التوكنات في كوكيز HttpOnly ضُبطت من الباك — نحمّل المستخدم لتأكيد الجلسة.
      await fetchUser()
      return null
    } finally {
      loading.value = false
    }
  }

  // إكمال تحدّي 2FA: تُضبط الكوكيز ثم يُحمّل المستخدم.
  async function verifyTwoFactor(challenge: string, code: string): Promise<void> {
    loading.value = true
    try {
      await authApi.verifyTwoFactor(challenge, code)
      await fetchUser()
    } finally {
      loading.value = false
    }
  }

  // استبدال كود SSO لمرة واحدة (يضبط الكوكيز) ثم تحميل المستخدم.
  async function completeSso(code: string): Promise<void> {
    await authApi.ssoExchange(code)
    await fetchUser()
  }

  async function logout(): Promise<void> {
    try {
      await authApi.logout()
    } catch {
      // الكوكي قد يكون منتهياً/الشبكة مقطوعة — نظّف الجلسة محلياً على أي حال.
    }
    clear()
  }

  // عند الإقلاع: حاول تحميل المستخدم من الكوكي (إن وُجدت جلسة صالحة)، وإلا ابقَ زائراً.
  async function bootstrap(): Promise<void> {
    if (user.value) return
    try {
      await fetchUser()
    } catch {
      clear()
    }
  }

  return {
    user,
    loading,
    isAuthenticated,
    roles,
    permissions,
    isSuperAdmin,
    can,
    canAny,
    hasRole,
    clear,
    fetchUser,
    login,
    verifyTwoFactor,
    completeSso,
    logout,
    bootstrap,
  }
})
