<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterView, RouterLink, useRouter, useRoute, type RouteLocationRaw } from 'vue-router'
import { useI18n } from 'vue-i18n'
import Menu from 'primevue/menu'
import Avatar from 'primevue/avatar'
import Toast from 'primevue/toast'
import ConfirmDialog from 'primevue/confirmdialog'
import type { MenuItem } from 'primevue/menuitem'
import NotificationBell from '@/components/NotificationBell.vue'
import WhatsNewDialog from '@/components/WhatsNewDialog.vue'
import { releasesApi, releaseSeen, type ReleaseItem } from '@/api/releases'
import { compareVersions } from '@/utils/version'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { settingsTabs, allSettingsPermissions } from '@/features/settings/settingsTabs'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const ui = useUiStore()

// التنقّل: رابطان مفردان (لوحة/إعدادات) + مجموعات قابلة للطيّ — تقليلاً لازدحام القائمة.
interface NavLink {
  to: RouteLocationRaw
  name: string
  key: string
  icon: string
  permission?: string | string[]
}
interface NavGroup {
  key: string // مفتاح i18n لعنوان المجموعة
  icon: string
  children: NavLink[]
}

const dashboardLink: NavLink = { to: { name: 'dashboard' }, name: 'dashboard', key: 'nav.dashboard', icon: 'pi pi-th-large' }
const settingsLink: NavLink = { to: { name: 'settings' }, name: 'settings', key: 'nav.settings', icon: 'pi pi-cog', permission: allSettingsPermissions }

const navGroups: NavGroup[] = [
  {
    key: 'navGroup.self',
    icon: 'pi pi-user',
    children: [
      { to: { name: 'my-payslips' }, name: 'my-payslips', key: 'nav.myPayslips', icon: 'pi pi-receipt' },
      { to: { name: 'my-leaves' }, name: 'my-leaves', key: 'nav.myLeaves', icon: 'pi pi-sun' },
      { to: { name: 'my-attendance' }, name: 'my-attendance', key: 'nav.myAttendance', icon: 'pi pi-calendar-clock' },
    ],
  },
  {
    key: 'navGroup.attendance',
    icon: 'pi pi-calendar',
    children: [
      { to: { name: 'leaves' }, name: 'leaves', key: 'nav.leaves', icon: 'pi pi-sun', permission: 'leaves.view' },
      { to: { name: 'calendar' }, name: 'calendar', key: 'nav.calendar', icon: 'pi pi-calendar', permission: ['shifts.view', 'schedules.view', 'holidays.view', 'leaves.view'] },
      { to: { name: 'absences' }, name: 'absences', key: 'nav.absences', icon: 'pi pi-user-minus', permission: 'absences.view' },
      { to: { name: 'excuses' }, name: 'excuses', key: 'nav.excuses', icon: 'pi pi-clock', permission: 'excuses.view' },
      { to: { name: 'overtime' }, name: 'overtime', key: 'nav.overtime', icon: 'pi pi-stopwatch', permission: 'overtime.view' },
      { to: { name: 'shift-swaps' }, name: 'shift-swaps', key: 'nav.shiftSwaps', icon: 'pi pi-sync', permission: 'shift_swaps.view' },
      { to: { name: 'approval-delegations' }, name: 'approval-delegations', key: 'nav.delegations', icon: 'pi pi-users', permission: ['leaves.approve', 'excuses.approve', 'overtime.approve'] },
    ],
  },
  {
    key: 'navGroup.payroll',
    icon: 'pi pi-wallet',
    children: [
      { to: { name: 'payroll' }, name: 'payroll', key: 'nav.payroll', icon: 'pi pi-wallet', permission: 'payroll.view' },
      { to: { name: 'loans' }, name: 'loans', key: 'nav.loans', icon: 'pi pi-money-bill', permission: 'loans.view' },
    ],
  },
  {
    key: 'navGroup.people',
    icon: 'pi pi-id-card',
    children: [
      { to: { name: 'onboarding' }, name: 'onboarding', key: 'nav.onboarding', icon: 'pi pi-user-plus', permission: 'onboarding.manage' },
      { to: { name: 'employee-documents' }, name: 'employee-documents', key: 'nav.documents', icon: 'pi pi-folder', permission: 'documents.view' },
      { to: { name: 'official-documents' }, name: 'official-documents', key: 'nav.officialDocuments', icon: 'pi pi-id-card', permission: 'official_docs.generate' },
    ],
  },
  {
    key: 'navGroup.insights',
    icon: 'pi pi-chart-bar',
    children: [
      { to: { name: 'reports' }, name: 'reports', key: 'nav.reports', icon: 'pi pi-chart-bar', permission: 'reports.view' },
      { to: { name: 'leave-reports' }, name: 'leave-reports', key: 'nav.leaveReports', icon: 'pi pi-calendar-clock', permission: 'reports.view' },
      { to: { name: 'daily-attendance' }, name: 'daily-attendance', key: 'nav.dailyAttendance', icon: 'pi pi-calendar-times', permission: 'reports.view' },
      { to: { name: 'report-subscriptions' }, name: 'report-subscriptions', key: 'nav.reportSubscriptions', icon: 'pi pi-envelope', permission: 'reports.view' },
      { to: { name: 'alerts' }, name: 'alerts', key: 'nav.alerts', icon: 'pi pi-bell', permission: 'alerts.view' },
      { to: { name: 'tracking' }, name: 'tracking', key: 'nav.tracking', icon: 'pi pi-map-marker', permission: 'tracking.view' },
      { to: { name: 'tracking-map' }, name: 'tracking-map', key: 'nav.trackingMap', icon: 'pi pi-map', permission: 'tracking.view' },
    ],
  },
]

