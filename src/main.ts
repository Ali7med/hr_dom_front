import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { i18n } from './locales'
import { setUnauthorizedHandler } from './api/client'
import './style.css'

const app = createApp(App)

app.use(createPinia())
app.use(i18n)
app.use(router)

// عند انتهاء الجلسة (401)، أعِد التوجيه للدخول. منطق التجديد يُضاف في FE-01.
setUnauthorizedHandler(() => {
  if (router.currentRoute.value.name !== 'login') {
    router.push({ name: 'home' })
  }
})

app.mount('#app')
