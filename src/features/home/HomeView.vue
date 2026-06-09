<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import DonutChart from '@/components/charts/DonutChart.vue'
import BarChart from '@/components/charts/BarChart.vue'
import { dashboardPrefs } from '@/api/dashboardPrefs'
import { usersApi, departmentsApi } from '@/api/users'
import { leavesApi } from '@/api/leaves'
import { devicesApi } from '@/api/devices'
import { reportsApi, type ReportRow } from '@/api/reports'
import { workSitesApi } from '@/api/worksites'
import { shiftsApi, holidaysApi } from '@/api/schedule'
import { payrollApi } from '@/api/payroll'

const { t } = useI18n()
const auth = useAuthStore()

const loading = ref(true)
const now = new Date()
const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
const today = `${period}-${String(now.getDate()).padStart(2, '0')}`

const palette = ['#6366f1', '#10b981', '#f59e0b', '#f43f5e', '#0ea5e9', '#a855f7', '#84cc16', '#ec4899']
const topLate = ref<{ label: string; value: number; color: string }[]>([])
const onLeaveToday = ref<string[]>([])
const upcomingHolidays = ref<{ date: string; name: string }[]>([])
const usersByDept = ref<{ label: string; value: number; color: string }[]>([])

const stats = reactive({
  usersTotal: 0, usersActive: 0, usersSuspended: 0, usersLeft: 0,
  departments: 0, workSites: 0, shifts: 0,
  leavesPending: 0, leavesApproved: 0, leavesRejected: 0,
  devicePending: 0,
  attPresent: 0, attAbsent: 0, attLate: 0, attLeave: 0, attHasData: false,
  payrollCount: 0, payrollNet: 0, payrollCurrency: '',
})

const has = (p: string | null) => p === null || auth.can(p)
async function safe(fn: () => Promise<void>) { try { await fn() } catch { /* صلاحية/بيانات ناقصة */ } }

async function loadUsers() {
  const { data } = await usersApi.list({ per_page: 100 })
  stats.usersTotal = data.length
  stats.usersActive = data.filter((u) => u.status === 'active').length
  stats.usersSuspended = data.filter((u) => u.status === 'suspended').length
  stats.usersLeft = data.filter((u) => u.status === 'left').length
  const byDept = new Map<string, number>()
  for (const u of data) {
    const name = u.department?.name ?? t('users.noDepartment')
    byDept.set(name, (byDept.get(name) ?? 0) + 1)
  }
  usersByDept.value = [...byDept.entries()].sort((a, b) => b[1] - a[1]).map(([label, value], i) => ({ label, value, color: palette[i % palette.length] }))
}
async function loadDepartments() { stats.departments = (await departmentsApi.list()).length }
async function loadWorkSites() { stats.workSites = (await workSitesApi.list()).length }
async function loadShifts() { stats.shifts = (await shiftsApi.list()).length }
async function loadLeaves() {
  const { data } = await leavesApi.list()
  stats.leavesPending = data.filter((l) => l.status === 'pending').length
  stats.leavesApproved = data.filter((l) => l.status === 'approved').length
  stats.leavesRejected = data.filter((l) => l.status === 'rejected').length
  onLeaveToday.value = data
    .filter((l) => l.status === 'approved' && l.start_at.slice(0, 10) <= today && l.end_at.slice(0, 10) >= today)
    .map((l) => l.user?.name ?? `#${l.user_id}`)
}
async function loadDevices() { stats.devicePending = (await devicesApi.rebindRequests()).length }
async function loadAttendance() {
  const res = await reportsApi.fetch('attendance', { period })
  const sum = (k: string) => res.rows.reduce((a: number, r: ReportRow) => a + Number(r[k] ?? 0), 0)
  stats.attPresent = sum('present_days'); stats.attAbsent = sum('absent_days')
  stats.attLate = sum('late_days'); stats.attLeave = sum('leave_days')
  stats.attHasData = res.rows.length > 0
  topLate.value = res.rows
    .map((r) => ({ label: String(r.name ?? r.employee_no ?? '—'), value: Number(r.late_days ?? 0), color: '#f59e0b' }))
    .filter((x) => x.value > 0).sort((a, b) => b.value - a.value).slice(0, 5)
}
async function loadPayroll() {
  const rows = await payrollApi.list({ period })
  stats.payrollCount = rows.length
  stats.payrollNet = rows.reduce((a, p) => a + Number(p.net_salary), 0)
  stats.payrollCurrency = rows[0]?.currency?.code ?? ''
}
async function loadHolidays() {
  const list = await holidaysApi.list()
  upcomingHolidays.value = list.map((h) => ({ date: h.date.slice(0, 10), name: h.name }))
    .filter((h) => h.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5)
}