// قائمة مسطّحة لكل الروابط (لاشتقاق عنوان الصفحة).
const allLinks: NavLink[] = [dashboardLink, ...navGroups.flatMap((g) => g.children), settingsLink]

function canSee(item: { permission?: string | string[] }): boolean {
  return !item.permission || auth.canAny(typeof item.permission === 'string' ? [item.permission] : item.permission)
}

// المجموعات المرئية (الأبناء مفلترون بالصلاحيات؛ تُخفى المجموعة الفارغة — Super Admin يرى الكل).
const visibleGroups = computed(() =>
  navGroups
    .map((g) => ({ key: g.key, icon: g.icon, items: g.children.filter(canSee) }))
    .filter((g) => g.items.length > 0),
)

// طيّ المجموعات: مجموعة مفتوحة = مفتاحها في المجموعة؛ والحاوية للمسار النشط تُفتح تلقائياً.
const openGroups = ref<Set<string>>(new Set())
const activeGroupKey = computed<string | null>(
  () => navGroups.find((g) => g.children.some((c) => c.name === route.name))?.key ?? null,
)
watch(activeGroupKey, (k) => { if (k) openGroups.value = new Set(openGroups.value).add(k) }, { immediate: true })
function toggleGroup(key: string): void {
  const s = new Set(openGroups.value)
  if (s.has(key)) s.delete(key)
  else s.add(key)
  openGroups.value = s
}

// عنوان الصفحة الحالي (للترويسة) من اسم المسار.
const pageTitle = computed(() => {
  const match = allLinks.find((i) => i.name === route.name)
  if (match) return t(match.key)
  // أي مسار ضمن الإعدادات → «الإعدادات».
  const inSettings =
    route.name === 'settings' ||
    route.name === 'company-settings' ||
    settingsTabs.some((tab) => tab.name === route.name)
  if (inSettings) return t('nav.settings')
  if (route.name === 'forbidden') return t('errors.forbiddenTitle')
  return t('app.title')
})

// سلوك الشريط الجانبي:
// - افتراضياً مغلق (شريط أيقونات)، ينفتح عند التمرير/التركيز ويُغلق عند المغادرة.
// - زر «التثبيت» بالأسفل يجعله ثابتاً مفتوحاً (يلغي الانغلاق التلقائي). الحالة محفوظة.
const appVersion = __APP_VERSION__

