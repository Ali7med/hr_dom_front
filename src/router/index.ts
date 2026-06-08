import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

declare module 'vue-router' {
  interface RouteMeta {
    requiresAuth?: boolean
    guestOnly?: boolean
    // صلاحية (أو صلاحيات، يكفي أيٌّ منها) مطلوبة للوصول للمسار.
    permission?: string | string[]
  }
}

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
        {
          path: 'companies',
          name: 'companies',
          component: () => import('@/features/companies/CompaniesListView.vue'),
          meta: { permission: 'companies.view' },
        },
        {
          path: 'companies/:id/settings',
          name: 'company-settings',
          component: () => import('@/features/companies/CompanySettingsView.vue'),
          meta: { permission: 'companies.view' },
        },
        {
          path: 'users',
          name: 'users',
          component: () => import('@/features/users/UsersView.vue'),
          meta: { permission: 'users.view' },
        },
        {
          path: 'roles',
          name: 'roles',
          component: () => import('@/features/roles/RolesView.vue'),
          meta: { permission: 'roles.view' },
        },
        {
          path: 'work-sites',
          name: 'work-sites',
          component: () => import('@/features/worksites/WorkSitesView.vue'),
          meta: { permission: 'work_sites.view' },
        },
        {
          path: 'schedule',
          name: 'schedule',
          component: () => import('@/features/schedule/ScheduleView.vue'),
          meta: { permission: ['shifts.manage', 'schedules.manage'] },
        },
        {
          path: 'device-requests',
          name: 'device-requests',
          component: () => import('@/features/devices/DeviceRebindView.vue'),
          meta: { permission: 'devices.rebind_approve' },
        },
        {
          path: 'leaves',
          name: 'leaves',
          component: () => import('@/features/leaves/LeavesView.vue'),
          meta: { permission: 'leaves.view' },
        },
        {
          path: 'reports',
          name: 'reports',
          component: () => import('@/features/reports/ReportsView.vue'),
          meta: { permission: 'reports.view' },
        },
        {
          path: '403',
          name: 'forbidden',
          component: () => import('@/features/errors/ForbiddenView.vue'),
        },
      ],
    },
    {
      path: '/:pathMatch(.*)*',
      redirect: '/',
    },
  ],
})

// يحوّل meta.permission إلى قائمة موحّدة.
function requiredPermissions(permission: string | string[] | undefined): string[] {
  if (typeof permission === 'string') return [permission]
  if (Array.isArray(permission)) return permission
  return []
}

// حارس المصادقة + الصلاحيات + استبدال كود SSO.
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

  // حماية بالصلاحيات: من يفتقد الصلاحية يُحوَّل لصفحة 403 (Super Admin يتجاوز).
  const perms = requiredPermissions(to.meta.permission)
  if (perms.length > 0 && !auth.canAny(perms)) {
    return { name: 'forbidden' }
  }

  return true
})

export default router