const money = (v: number, cur: string) =>
  `${v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}${cur ? ' ' + cur : ''}`

const kpis = computed(() => [
  { key: 'activeUsers', value: stats.usersActive, icon: '👥', to: 'users', show: has('users.view') },
  { key: 'departments', value: stats.departments, icon: '🏛️', show: has('users.view') },
  { key: 'workSites', value: stats.workSites, icon: '📍', to: 'work-sites', show: has('work_sites.view') },
  { key: 'shifts', value: stats.shifts, icon: '🗓️', to: 'schedule', show: has('shifts.view') },
  { key: 'pendingLeaves', value: stats.leavesPending, icon: '🌴', to: 'leaves', accent: stats.leavesPending > 0, show: has('leaves.view') },
  { key: 'pendingDevices', value: stats.devicePending, icon: '📱', to: 'device-requests', accent: stats.devicePending > 0, show: has('devices.rebind_approve') },
].filter((i) => i.show))

const quickActions = computed(() => [
  { key: 'newUser', to: 'users', icon: '👤', perm: 'users.view' },
  { key: 'genPayroll', to: 'payroll', icon: '💰', perm: 'payroll.generate' },
  { key: 'reviewLeaves', to: 'leaves', icon: '🌴', perm: 'leaves.approve' },
  { key: 'addShift', to: 'schedule', icon: '🗓️', perm: 'shifts.view' },
  { key: 'reports', to: 'reports', icon: '📊', perm: 'reports.view' },
  { key: 'payrollRules', to: 'payroll-config', icon: '⚙️', perm: 'salary_rules.manage' },
].filter((a) => has(a.perm)))

const leaveSegments = computed(() => [
  { label: t('leaveStatus.pending'), value: stats.leavesPending, color: '#f59e0b' },
  { label: t('leaveStatus.approved'), value: stats.leavesApproved, color: '#10b981' },
  { label: t('leaveStatus.rejected'), value: stats.leavesRejected, color: '#f43f5e' },
])
const userSegments = computed(() => [
  { label: t('userStatus.active'), value: stats.usersActive, color: '#6366f1' },
  { label: t('userStatus.suspended'), value: stats.usersSuspended, color: '#f59e0b' },
  { label: t('userStatus.left'), value: stats.usersLeft, color: '#94a3b8' },
])
const attendanceBars = computed(() => [
  { label: t('dashboard.present'), value: stats.attPresent, color: '#10b981' },
  { label: t('dashboard.absent'), value: stats.attAbsent, color: '#f43f5e' },
  { label: t('dashboard.late'), value: stats.attLate, color: '#f59e0b' },
  { label: t('dashboard.onLeave'), value: stats.attLeave, color: '#6366f1' },
])
const hasActions = computed(() => stats.leavesPending > 0 || stats.devicePending > 0)
const leavesHasData = computed(() => stats.leavesPending + stats.leavesApproved + stats.leavesRejected > 0)

// ===== الودجتات القابلة للتخصيص =====
interface WidgetDef { id: string; titleKey: string; perm: string | null; full?: boolean }
const WIDGETS: WidgetDef[] = [
  { id: 'quickActions', titleKey: 'dashboard.w.quickActions', perm: null, full: true },
  { id: 'kpis', titleKey: 'dashboard.w.kpis', perm: null, full: true },
  { id: 'attendance', titleKey: 'dashboard.attendanceTitle', perm: 'reports.view' },
  { id: 'leavesStatus', titleKey: 'dashboard.leavesTitle', perm: 'leaves.view' },
  { id: 'usersStatus', titleKey: 'dashboard.usersTitle', perm: 'users.view' },
  { id: 'payroll', titleKey: 'dashboard.w.payroll', perm: 'payroll.view' },
  { id: 'topLate', titleKey: 'dashboard.topLateTitle', perm: 'reports.view' },
  { id: 'byDept', titleKey: 'dashboard.byDeptTitle', perm: 'users.view' },
  { id: 'onLeaveToday', titleKey: 'dashboard.onLeaveTodayTitle', perm: 'leaves.view' },
  { id: 'upcomingHolidays', titleKey: 'dashboard.upcomingHolidaysTitle', perm: 'holidays.view' },
]
const DEFAULT_LAYOUT = ['quickActions', 'kpis', 'attendance', 'leavesStatus']
const widgetById = (id: string) => WIDGETS.find((w) => w.id === id)