// ===== «ما الجديد» (FE-55) — يستهلك BE-99 =====
// عرض تلقائي مرّة بعد كل تحديث + فتح يدوي. تتبّع «آخر مشاهَدة» عبر /me/preferences (seen_release.panel).
const whatsNewVisible = ref(false)
const whatsNewReleases = ref<ReleaseItem[]>([]) // ما يُعرض في النافذة حالياً
const hasUnseen = ref(false)
const latestVersion = ref<string | null>(null)
let applicableReleases: ReleaseItem[] = [] // المنشورة لهذه اللوحة بنسخة ≤ الحالية

async function initWhatsNew(): Promise<void> {
  try {
    const all = await releasesApi.list({ platform: 'panel' })
    // المنشورة لهذه المنصّة بنسخة ≤ النسخة الحالية فقط (لا نعرض ملاحظات نسخة لم تُنشَر بعد على اللوحة).
    applicableReleases = (all ?? []).filter((r) => r.is_published !== false && compareVersions(r.version, appVersion) <= 0)
    if (!applicableReleases.length) return
    latestVersion.value = applicableReleases.reduce((m, r) => (compareVersions(r.version, m) > 0 ? r.version : m), applicableReleases[0].version)
    const seen = (await releaseSeen.get()).panel
    const unseen = applicableReleases.filter((r) => !seen || compareVersions(r.version, seen) > 0)
    if (unseen.length) {
      hasUnseen.value = true
      whatsNewReleases.value = unseen
      whatsNewVisible.value = true // عرض تلقائي مرّة واحدة
    }
  } catch {
    // BE-99 غير منشور بعد (404) أو الشبكة — تدهور آمن: لا نافذة، الزر يبقى للفتح اليدوي.
  }
}

// فتح يدوي — يعرض كل المنشورة تاريخياً.
function openWhatsNew(): void {
  whatsNewReleases.value = applicableReleases
  whatsNewVisible.value = true
}

// عند الإغلاق: إن كان هناك غير مشاهَد، ثبّت «آخر مشاهَدة» = أحدث نسخة مطبَّقة فتختفي النقطة ولا تتكرّر النافذة.
function onWhatsNewToggle(v: boolean): void {
  whatsNewVisible.value = v
  if (!v && hasUnseen.value && latestVersion.value) {
    void releaseSeen.setPanel(latestVersion.value)
    hasUnseen.value = false
  }
}

