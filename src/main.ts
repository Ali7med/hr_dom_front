import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config'
import { definePreset } from '@primeuix/themes'
import Aura from '@primeuix/themes/aura'
import ConfirmationService from 'primevue/confirmationservice'
import ToastService from 'primevue/toastservice'
import Tooltip from 'primevue/tooltip'
import App from './App.vue'
import router from './router'
import { i18n } from './locales'
import { setUnauthorizedHandler } from './api/client'
import { useAuthStore } from './stores/auth'
import { vCan } from './directives/can'
import 'primeicons/primeicons.css'
import './style.css'

const app = createApp(App)

app.use(createPinia())
app.use(i18n)
// لون العلامة (indigo) لكل مكوّنات PrimeVue ليطابق الشريط الجانبي والشل.
const HrPreset = definePreset(Aura, {
  semantic: {
    primary: {
      50: '{indigo.50}',
      100: '{indigo.100}',
      200: '{indigo.200}',
      300: '{indigo.300}',
      400: '{indigo.400}',
      500: '{indigo.500}',
      600: '{indigo.600}',
      700: '{indigo.700}',
      800: '{indigo.800}',
      900: '{indigo.900}',
      950: '{indigo.950}',
    },
  },
})
// نظام التصميم PrimeVue 4 — ثيم Aura، الوضع الغامق مربوط بصنف .dark القائم،
// و cssLayer ليتمكّن Tailwind من تجاوز أنماط المكوّنات عند الحاجة (انظر style.css).
app.use(PrimeVue, {
  theme: {
    preset: HrPreset,
    options: {
      darkModeSelector: '.dark',
      cssLayer: {
        name: 'primevue',
        order: 'theme, base, primevue, components, utilities',
      },
    },
  },
  ripple: true,
})
app.use(ConfirmationService)
app.use(ToastService)
app.directive('tooltip', Tooltip)
app.directive('can', vCan)

// عند انتهاء الجلسة نهائياً (401 وفشل التجديد): نظّف الجلسة وأعِد التوجيه للدخول.
setUnauthorizedHandler(() => {
  const auth = useAuthStore()
  auth.clear()
  if (router.currentRoute.value.name !== 'login') {
    router.push({ name: 'login' })
  }
})

// إقلاع المصادقة قبل تركيب الموجّه حتى يرى الحارس حالة صحيحة من أول تنقّل.
// (استبدال كود SSO يجري داخل حارس الموجّه — انظر router/index.ts.)
async function boot(): Promise<void> {
  const auth = useAuthStore()
  await auth.bootstrap()

  app.use(router)
  await router.isReady()
  app.mount('#app')
}

void boot()
