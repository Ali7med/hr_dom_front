import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { i18n } from './locales'
import { setUnauthorizedHandler } from './api/client'
import { useAuthStore } from './stores/auth'
import './style.css'

const app = createApp(App)

app.use(createPinia())
app.use(i18n)

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
