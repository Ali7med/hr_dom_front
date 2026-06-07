import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { tokenStorage } from '@/api/tokenStorage'

// متجر الجلسة: يخزّن التوكنات ويعكس حالة الدخول.
// منطق الدخول الكامل (login / 2FA / SSO / refresh) يُضاف في FE-01.
export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref<string | null>(tokenStorage.getAccess())
  const refreshToken = ref<string | null>(tokenStorage.getRefresh())

  const isAuthenticated = computed(() => Boolean(accessToken.value))

  function setTokens(access: string, refresh?: string | null): void {
    accessToken.value = access
    if (refresh !== undefined) refreshToken.value = refresh
    tokenStorage.set(access, refresh)
  }

  function clear(): void {
    accessToken.value = null
    refreshToken.value = null
    tokenStorage.clear()
  }

  return { accessToken, refreshToken, isAuthenticated, setTokens, clear }
})
