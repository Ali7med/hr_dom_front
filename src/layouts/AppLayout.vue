<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterView, RouterLink, useRouter, useRoute, type RouteLocationRaw } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Menu from 'primevue/menu'
import Avatar from 'primevue/avatar'
import Toast from 'primevue/toast'
import ConfirmDialog from 'primevue/confirmdialog'
import type { MenuItem } from 'primevue/menuitem'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const ui = useUiStore()

// روابط التنقّل — أيقونات PrimeIcons + مفتاح i18n + صلاحية اختيارية.
interface NavItem {
  to: RouteLocationRaw
  name: string
  key: string
  icon: string
  permission?: string | string[]
}
const allNavItems: NavItem[] = [
  { to: { name: 'dashboard' }, name: 'dashboard', key: 'nav.dashboard', icon: 'pi pi-th-large' },
  { to: { name: 'companies' }, name: 'companies', key: 'nav.companies', icon: 'pi pi-building', permission: 'companies.view' },
  { to: { name: 'users' }, name: 'users', key: 'nav.users', icon: 'pi pi-users', permission: 'users.view' },
  { to: { name: 'roles' }, name: 'roles', key: 'nav.roles', icon: 'pi pi-shield', permission: 'roles.view' },
  { to: { name: 'work-sites' }, name: 'work-sites', key: 'nav.worksites', icon: 'pi pi-map-marker', permission: 'work_sites.view' },
  { to: { name: 'schedule' }, name: 'schedule', key: 'nav.schedule', icon: 'pi pi-calendar', permission: ['shifts.view', 'schedules.view', 'holidays.view'] },
  { to: { name: 'device-requests' }, name: 'device-requests', key: 'nav.deviceRequests', icon: 'pi pi-mobile', permission: 'devices.rebind_approve' },
  { to: { name: 'leaves' }, name: 'leaves', key: 'nav.leaves', icon: 'pi pi-sun', permission: 'leaves.view' },
  { to: { name: 'reports' }, name: 'reports', key: 'nav.reports', icon: 'pi pi-chart-bar', permission: 'reports.view' },
  { to: { name: 'payroll' }, name: 'payroll', key: 'nav.payroll', icon: 'pi pi-wallet', permission: 'payroll.view' },
  { to: { name: 'payroll-config' }, name: 'payroll-config', key: 'nav.payrollConfig', icon: 'pi pi-sliders-h', permission: ['currencies.view', 'salary_rules.view', 'penalty_rules.view', 'bonuses.view'] },
]
// تُعرض العناصر التي يملك المستخدم صلاحيتها فقط (Super Admin يرى الكل).
const navItems = computed(() =>
  allNavItems.filter(
    (item) => !item.permission || auth.canAny(typeof item.permission === 'string' ? [item.permission] : item.permission),
  ),
)

// عنوان الصفحة الحالي (للترويسة) من اسم المسار.
const pageTitle = computed(() => {
  const match = allNavItems.find((i) => i.name === route.name)
  if (match) return t(match.key)
  if (route.name === 'company-settings') return t('nav.companies')
  if (route.name === 'forbidden') return t('forbidden.title')
  return t('app.title')
})

// طيّ الشريط الجانبي إلى شريط أيقونات على الشاشات الكبيرة (محفوظ).
// الشريط ظاهر دائماً على كل الشاشات (أيقونات على الصغيرة، كامل على الكبيرة).
const COLLAPSE_KEY = 'hr_dom.sidebar.collapsed'
const collapsed = ref(localStorage.getItem(COLLAPSE_KEY) === '1')
function toggleCollapse(): void {
  collapsed.value = !collapsed.value
  localStorage.setItem(COLLAPSE_KEY, collapsed.value ? '1' : '0')
}
// تُعرض التسميات فقط على الشاشات الكبيرة وعند عدم الطيّ — الباقي شريط أيقونات.
const showLabels = computed(() => !collapsed.value)

// قائمة المستخدم المنبثقة.
const userMenu = ref()
const userMenuItems = computed<MenuItem[]>(() => [
  { label: auth.user?.name ?? '', items: [] },
  {
    label: t('layout.logout'),
    icon: 'pi pi-sign-out',
    command: () => void onLogout(),
  },
])
function toggleUserMenu(event: Event): void {
  userMenu.value?.toggle(event)
}

const initials = computed(() => (auth.user?.name ?? '?').trim().charAt(0).toUpperCase())

async function onLogout(): Promise<void> {
  await auth.logout()
  router.replace({ name: 'login' })
}
</script>

