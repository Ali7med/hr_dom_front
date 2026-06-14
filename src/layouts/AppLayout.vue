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
import { settingsTabs, allSettingsPermissions } from '@/features/settings/settingsTabs'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const ui = useUiStore()

// روابط التنقّل — مصنّفة في أقسام؛ خيارات الضبط جُمِعت في «الإعدادات» (صفحة تبويبات).
interface NavItem {
  to: RouteLocationRaw
  name: string
  key: string
  icon: string
  section: string
  permission?: string | string[]
}
const allNavItems: NavItem[] = [
  { to: { name: 'dashboard' }, name: 'dashboard', key: 'nav.dashboard', icon: 'pi pi-th-large', section: 'general' },
  { to: { name: 'my-payslips' }, name: 'my-payslips', key: 'nav.myPayslips', icon: 'pi pi-receipt', section: 'general' },
  { to: { name: 'leaves' }, name: 'leaves', key: 'nav.leaves', icon: 'pi pi-sun', permission: 'leaves.view', section: 'operations' },
  { to: { name: 'payroll' }, name: 'payroll', key: 'nav.payroll', icon: 'pi pi-wallet', permission: 'payroll.view', section: 'operations' },
  { to: { name: 'alerts' }, name: 'alerts', key: 'nav.alerts', icon: 'pi pi-bell', permission: 'alerts.view', section: 'operations' },
  { to: { name: 'absences' }, name: 'absences', key: 'nav.absences', icon: 'pi pi-user-minus', permission: 'absences.view', section: 'operations' },
  { to: { name: 'excuses' }, name: 'excuses', key: 'nav.excuses', icon: 'pi pi-clock', permission: 'excuses.view', section: 'operations' },
  { to: { name: 'overtime' }, name: 'overtime', key: 'nav.overtime', icon: 'pi pi-stopwatch', permission: 'overtime.view', section: 'operations' },
  { to: { name: 'shift-swaps' }, name: 'shift-swaps', key: 'nav.shiftSwaps', icon: 'pi pi-sync', permission: 'shifts.manage', section: 'operations' },
  { to: { name: 'reports' }, name: 'reports', key: 'nav.reports', icon: 'pi pi-chart-bar', permission: 'reports.view', section: 'reports' },
  { to: { name: 'leave-reports' }, name: 'leave-reports', key: 'nav.leaveReports', icon: 'pi pi-calendar-clock', permission: 'reports.view', section: 'reports' },
  { to: { name: 'report-subscriptions' }, name: 'report-subscriptions', key: 'nav.reportSubscriptions', icon: 'pi pi-envelope', permission: 'reports.view', section: 'reports' },
  { to: { name: 'settings' }, name: 'settings', key: 'nav.settings', icon: 'pi pi-cog', permission: allSettingsPermissions, section: 'admin' },
]
// تُعرض العناصر التي يملك المستخدم صلاحيتها فقط (Super Admin يرى الكل).
const navItems = computed(() =>
  allNavItems.filter(
    (item) => !item.permission || auth.canAny(typeof item.permission === 'string' ? [item.permission] : item.permission),
  ),
)
// تجميع الروابط في أقسام مرتّبة (تُخفى الأقسام الفارغة).
const sectionOrder: { key: string; label: string }[] = [
  { key: 'general', label: 'navSection.general' },
  { key: 'operations', label: 'navSection.operations' },
  { key: 'reports', label: 'navSection.reports' },
  { key: 'admin', label: 'navSection.admin' },
]
const navSections = computed(() =>
  sectionOrder
    .map((s) => ({ ...s, items: navItems.value.filter((i) => i.section === s.key) }))
    .filter((s) => s.items.length > 0),
)

// عنوان الصفحة الحالي (للترويسة) من اسم المسار.
const pageTitle = computed(() => {
  const match = allNavItems.find((i) => i.name === route.name)
  if (match) return t(match.key)
  // أي مسار ضمن الإعدادات → «الإعدادات».
  const inSettings =
    route.name === 'settings' ||
    route.name === 'company-settings' ||
    settingsTabs.some((tab) => tab.name === route.name)
  if (inSettings) return t('nav.settings')
  if (route.name === 'forbidden') return t('forbidden.title')
  return t('app.title')
})

// سلوك الشريط الجانبي:
// - افتراضياً مغلق (شريط أيقونات)، ينفتح عند التمرير/التركيز ويُغلق عند المغادرة.
// - زر «التثبيت» بالأسفل يجعله ثابتاً مفتوحاً (يلغي الانغلاق التلقائي). الحالة محفوظة.
const PIN_KEY = 'hr_dom.sidebar.pinned'
const pinned = ref(localStorage.getItem(PIN_KEY) === '1')
const hovered = ref(false)
const expanded = computed(() => pinned.value || hovered.value)
// على الهاتف (< lg) الشريط درور منزلق؛ على الشاشات الكبيرة شريط أيقونات يتوسّع/يُثبَّت.
const mobileOpen = ref(false)
const showLabels = computed(() => expanded.value || mobileOpen.value)
function closeMobile(): void {
  mobileOpen.value = false
}
function togglePin(): void {
  pinned.value = !pinned.value
  localStorage.setItem(PIN_KEY, pinned.value ? '1' : '0')
  hovered.value = false
}
// عند خروج التركيز من الشريط بالكامل (لوحة المفاتيح) → أغلقه إن لم يكن مثبّتاً.
function onSidebarFocusOut(e: FocusEvent): void {
  const aside = e.currentTarget as HTMLElement
  if (!aside.contains(e.relatedTarget as Node | null)) hovered.value = false
}

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

