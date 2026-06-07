import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/login',
      name: 'login',
      component: () => import('@/features/auth/LoginView.vue'),
      meta: { guestOnly: true },
    },
    {
      path: '/',
      component: () => import('@/layouts/AppLayout.vue'),
      meta: { requiresAuth: true },
      children: [
        {
          path: '',
          name: 'dashboard',
          component: () => import('@/features/home/HomeView.vue'),
        },
      ],
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})

// حارس المصادقة + استبدال كود SSO.
router.beforeEach(async (to) => {
  const auth = useAuthStore()

  // SSO: عند وجود `?code=`، استبدله لمرة واحدة ثم أعِد توجيهاً نظيفاً بلا الكود
  // في الرابط (يديره الموجّه نفسه، فلا يُكشف الكود ولا يُلتقط في `redirect`).
  if (typeof to.query.code === 'string' && to.query.code) {
    try {
      await auth.completeSso(to.query.code)
    } catch {
      // فشل الاستبدال — يبقى المستخدم زائراً ويُكمل للحارس أدناه.
    }
    const query = { ...to.query }
    delete query.code
    return { path: to.path, query, replace: true }
  }

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    return { name: 'login', query: { redirect: to.fullPath } }
  }
  if (to.meta.guestOnly && auth.isAuthenticated) {
    return { name: 'dashboard' }
  }
  return true
})

export default router