onMounted(() => {
  void initWhatsNew()
})

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
    label: t('whatsNew.menuItem'),
    icon: 'pi pi-megaphone',
    command: () => openWhatsNew(),
  },
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

      <!-- روابط التنقّل: لوحة + مجموعات قابلة للطيّ + إعدادات -->
      <nav class="flex-1 space-y-1 overflow-y-auto overflow-x-hidden p-2">
        <!-- لوحة التحكم -->
        <RouterLink
          :to="dashboardLink.to"
          v-tooltip="{ value: t(dashboardLink.key), disabled: showLabels, showDelay: 120 }"
          class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-surface-600 transition hover:bg-surface-100 hover:text-surface-900 dark:text-surface-300 dark:hover:bg-surface-800 dark:hover:text-white"
          active-class="!bg-primary-50 !text-primary-700 dark:!bg-primary-500/15 dark:!text-primary-300"
          :class="showLabels ? 'justify-start' : 'justify-center'"
          @click="closeMobile"
        >
          <i :class="dashboardLink.icon" class="shrink-0 text-lg" />
          <span v-if="showLabels" class="truncate">{{ t(dashboardLink.key) }}</span>
        </RouterLink>

        <!-- المجموعات القابلة للطيّ -->
        <div v-for="g in visibleGroups" :key="g.key">
          <button
            type="button"
            v-tooltip="{ value: t(g.key), disabled: showLabels, showDelay: 120 }"
            class="relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition"
            :class="[
              showLabels ? 'justify-start' : 'justify-center',
              activeGroupKey === g.key
                ? 'text-primary-700 dark:text-primary-300'
                : 'text-surface-600 hover:bg-surface-100 hover:text-surface-900 dark:text-surface-300 dark:hover:bg-surface-800 dark:hover:text-white',
            ]"
            @click="toggleGroup(g.key)"
          >
            <i :class="g.icon" class="shrink-0 text-lg" />
            <span v-if="showLabels" class="flex-1 truncate text-start">{{ t(g.key) }}</span>
            <i
              v-if="showLabels"
              class="pi pi-angle-down shrink-0 text-xs transition-transform"
              :class="openGroups.has(g.key) ? 'rotate-180' : ''"
            />
            <!-- نقطة تشير لوجود تبويب نشط داخل المجموعة المطويّة (وضع الأيقونات) -->
            <span
              v-else-if="activeGroupKey === g.key"
              class="absolute end-1.5 size-1.5 rounded-full bg-primary"
              aria-hidden="true"
            />
          </button>
          <!-- أبناء المجموعة (تظهر عند توسّع الشريط وفتح المجموعة) -->
          <div v-if="showLabels && openGroups.has(g.key)" class="mt-0.5 space-y-0.5">
            <RouterLink
              v-for="item in g.items"
              :key="item.key"
              :to="item.to"
              class="flex items-center gap-3 rounded-xl py-2 pe-3 ps-9 text-sm font-medium text-surface-500 transition hover:bg-surface-100 hover:text-surface-900 dark:text-surface-400 dark:hover:bg-surface-800 dark:hover:text-white"
              active-class="!bg-primary-50 !text-primary-700 dark:!bg-primary-500/15 dark:!text-primary-300"
              @click="closeMobile"
            >
              <i :class="item.icon" class="shrink-0 text-base" />
              <span class="truncate">{{ t(item.key) }}</span>
            </RouterLink>
          </div>
        </div>

        <!-- الإعدادات -->
        <RouterLink
          v-if="canSee(settingsLink)"
          :to="settingsLink.to"
          v-tooltip="{ value: t(settingsLink.key), disabled: showLabels, showDelay: 120 }"
          class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-surface-600 transition hover:bg-surface-100 hover:text-surface-900 dark:text-surface-300 dark:hover:bg-surface-800 dark:hover:text-white"
          active-class="!bg-primary-50 !text-primary-700 dark:!bg-primary-500/15 dark:!text-primary-300"
          :class="showLabels ? 'justify-start' : 'justify-center'"
          @click="closeMobile"
        >
          <i :class="settingsLink.icon" class="shrink-0 text-lg" />
          <span v-if="showLabels" class="truncate">{{ t(settingsLink.key) }}</span>
        </RouterLink>
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

      <!-- رقم نسخة اللوحة -->
      <div v-if="showLabels" class="px-4 pb-3 pt-1 text-center text-[11px] text-surface-400 dark:text-surface-600" dir="ltr">
        v{{ appVersion }}
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
            class="relative grid size-10 place-items-center rounded-xl text-surface-600 transition hover:bg-surface-100 dark:text-surface-300 dark:hover:bg-surface-800"
            :title="t('whatsNew.menuItem')"
            :aria-label="t('whatsNew.menuItem')"
            @click="openWhatsNew"
          >
            <i class="pi pi-megaphone text-lg" />
            <span
              v-if="hasUnseen"
              class="absolute right-1.5 top-1.5 size-2 rounded-full bg-rose-500 ring-2 ring-white dark:ring-surface-900"
            ></span>
          </button>
          <NotificationBell />
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

    <!-- «ما الجديد» (FE-55) — عرض تلقائي بعد التحديث + فتح يدوي -->
    <WhatsNewDialog
      :visible="whatsNewVisible"
      :releases="whatsNewReleases"
      @update:visible="onWhatsNewToggle"
    />
  </div>
</template>
