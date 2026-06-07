import type { Directive } from 'vue'
import { useAuthStore } from '@/stores/auth'

/**
 * v-can="'users.view'"  أو  v-can="['a','b']" (يكفي امتلاك أيٍّ منها).
 * يزيل العنصر من الـ DOM إن لم يملك المستخدم الصلاحية (Super Admin يتجاوز).
 * الصلاحيات ثابتة طوال الجلسة (تُجلب عند الدخول)، فالفحص عند التركيب يكفي.
 */
function allowed(value: string | string[] | undefined | null): boolean {
  if (value == null || (Array.isArray(value) && value.length === 0)) return true
  const auth = useAuthStore()
  return Array.isArray(value) ? auth.canAny(value) : auth.can(value)
}

export const vCan: Directive<HTMLElement, string | string[] | undefined> = {
  mounted(el, binding) {
    if (!allowed(binding.value)) {
      el.remove()
    }
  },
}
