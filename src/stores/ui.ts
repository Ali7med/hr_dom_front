import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { i18n, type AppLocale } from '@/locales'

export type ThemeMode = 'light' | 'dark'

const THEME_KEY = 'hr_dom_theme'
const LOCALE_KEY = 'hr_dom_locale'

function detectTheme(): ThemeMode {
  const saved = localStorage.getItem(THEME_KEY)
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

function detectLocale(): AppLocale {
  return localStorage.getItem(LOCALE_KEY) === 'en' ? 'en' : 'ar'
}

// متجر الواجهة: الثيم (فاتح/غامق) واللغة (عربي/إنجليزي) مع الحفظ و RTL.
export const useUiStore = defineStore('ui', () => {
  const theme = ref<ThemeMode>(detectTheme())
  const locale = ref<AppLocale>(detectLocale())

  function applyTheme(value: ThemeMode): void {
    document.documentElement.classList.toggle('dark', value === 'dark')
    localStorage.setItem(THEME_KEY, value)
  }

  function applyLocale(value: AppLocale): void {
    document.documentElement.lang = value
    document.documentElement.dir = value === 'ar' ? 'rtl' : 'ltr'
    i18n.global.locale.value = value
    localStorage.setItem(LOCALE_KEY, value)
  }

  function toggleTheme(): void {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
  }

  function setLocale(value: AppLocale): void {
    locale.value = value
  }

  function toggleLocale(): void {
    locale.value = locale.value === 'ar' ? 'en' : 'ar'
  }

  // طبّق فوراً عند الإنشاء وعند كل تغيير.
  watch(theme, applyTheme, { immediate: true })
  watch(locale, applyLocale, { immediate: true })

  return { theme, locale, toggleTheme, setLocale, toggleLocale }
})
