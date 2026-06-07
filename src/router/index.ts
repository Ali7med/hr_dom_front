import { createRouter, createWebHistory } from 'vue-router'

// مسارات الإقلاع. تُضاف شاشة الدخول والتخطيط والحُرّاس في FE-01/FE-02.
const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@/features/home/HomeView.vue'),
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})

export default router