const layout = ref<string[]>([...DEFAULT_LAYOUT])
const editMode = ref(false)
const dragId = ref<string | null>(null)
const overId = ref<string | null>(null)

// الودجتات الظاهرة فعلاً (موجودة + مسموحة بالصلاحية).
const visibleLayout = computed(() => layout.value.filter((id) => { const w = widgetById(id); return w && has(w.perm) }))
// متاحة للإضافة (مسموحة + غير مضافة).
const availableToAdd = computed(() => WIDGETS.filter((w) => has(w.perm) && !layout.value.includes(w.id)))

const storageId = computed(() => auth.user?.id ?? 'anon')
function persist() { dashboardPrefs.save(storageId.value, { layout: layout.value }) }

function addWidget(id: string) { if (!layout.value.includes(id)) { layout.value.push(id); persist() } }
function removeWidget(id: string) { layout.value = layout.value.filter((x) => x !== id); persist() }
function resetLayout() { layout.value = [...DEFAULT_LAYOUT]; persist() }

function onDragStart(id: string) { dragId.value = id }
function onDragEnter(id: string) { if (dragId.value && dragId.value !== id) overId.value = id }
function onDrop(targetId: string) {
  const from = dragId.value
  overId.value = null
  if (!from || from === targetId) { dragId.value = null; return }
  const arr = [...layout.value]
  arr.splice(arr.indexOf(from), 1)
  arr.splice(arr.indexOf(targetId), 0, from)
  layout.value = arr
  dragId.value = null
  persist()
}

onMounted(async () => {
  const saved = dashboardPrefs.load(storageId.value)
  if (saved) layout.value = saved.layout
  const jobs: Promise<void>[] = []
  if (has('users.view')) jobs.push(safe(loadUsers), safe(loadDepartments))
  if (has('work_sites.view')) jobs.push(safe(loadWorkSites))
  if (has('shifts.view')) jobs.push(safe(loadShifts))
  if (has('holidays.view')) jobs.push(safe(loadHolidays))
  if (has('leaves.view')) jobs.push(safe(loadLeaves))
  if (has('devices.rebind_approve')) jobs.push(safe(loadDevices))
  if (has('reports.view')) jobs.push(safe(loadAttendance))
  if (has('payroll.view')) jobs.push(safe(loadPayroll))
  await Promise.all(jobs)
  loading.value = false
})

// أوقف وضع التحرير عند إفراغه (لا شيء لإضافته ولا حذفه ليس ضرورياً).
watch(editMode, (v) => { if (!v) overId.value = null })
</script>

