<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterView, useRouter, type RouteLocationRaw } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'

const { t } = useI18n()
const router = useRouter()
const auth = useAuthStore()
const ui = useUiStore()

// روابط التنقّل — تُضاف وحدات FE اللاحقة هنا. كل عنصر قد يتطلّب صلاحية.
interface NavItem {
  to: RouteLocationRaw
  key: string
  icon: string
  // صلاحية واحدة أو قائمة (يكفي أيٌّ منها) لإظهار العنصر.
  permission?: string | string[]
}
const allNavItems: NavItem[] = [
  { to: { name: 'dashboard' }, key: 'nav.dashboard', icon: '▦' },
  { to: { name: 'companies' }, key: 'nav.companies', icon: '🏢', permission: 'companies.view' },
  { to: { name: 'users' }, key: 'nav.users', icon: '👥', permission: 'users.view' },
  { to: { name: 'roles' }, key: 'nav.roles', icon: '🛡️', permission: 'roles.view' },
  { to: { name: 'work-sites' }, key: 'nav.worksites', icon: '📍', permission: 'work_sites.view' },
  { to: { name: 'schedule' }, key: 'nav.schedule', icon: '🗓️', permission: ['shifts.view', 'schedules.view', 'holidays.view'] },
  { to: { name: 'device-requests' }, key: 'nav.deviceRequests', icon: '📱', permission: 'devices.rebind_approve' },
  { to: { name: 'leaves' }, key: 'nav.leaves', icon: '🌴', permission: 'leaves.view' },
  { to: { name: 'reports' }, key: 'nav.reports', icon: '📊', permission: 'reports.view' },
  { to: { name: 'payroll' }, key: 'nav.payroll', icon: '💰', permission: 'payroll.view' },
  { to: { name: 'payroll-config' }, key: 'nav.payrollConfig', icon: '⚙️', permission: ['currencies.view', 'salary_rules.view', 'penalty_rules.view', 'bonuses.view'] },
]
// تُعرض العناصر التي يملك المستخدم صلاحيتها فقط (Super Admin يرى الكل).
const navItems = computed(() =>
  allNavItems.filter(
    (item) => !item.permission || auth.canAny(typeof item.permission === 'string' ? [item.permission] : item.permission),
  ),
)

const sidebarOpen = ref(false)

async function onLogout(): Promise<void> {
  await auth.logout()
  router.replace({ name: 'login' })
}
</script>

<template>
  <div class="flex min-h-svh bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
    <!-- الشريط الجانبي -->
    <aside
      class="fixed inset-y-0 z-30 w-64 transform border-e border-slate-200 bg-white transition-transform dark:border-slate-800 dark:bg-slate-900 lg:static lg:translate-x-0 rtl:start-0"
      :class="
        sidebarOpen
          ? 'translate-x-0'
          : 'ltr:-translate-x-full rtl:translate-x-full lg:translate-x-0'
      "
    >
      <div class="flex h-16 items-center gap-2 border-b border-slate-200 px-6 dark:border-slate-800">
        <span class="text-lg font-bold">{{ t('app.title') }}</span>
      </div>
      <nav class="space-y-1 p-4">
        <RouterLink
          v-for="item in navItems"
          :key="item.key"
          :to="item.to"
          class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          active-class="bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
          @click="sidebarOpen = false"
        >
          <span aria-hidden="true">{{ item.icon }}</span>
          {{ t(item.key) }}
        </RouterLink>
      </nav>
    </aside>

    <!-- طبقة تعتيم للجوال عند فتح الشريط -->
    <div
      v-if="sidebarOpen"
      class="fixed inset-0 z-20 bg-black/30 lg:hidden"
      @click="sidebarOpen = false"
    />

    <!-- العمود الرئيسي -->
    <div class="flex min-w-0 flex-1 flex-col">
      <header
        class="sticky top-0 z-10 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/80 px-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/80 lg:px-6"
      >
        <button
          type="button"
          class="rounded-lg p-2 text-slate-600 hover:bg-slate-100 lg:hidden dark:text-slate-300 dark:hover:bg-slate-800"
          :aria-label="t('layout.menu')"
          @click="sidebarOpen = !sidebarOpen"
        >
          ☰
        </button>

        <div class="ms-auto flex items-center gap-2">
          <button
            type="button"
            class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium transition hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            :title="t('common.toggleLanguage')"
            @click="ui.toggleLocale()"
          >
            {{ ui.locale === 'ar' ? 'EN' : 'ع' }}
          </button>
          <button
            type="button"
            class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium transition hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
            :title="t('common.toggleTheme')"
            @click="ui.toggleTheme()"
          >
            {{ ui.theme === 'dark' ? '☀' : '☾' }}
          </button>

          <span v-if="auth.user" class="ms-2 hidden text-sm text-slate-600 sm:inline dark:text-slate-300">
            {{ auth.user.name }}
          </span>
          <button
            type="button"
            class="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            @click="onLogout"
          >
            {{ t('layout.logout') }}
          </button>
        </div>
      </header>

      <main class="flex-1 p-4 lg:p-6">
        <RouterView />
      </main>
    </div>
  </div>
</template>