<template>
  <div class="flex min-h-svh bg-surface-50 text-surface-800 dark:bg-surface-950 dark:text-surface-100">
    <!-- ===== الشريط الجانبي (ظاهر دائماً على كل الشاشات: أيقونات صغيراً، كامل كبيراً) ===== -->
    <aside
      class="sticky top-0 z-30 flex h-svh w-[4.75rem] shrink-0 flex-col border-e border-surface-200 bg-white transition-[width] duration-200 dark:border-surface-800 dark:bg-surface-900"
      :class="collapsed ? 'lg:w-[4.75rem]' : 'lg:w-64'"
    >
      <!-- الشعار -->
      <div class="flex h-16 items-center gap-3 border-b border-surface-200 px-3 dark:border-surface-800" :class="showLabels ? 'lg:px-5' : 'justify-center'">
        <span class="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-contrast">
          <i class="pi pi-clock text-lg" />
        </span>
        <span v-if="showLabels" class="hidden truncate text-base font-bold tracking-tight lg:inline">{{ t('app.title') }}</span>
      </div>

      <!-- روابط التنقّل -->
      <nav class="flex-1 space-y-1 overflow-y-auto p-2 lg:p-3">
        <RouterLink
          v-for="item in navItems"
          :key="item.key"
          :to="item.to"
          v-tooltip="{ value: t(item.key), disabled: showLabels, showDelay: 120 }"
          class="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-surface-600 transition hover:bg-surface-100 hover:text-surface-900 dark:text-surface-300 dark:hover:bg-surface-800 dark:hover:text-white"
          active-class="!bg-primary-50 !text-primary-700 dark:!bg-primary-500/15 dark:!text-primary-300"
          :class="showLabels ? 'justify-center lg:justify-start' : 'justify-center'"
          @click="userMenu?.hide?.()"
        >
          <i :class="item.icon" class="shrink-0 text-lg" />
          <span v-if="showLabels" class="hidden truncate lg:inline">{{ t(item.key) }}</span>
        </RouterLink>
      </nav>

      <!-- زر الطيّ (شاشات كبيرة فقط) -->
      <div class="hidden border-t border-surface-200 p-3 dark:border-surface-800 lg:block">
        <button
          type="button"
          class="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-surface-500 transition hover:bg-surface-100 dark:text-surface-400 dark:hover:bg-surface-800"
          :class="collapsed ? 'justify-center' : ''"
          @click="toggleCollapse"
        >
          <i class="pi text-lg" :class="collapsed ? 'pi-angle-double-right rtl:pi-angle-double-left' : 'pi-angle-double-left rtl:pi-angle-double-right'" />
          <span v-if="!collapsed" class="truncate">{{ t('layout.collapse') }}</span>
        </button>
      </div>
    </aside>

    <!-- ===== العمود الرئيسي ===== -->
    <div class="flex min-w-0 flex-1 flex-col">
      <header
        class="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-surface-200 bg-white/80 px-4 backdrop-blur dark:border-surface-800 dark:bg-surface-900/80 lg:px-6"
      >
        <h1 class="truncate text-lg font-semibold tracking-tight">{{ pageTitle }}</h1>

        <div class="ms-auto flex items-center gap-1.5">
          <button
            type="button"
            class="grid h-10 min-w-10 place-items-center rounded-xl px-2.5 text-xs font-semibold text-surface-600 transition hover:bg-surface-100 dark:text-surface-300 dark:hover:bg-surface-800"
            :title="t('common.toggleLanguage')"
            @click="ui.toggleLocale()"
          >
            {{ ui.locale === 'ar' ? 'EN' : 'ع' }}
          </button>
          <button
            type="button"
            class="grid size-10 place-items-center rounded-xl text-surface-600 transition hover:bg-surface-100 dark:text-surface-300 dark:hover:bg-surface-800"
            :title="t('common.toggleTheme')"
            @click="ui.toggleTheme()"
          >
            <i class="pi text-lg" :class="ui.theme === 'dark' ? 'pi-sun' : 'pi-moon'" />
          </button>

          <button
            type="button"
            class="ms-1 flex items-center gap-2 rounded-xl py-1.5 ps-1.5 pe-2.5 transition hover:bg-surface-100 dark:hover:bg-surface-800"
            @click="toggleUserMenu"
          >
            <Avatar :label="initials" shape="circle" class="!bg-primary !text-primary-contrast" />
            <span v-if="auth.user" class="hidden max-w-32 truncate text-sm font-medium sm:inline">{{ auth.user.name }}</span>
            <i class="pi pi-angle-down hidden text-xs text-surface-500 sm:inline" />
          </button>
          <Menu ref="userMenu" :model="userMenuItems" :popup="true" />
        </div>
      </header>

      <main class="flex-1 p-4 lg:p-6">
        <RouterView />
      </main>
    </div>

    <!-- خدمات عامة: إشعارات + تأكيد الحذف -->
    <Toast position="top-center" />
    <ConfirmDialog />
  </div>
</template>