<template>
  <div class="mx-auto max-w-6xl">
    <header class="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold text-slate-900 dark:text-white">
          {{ t('home.welcome') }}<span v-if="auth.user">، {{ auth.user.name }}</span>
          <span v-if="auth.isSuperAdmin" class="ms-2 rounded-full bg-amber-100 px-2 py-0.5 align-middle text-xs font-medium text-amber-800 dark:bg-amber-900 dark:text-amber-200">{{ t('home.superAdmin') }}</span>
        </h1>
        <p class="mt-1 text-slate-500 dark:text-slate-400">{{ t('dashboard.subtitle', { period }) }}</p>
      </div>
      <button
        type="button"
        class="rounded-lg border px-3 py-1.5 text-sm font-medium transition"
        :class="editMode ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'"
        @click="editMode = !editMode"
      >
        {{ editMode ? '✓ ' + t('dashboard.done') : '⚙ ' + t('dashboard.customize') }}
      </button>
    </header>

    <!-- شريط التخصيص -->
    <div v-if="editMode" class="mb-6 rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4 dark:border-indigo-900 dark:bg-indigo-950/30">
      <p class="mb-3 text-xs text-indigo-700 dark:text-indigo-300">💡 {{ t('dashboard.dragHint') }}</p>
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-sm font-medium text-slate-600 dark:text-slate-300">{{ t('dashboard.addWidget') }}:</span>
        <button
          v-for="w in availableToAdd"
          :key="w.id"
          type="button"
          class="rounded-lg border border-dashed border-indigo-300 px-3 py-1.5 text-sm text-indigo-700 transition hover:bg-indigo-100 dark:border-indigo-700 dark:text-indigo-300 dark:hover:bg-indigo-900"
          @click="addWidget(w.id)"
        >
          + {{ t(w.titleKey) }}
        </button>
        <span v-if="!availableToAdd.length" class="text-sm text-slate-400">{{ t('dashboard.allAdded') }}</span>
        <button type="button" class="ms-auto rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:underline" @click="resetLayout">↺ {{ t('dashboard.resetDefault') }}</button>
      </div>
    </div>

    <p v-if="loading" class="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">{{ t('common.loading') }}</p>

    <template v-else>
      <!-- تنبيه «بحاجة إلى إجراء» (ثابت أعلى اللوحة عند وجود معلّقات) -->
      <div v-if="hasActions" class="mb-6 rounded-2xl border border-amber-200 bg-amber-50/60 p-5 dark:border-amber-900 dark:bg-amber-950/30">
        <h2 class="mb-3 text-sm font-semibold text-amber-800 dark:text-amber-200">⚠️ {{ t('dashboard.needsAction') }}</h2>
        <div class="flex flex-wrap gap-3">
          <RouterLink v-if="stats.leavesPending > 0" :to="{ name: 'leaves' }" class="rounded-lg bg-white px-4 py-2 text-sm font-medium text-amber-800 shadow-sm hover:bg-amber-100 dark:bg-slate-900 dark:text-amber-200">{{ t('dashboard.pendingLeavesAction', { n: stats.leavesPending }) }}</RouterLink>
          <RouterLink v-if="stats.devicePending > 0" :to="{ name: 'device-requests' }" class="rounded-lg bg-white px-4 py-2 text-sm font-medium text-amber-800 shadow-sm hover:bg-amber-100 dark:bg-slate-900 dark:text-amber-200">{{ t('dashboard.pendingDevicesAction', { n: stats.devicePending }) }}</RouterLink>
        </div>
      </div>

      <p v-if="!visibleLayout.length" class="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">{{ t('dashboard.emptyLayout') }}</p>

      <!-- شبكة الودجتات القابلة للسحب -->
      <div class="grid gap-6 lg:grid-cols-2">
        <section
          v-for="id in visibleLayout"
          :key="id"
          :draggable="editMode"
          class="rounded-2xl border bg-white p-6 transition dark:bg-slate-900"
          :class="[
            widgetById(id)?.full ? 'lg:col-span-2' : '',
            editMode ? 'cursor-move border-indigo-200 dark:border-indigo-900' : 'border-slate-200 dark:border-slate-800',
            overId === id ? 'ring-2 ring-indigo-400' : '',
            dragId === id ? 'opacity-40' : '',
          ]"
          @dragstart="onDragStart(id)"
          @dragenter.prevent="onDragEnter(id)"
          @dragover.prevent
          @drop="onDrop(id)"
        >
          <div class="mb-4 flex items-center justify-between gap-2">
            <h2 class="text-sm font-semibold text-slate-700 dark:text-slate-200">
              <span v-if="editMode" class="me-1 cursor-grab text-slate-400">⠿</span>{{ t(widgetById(id)?.titleKey || '') }}
            </h2>
            <button v-if="editMode" type="button" class="rounded-md px-2 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950" :title="t('dashboard.removeWidget')" @click="removeWidget(id)">✕</button>
          </div>

          <!-- إجراءات سريعة -->
          <div v-if="id === 'quickActions'" class="flex flex-wrap gap-2">
            <RouterLink v-for="a in quickActions" :key="a.key" :to="{ name: a.to }" class="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 transition hover:border-indigo-300 hover:bg-indigo-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-indigo-700 dark:hover:bg-indigo-950">
              <span aria-hidden="true">{{ a.icon }}</span>{{ t('dashboard.qa.' + a.key) }}
            </RouterLink>
          </div>

          <!-- المؤشّرات -->
          <div v-else-if="id === 'kpis'" class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <component :is="k.to ? RouterLink : 'div'" v-for="k in kpis" :key="k.key" :to="k.to ? { name: k.to } : undefined"
              class="rounded-xl border p-4 transition dark:bg-slate-900"
              :class="k.accent ? 'border-amber-300 ring-1 ring-amber-200 dark:border-amber-700 dark:ring-amber-900' : 'border-slate-200 dark:border-slate-800'">
              <div class="text-2xl">{{ k.icon }}</div>
              <div class="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{{ k.value }}</div>
              <div class="text-xs text-slate-500 dark:text-slate-400">{{ t('dashboard.kpi.' + k.key) }}</div>
            </component>
          </div>

          <!-- حضور الشهر -->
          <template v-else-if="id === 'attendance'">
            <BarChart v-if="stats.attHasData" :bars="attendanceBars" :unit="t('dashboard.days')" />
            <p v-else class="text-sm text-slate-500">{{ t('dashboard.noData') }}</p>
          </template>

          <!-- الإجازات حسب الحالة -->
          <template v-else-if="id === 'leavesStatus'">
            <DonutChart v-if="leavesHasData" :segments="leaveSegments" />
            <p v-else class="text-sm text-slate-500">{{ t('dashboard.noData') }}</p>
          </template>

          <!-- الموظفون حسب الحالة -->
          <template v-else-if="id === 'usersStatus'">
            <DonutChart v-if="stats.usersTotal" :segments="userSegments" />
            <p v-else class="text-sm text-slate-500">{{ t('dashboard.noData') }}</p>
          </template>

          <!-- الرواتب -->
          <template v-else-if="id === 'payroll'">
            <template v-if="stats.payrollCount > 0">
              <div class="text-3xl font-bold text-slate-900 dark:text-white" dir="ltr">{{ money(stats.payrollNet, stats.payrollCurrency) }}</div>
              <p class="mt-1 text-sm text-slate-500">{{ t('dashboard.payrollNet', { n: stats.payrollCount }) }}</p>
              <RouterLink :to="{ name: 'payroll' }" class="mt-3 inline-block text-sm text-indigo-600 hover:underline dark:text-indigo-400">{{ t('dashboard.viewPayroll') }} →</RouterLink>
            </template>
            <p v-else class="text-sm text-slate-500">{{ t('dashboard.noPayroll') }}</p>
          </template>

          <!-- أعلى المتأخّرين -->
          <template v-else-if="id === 'topLate'">
            <BarChart v-if="topLate.length" :bars="topLate" :unit="t('dashboard.days')" />
            <p v-else class="text-sm text-slate-500">{{ t('dashboard.noLate') }}</p>
          </template>

          <!-- الموظفون حسب القسم -->
          <template v-else-if="id === 'byDept'">
            <BarChart v-if="usersByDept.length" :bars="usersByDept" />
            <p v-else class="text-sm text-slate-500">{{ t('dashboard.noData') }}</p>
          </template>

          <!-- في إجازة اليوم -->
          <template v-else-if="id === 'onLeaveToday'">
            <ul v-if="onLeaveToday.length" class="space-y-2">
              <li v-for="(n, i) in onLeaveToday" :key="i" class="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <span class="inline-flex size-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700 dark:bg-indigo-900 dark:text-indigo-200">{{ n.slice(0, 1) }}</span>{{ n }}
              </li>
            </ul>
            <p v-else class="text-sm text-slate-500">{{ t('dashboard.noOneOnLeave') }}</p>
          </template>

          <!-- العطل القادمة -->
          <template v-else-if="id === 'upcomingHolidays'">
            <ul v-if="upcomingHolidays.length" class="space-y-2">
              <li v-for="(h, i) in upcomingHolidays" :key="i" class="flex items-center justify-between gap-3 text-sm">
                <span class="text-slate-700 dark:text-slate-200">{{ h.name }}</span>
                <span class="font-mono text-xs text-slate-500" dir="ltr">{{ h.date }}</span>
              </li>
            </ul>
            <p v-else class="text-sm text-slate-500">{{ t('dashboard.noHolidays') }}</p>
          </template>
        </section>
      </div>
    </template>
  </div>
</template>
