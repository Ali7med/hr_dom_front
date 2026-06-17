import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { settingsTabs, allSettingsPermissions } from '@/features/settings/settingsTabs'

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
        // ===== العمليات (تنقّل رئيسي) =====
        {
          path: 'leaves',
          name: 'leaves',
          component: () => import('@/features/leaves/LeavesView.vue'),
          meta: { permission: 'leaves.view' },
        },
        {
          path: 'calendar',
          name: 'calendar',
          component: () => import('@/features/calendar/CalendarView.vue'),
          meta: { permission: ['shifts.view', 'schedules.view', 'holidays.view', 'leaves.view'] },
        },
        {
          path: 'leave-reports',
          name: 'leave-reports',
          component: () => import('@/features/leaves/LeaveReportsView.vue'),
          meta: { permission: 'reports.view' },
        },
        {
          path: 'report-subscriptions',
          name: 'report-subscriptions',
          component: () => import('@/features/reports/ReportSubscriptionsView.vue'),
          meta: { permission: 'reports.view' },
        },
        {
          path: 'alerts',
          name: 'alerts',
          component: () => import('@/features/alerts/AlertsView.vue'),
          meta: { permission: 'alerts.view' },
        },
        {
          path: 'absences',
          name: 'absences',
          component: () => import('@/features/absences/AbsencesView.vue'),
          meta: { permission: 'absences.view' },
        },
        {
          path: 'excuses',
          name: 'excuses',
          component: () => import('@/features/excuses/ExcusesView.vue'),
          meta: { permission: 'excuses.view' },
        },
        {
          path: 'overtime',
          name: 'overtime',
          component: () => import('@/features/overtime/OvertimeView.vue'),
          meta: { permission: 'overtime.view' },
        },
        {
          path: 'shift-swaps',
          name: 'shift-swaps',
          component: () => import('@/features/shiftSwaps/ShiftSwapsView.vue'),
          meta: { permission: 'shift_swaps.view' },
        },
        {
          path: 'loans',
          name: 'loans',
          component: () => import('@/features/loans/LoansView.vue'),
          meta: { permission: 'loans.view' },
        },
        {
          path: 'employee-documents',
          name: 'employee-documents',
          component: () => import('@/features/documents/EmployeeDocumentsView.vue'),
          meta: { permission: 'documents.view' },
        },
        {
          path: 'approval-delegations',
          name: 'approval-delegations',
          component: () => import('@/features/delegations/DelegationsView.vue'),
          // التفويض متاح لمن يملك صلاحية اعتماد ما (إجازات/أذونات/إضافي).
          meta: { permission: ['leaves.approve', 'excuses.approve', 'overtime.approve'] },
        },
        {
          path: 'onboarding',
          name: 'onboarding',
          component: () => import('@/features/onboarding/OnboardingView.vue'),
          meta: { permission: 'onboarding.manage' },
        },
        {
          path: 'reports',
          name: 'reports',
          component: () => import('@/features/reports/ReportsView.vue'),
          meta: { permission: 'reports.view' },
        },
        {
          path: 'payroll',
          name: 'payroll',
          component: () => import('@/features/payroll/PayrollView.vue'),
          meta: { permission: 'payroll.view' },
        },
        {
          // قسيمة راتب الموظف الحالي — متاحة لأي مستخدم مُصادَق (بلا صلاحية).
          path: 'my-payslips',
          name: 'my-payslips',
          component: () => import('@/features/payslips/MyPayslipsView.vue'),
        },
        // ===== الإعدادات (الضبط الإداري — تبويبات داخل SettingsLayout) =====
        {
          path: 'settings',
          component: () => import('@/layouts/SettingsLayout.vue'),
          meta: { permission: allSettingsPermissions },
          children: [
            {
              path: '',
              name: 'settings',
              // إعادة توجيه لأول تبويب يملك المستخدم صلاحيته (أو تبويب ذاتي بلا صلاحية).
              redirect: () => {
                const auth = useAuthStore()
                const first = settingsTabs.find(
                  (tab) => !tab.permission || auth.canAny(typeof tab.permission === 'string' ? [tab.permission] : tab.permission),
                )
                return { name: first?.name ?? 'forbidden' }
              },
            },
            {
              path: 'companies',
              name: 'companies',
              component: () => import('@/features/companies/CompaniesListView.vue'),
              meta: { permission: 'companies.view' },
            },
            {
              path: 'companies/:id',
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
              meta: { permission: ['shifts.view', 'schedules.view', 'holidays.view'] },
            },
            {
              path: 'devices',
              name: 'device-requests',
              component: () => import('@/features/devices/DeviceRebindView.vue'),
              meta: { permission: 'devices.rebind_approve' },
            },
            {
              path: 'payroll-config',
              name: 'payroll-config',
              component: () => import('@/features/payroll-config/PayrollConfigView.vue'),
              meta: { permission: ['currencies.view', 'salary_rules.view', 'penalty_rules.view', 'bonuses.view'] },
            },
            {
              path: 'notifications',
              name: 'notification-settings',
              component: () => import('@/features/settings/NotificationSettingsView.vue'),
              meta: { permission: 'notification_settings.manage' },
            },
            {
              // ربط تيليجرام لبوت الموافقات — خدمة ذاتية (بلا صلاحية)؛ نُقِل إلى الإعدادات.
              path: 'telegram-link',
              name: 'telegram-link',
              component: () => import('@/features/telegram/TelegramLinkView.vue'),
            },
            {
              path: 'backups',
              name: 'backups',
              component: () => import('@/features/backups/BackupsView.vue'),
              meta: { permission: 'backups.manage' },
            },
          ],
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
