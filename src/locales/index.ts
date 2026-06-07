import { createI18n } from 'vue-i18n'
import ar from './ar.json'
import en from './en.json'

export type AppLocale = 'ar' | 'en'
export type MessageSchema = typeof ar

function initialLocale(): AppLocale {
  return localStorage.getItem('hr_dom_locale') === 'en' ? 'en' : 'ar'
}

export const i18n = createI18n<[MessageSchema], AppLocale, false>({
  legacy: false, // Composition API
  locale: initialLocale(),
  fallbackLocale: 'en',
  messages: { ar, en },
})