// شعار التطبيق من public/app-icon.png مع رجوع لأيقونة الساعة إن غاب الملف.
const appIcon = '/app-icon-192.png'
const logoError = ref(false)

async function onLogout(): Promise<void> {
  await auth.logout()
  router.replace({ name: 'login' })
}
</script>

<template>
  <div class="flex min-h-svh bg-surface-50 text-surface-800 dark:bg-surface-950 dark:text-surface-100">
    <!-- حاجز يحجز عرض الشريط في التخطيط (شاشات كبيرة فقط؛ على الهاتف المحتوى بعرض كامل) -->
    <div class="hidden shrink-0 transition-[width] duration-200 md:block" :class="pinned ? 'w-64' : 'w-[4.75rem]'" aria-hidden="true" />

    <!-- ===== الشريط الجانبي: درور على الهاتف · شريط أيقونات يتوسّع/يُثبَّت على الشاشات الكبيرة ===== -->
    <aside
      class="fixed inset-y-0 start-0 z-40 flex h-svh w-64 flex-col border-e border-surface-200 bg-white transition-all duration-200 dark:border-surface-800 dark:bg-surface-900"
      :class="[
        expanded ? 'md:w-64' : 'md:w-[4.75rem]',
        !pinned && expanded ? 'md:shadow-2xl' : '',
        mobileOpen ? 'translate-x-0 shadow-2xl' : 'max-md:ltr:-translate-x-full max-md:rtl:translate-x-full',
      ]"
      @mouseenter="hovered = true"
      @mouseleave="hovered = false"
      @focusin="hovered = true"
      @focusout="onSidebarFocusOut"
    >
      <!-- الشعار -->
      <div class="flex h-16 items-center gap-3 border-b border-surface-200 px-3 dark:border-surface-800" :class="showLabels ? 'px-5' : 'justify-center'">
        <img v-if="!logoError" :src="appIcon" alt="" class="size-9 shrink-0 rounded-xl object-contain" @error="logoError = true" />
        <span v-else class="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-contrast">
          <i class="pi pi-clock text-lg" />
        </span>
        <span v-if="showLabels" class="truncate text-base font-bold tracking-tight">{{ t('app.title') }}</span>
      </div>

      <!-- روابط التنقّل (مصنّفة في أقسام) -->
      <nav class="flex-1 overflow-y-auto overflow-x-hidden p-2">
        <div v-for="(sec, idx) in navSections" :key="sec.key" class="space-y-1">
          <!-- عنوان القسم (موسّع) أو فاصل خفيف (مطويّ) -->
          <p
            v-if="showLabels && sec.key !== 'general'"
            class="px-3 pb-1 pt-4 text-[0.7rem] font-semibold uppercase tracking-wider text-surface-400 dark:text-surface-500"
          >
            {{ t(sec.label) }}
          </p>
          <div v-else-if="!showLabels && idx > 0" class="mx-3 my-2 border-t border-surface-200 dark:border-surface-800" />
          <RouterLink
            v-for="item in sec.items"
            :key="item.key"
            :to="item.to"
            v-tooltip="{ value: t(item.key), disabled: showLabels, showDelay: 120 }"
            class="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-surface-600 transition hover:bg-surface-100 hover:text-surface-900 dark:text-surface-300 dark:hover:bg-surface-800 dark:hover:text-white"
            active-class="!bg-primary-50 !text-primary-700 dark:!bg-primary-500/15 dark:!text-primary-300"
            :class="showLabels ? 'justify-start' : 'justify-center'"
            @click="closeMobile"
          >
            <i :class="item.icon" class="shrink-0 text-lg" />
            <span v-if="showLabels" class="truncate">{{ t(item.key) }}</span>
          </RouterLink>
        </div>
      </nav>

      <!-- زر التثبيت (شاشات كبيرة فقط — لا معنى له داخل درور الهاتف) -->
      <div class="hidden border-t border-surface-200 p-2 md:block dark:border-surface-800">
        <button
          type="button"
          v-tooltip="{ value: pinned ? t('layout.unpin') : t('layout.pin'), disabled: showLabels, showDelay: 120 }"
          class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition"
          :class="[
            showLabels ? 'justify-start' : 'justify-center',
            pinned
              ? 'bg-primary-50 text-primary-700 dark:bg-primary-500/15 dark:text-primary-300'
              : 'text-surface-500 hover:bg-surface-100 dark:text-surface-400 dark:hover:bg-surface-800',
          ]"
          @click="togglePin"
        >
          <i class="pi shrink-0 text-lg" :class="pinned ? 'pi-lock' : 'pi-lock-open'" />
          <span v-if="showLabels" class="truncate">{{ pinned ? t('layout.unpin') : t('layout.pin') }}</span>
        </button>
      </div>
    </aside>

    <!-- تعتيم خلف درور الهاتف -->
    <div
      v-if="mobileOpen"
      class="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm md:hidden"
      @click="closeMobile"
    />

    <!-- ===== العمود الرئيسي ===== -->
    <div class="flex min-w-0 flex-1 flex-col">
      <header
        class="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-surface-200 bg-white/80 px-4 backdrop-blur dark:border-surface-800 dark:bg-surface-900/80 lg:px-6"
      >
        <!-- زر فتح الدرور (الهاتف فقط) -->
        <button
          type="button"
          class="grid size-10 place-items-center rounded-xl text-surface-600 transition hover:bg-surface-100 md:hidden dark:text-surface-300 dark:hover:bg-surface-800"
          :aria-label="t('layout.menu')"
          @click="mobileOpen = true"
        >
          <i class="pi pi-bars text-lg" />
        </button>

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
