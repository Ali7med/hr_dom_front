<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import InputText from 'primevue/inputtext'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import { useAuthStore } from '@/stores/auth'
import DonutChart from '@/components/charts/DonutChart.vue'
import BarChart from '@/components/charts/BarChart.vue'
import { dashboardPrefs } from '@/api/dashboardPrefs'
import { usersApi, departmentsApi } from '@/api/users'
import { leavesApi } from '@/api/leaves'
import { devicesApi, type RebindRequest } from '@/api/devices'
import { reportsApi, type ReportRow } from '@/api/reports'
import { workSitesApi } from '@/api/worksites'
import { shiftsApi, holidaysApi } from '@/api/schedule'
import { payrollApi } from '@/api/payroll'
import { dailyAttendanceApi } from '@/api/dailyAttendance'
import { overtimeApi } from '@/api/overtime'
import { shiftSwapsApi } from '@/api/shiftSwaps'
import { absencesApi, type Absence } from '@/api/absences'
import { notificationsApi, type NotificationItem, type NotificationSeverity } from '@/api/notifications'
import { trackingApi, type LivePosition } from '@/api/tracking'

const { t } = useI18n()
const auth = useAuthStore()

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

const has = (p: string | string[] | null) =>
  p === null || (Array.isArray(p) ? auth.canAny(p) : auth.can(p))

// ===== تحميل تدريجي لكل وجد (لا انتظار للكل) =====
// `loaded[key] === false` = المهمّة أُطلقت وتُحمّل؛ true = انتهت؛ undefined = لم تُطلَق (لا صلاحية).
const loaded = reactive<Record<string, boolean>>({})
function run(key: string, fn: () => Promise<void>) {
  loaded[key] = false
  fn().catch(() => { /* صلاحية/بيانات ناقصة */ }).finally(() => { loaded[key] = true })
}
// مهام البيانات التي يعتمدها كل وجد (لعرض مؤشّر تحميله وحده).
const WIDGET_JOBS: Record<string, string[]> = {
  quickActions: [],
  kpis: ['users', 'departments', 'worksites', 'shifts', 'leaves', 'devices'],
  dailyAttendance: ['daily'],
  pendingActions: ['pending'],
  attendance: ['attendance'],
  leavesStatus: ['leaves'],
  usersStatus: ['users'],
  payroll: ['payroll'],
  topLate: ['attendance'],
  byDept: ['users'],
  unresolvedAbsences: ['absences'],
  rebindRequests: ['devices'],
  liveTracking: ['live'],
  recentNotifications: ['notifications'],
  onLeaveToday: ['leaves'],
  upcomingHolidays: ['holidays'],
}
const widgetLoading = (id: string) => (WIDGET_JOBS[id] ?? []).some((k) => loaded[k] === false)

// ===== حالة وجدات FE-56 =====
const dailyToday = reactive({ present: 0, missingIn: 0, missingOut: 0, missingBoth: 0, onLeave: 0, netDeficiency: 0, hasData: false })
const pending = reactive({ leaves: 0, overtime: 0, shiftSwaps: 0 })
const absCount = ref(0)
const absRows = ref<Absence[]>([])
const rebindList = ref<RebindRequest[]>([])
const recentNotifs = ref<NotificationItem[]>([])
const livePositions = ref<LivePosition[]>([])

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
async function loadDevices() {
  rebindList.value = await devicesApi.rebindRequests()
  stats.devicePending = rebindList.value.length
}
// ===== تحميل وجدات FE-56 =====
async function loadDailyToday() {
  const { data, summary } = await dailyAttendanceApi.list({ date: today, per_page: 1 })
  const c = summary?.counts ?? {}
  dailyToday.present = c.present ?? 0
  dailyToday.missingIn = c.missing_check_in ?? 0
  dailyToday.missingOut = c.missing_check_out ?? 0
  dailyToday.missingBoth = c.missing_both ?? 0
  dailyToday.onLeave = c.on_leave ?? 0
  dailyToday.netDeficiency = summary?.total_net_deficiency_minutes ?? 0
  dailyToday.hasData = (summary?.total_rows ?? data.length) > 0
}
async function loadPending() {
  if (auth.can('leaves.approve')) {
    const r = await leavesApi.list({ status: 'pending', per_page: 100 })
    pending.leaves = r.pagination?.total ?? r.data.length
  }
  if (auth.can('overtime.approve')) {
    const r = await overtimeApi.list({ status: 'pending', per_page: 100 })
    pending.overtime = r.pagination?.total ?? r.data.length
  }
  if (auth.can('shift_swaps.approve')) {
    const r = await shiftSwapsApi.list({ status: 'pending', per_page: 100 })
    pending.shiftSwaps = r.pagination?.total ?? r.data.length
  }
}
async function loadUnresolvedAbsences() {
  const { data, pagination } = await absencesApi.list({ status: 'unresolved', per_page: 5 })
  absCount.value = pagination?.total ?? data.length
  absRows.value = data.slice(0, 5)
}
async function loadNotifications() {
  const feed = await notificationsApi.list({ per_page: 5 })
  recentNotifs.value = feed.items
}
async function loadLive() { livePositions.value = await trackingApi.listPositions() }
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

// ===== مشتقّات وجدات FE-56 =====
const dailyBars = computed(() => [
  { label: t('dashboard.dailyW.present'), value: dailyToday.present, color: '#10b981' },
  { label: t('dashboard.dailyW.missingIn'), value: dailyToday.missingIn, color: '#f59e0b' },
  { label: t('dashboard.dailyW.missingOut'), value: dailyToday.missingOut, color: '#0ea5e9' },
  { label: t('dashboard.dailyW.missingBoth'), value: dailyToday.missingBoth, color: '#f43f5e' },
  { label: t('dashboard.dailyW.onLeave'), value: dailyToday.onLeave, color: '#6366f1' },
])
const pendingRows = computed(() =>
  [
    { key: 'leaves', to: 'leaves', n: pending.leaves, show: auth.can('leaves.approve') },
    { key: 'overtime', to: 'overtime', n: pending.overtime, show: auth.can('overtime.approve') },
    { key: 'shiftSwaps', to: 'shift-swaps', n: pending.shiftSwaps, show: auth.can('shift_swaps.approve') },
  ].filter((r) => r.show),
)
const pendingTotal = computed(() => pendingRows.value.reduce((a, r) => a + r.n, 0))
const liveWithPoint = computed(() => livePositions.value.filter((p) => p.point).length)

const NOTIF_SEV: Record<NotificationSeverity, { icon: string; cls: string }> = {
  info: { icon: 'pi-info-circle', cls: 'text-sky-500' },
  success: { icon: 'pi-check-circle', cls: 'text-emerald-500' },
  warning: { icon: 'pi-exclamation-triangle', cls: 'text-amber-500' },
  error: { icon: 'pi-times-circle', cls: 'text-rose-500' },
}
const notifSev = (s: NotificationSeverity) => NOTIF_SEV[s] ?? NOTIF_SEV.info

// ===== الودجتات القابلة للتخصيص =====
interface WidgetDef { id: string; titleKey: string; perm: string | string[] | null; full?: boolean }
const WIDGETS: WidgetDef[] = [
  { id: 'quickActions', titleKey: 'dashboard.w.quickActions', perm: null, full: true },
  { id: 'kpis', titleKey: 'dashboard.w.kpis', perm: null, full: true },
  { id: 'dailyAttendance', titleKey: 'dashboard.w.dailyAttendance', perm: 'reports.view', full: true },
  { id: 'pendingActions', titleKey: 'dashboard.w.pendingActions', perm: ['leaves.approve', 'overtime.approve', 'shift_swaps.approve'] },
  { id: 'attendance', titleKey: 'dashboard.attendanceTitle', perm: 'reports.view' },
  { id: 'leavesStatus', titleKey: 'dashboard.leavesTitle', perm: 'leaves.view' },
  { id: 'usersStatus', titleKey: 'dashboard.usersTitle', perm: 'users.view' },
  { id: 'payroll', titleKey: 'dashboard.w.payroll', perm: 'payroll.view' },
  { id: 'topLate', titleKey: 'dashboard.topLateTitle', perm: 'reports.view' },
  { id: 'byDept', titleKey: 'dashboard.byDeptTitle', perm: 'users.view' },
  { id: 'unresolvedAbsences', titleKey: 'dashboard.w.unresolvedAbsences', perm: 'absences.view' },
  { id: 'rebindRequests', titleKey: 'dashboard.w.rebindRequests', perm: 'devices.rebind_approve' },
  { id: 'liveTracking', titleKey: 'dashboard.w.liveTracking', perm: 'tracking.view' },
  { id: 'recentNotifications', titleKey: 'dashboard.w.recentNotifications', perm: null },
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
// بحث في منتقي الوجدات (يفلتر بعنوان الوجد المترجَم).
const widgetSearch = ref('')
const filteredAvailableToAdd = computed(() => {
  const q = widgetSearch.value.trim().toLowerCase()
  if (!q) return availableToAdd.value
  return availableToAdd.value.filter((w) => t(w.titleKey).toLowerCase().includes(q))
})

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

onMounted(() => {
  // اللوحة تُرسَم فوراً من الكاش المحلّي؛ كل وجد يحمّل بياناته مستقلّاً (لا انتظار للكل).
  const local = dashboardPrefs.loadLocal(storageId.value)
  if (local) layout.value = local.layout
  dashboardPrefs
    .loadRemote()
    .then((remote) => { if (remote) { layout.value = remote.layout; dashboardPrefs.cache(storageId.value, remote) } })
    .catch(() => { /* غير متصل — نعتمد الكاش */ })
  // إطلاق مهام البيانات بالتوازي دون حجب العرض؛ كلٌّ يُحدّث وجده عند وصوله.
  if (has('users.view')) { run('users', loadUsers); run('departments', loadDepartments) }
  if (has('work_sites.view')) run('worksites', loadWorkSites)
  if (has('shifts.view')) run('shifts', loadShifts)
  if (has('holidays.view')) run('holidays', loadHolidays)
  if (has('leaves.view')) run('leaves', loadLeaves)
  if (has('devices.rebind_approve')) run('devices', loadDevices)
  if (has('reports.view')) { run('attendance', loadAttendance); run('daily', loadDailyToday) }
  if (has('payroll.view')) run('payroll', loadPayroll)
  if (has(['leaves.approve', 'overtime.approve', 'shift_swaps.approve'])) run('pending', loadPending)
  if (has('absences.view')) run('absences', loadUnresolvedAbsences)
  if (has('tracking.view')) run('live', loadLive)
  run('notifications', loadNotifications) // بلا صلاحية — لكل مستخدم مُصادَق
})

// أوقف وضع التحرير عند إفراغه (لا شيء لإضافته ولا حذفه ليس ضرورياً).
watch(editMode, (v) => { if (!v) overId.value = null })
</script>

<template>
  <div class="mx-auto max-w-6xl">
    <header class="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold text-surface-900 dark:text-white">
          {{ t('home.welcome') }}<span v-if="auth.user">، {{ auth.user.name }}</span>
          <Tag v-if="auth.isSuperAdmin" severity="warn" :value="t('home.superAdmin')" class="ms-2 align-middle" />
        </h1>
        <p class="mt-1 text-surface-500 dark:text-surface-400">{{ t('dashboard.subtitle', { period }) }}</p>
      </div>
      <Button
        :label="editMode ? t('dashboard.done') : t('dashboard.customize')"
        :icon="editMode ? 'pi pi-check' : 'pi pi-cog'"
        :severity="editMode ? 'primary' : 'secondary'"
        :outlined="!editMode"
        @click="editMode = !editMode"
      />
    </header>

    <!-- شريط التخصيص -->
    <div v-if="editMode" class="mb-6 rounded-2xl border border-primary-200 bg-primary-50/50 p-4 dark:border-primary-900 dark:bg-primary-950/30">
      <p class="mb-3 text-xs text-primary-700 dark:text-primary-300">💡 {{ t('dashboard.dragHint') }}</p>
      <div v-if="availableToAdd.length" class="mb-3">
        <IconField>
          <InputIcon class="pi pi-search" />
          <InputText v-model="widgetSearch" :placeholder="t('dashboard.searchWidgets')" class="w-full sm:w-72" />
        </IconField>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-sm font-medium text-surface-600 dark:text-surface-300">{{ t('dashboard.addWidget') }}:</span>
        <Button
          v-for="w in filteredAvailableToAdd"
          :key="w.id"
          type="button"
          size="small"
          severity="secondary"
          outlined
          icon="pi pi-plus"
          :label="t(w.titleKey)"
          @click="addWidget(w.id)"
        />
        <span v-if="!availableToAdd.length" class="text-sm text-surface-400">{{ t('dashboard.allAdded') }}</span>
        <span v-else-if="!filteredAvailableToAdd.length" class="text-sm text-surface-400">{{ t('dashboard.noWidgetMatch') }}</span>
        <Button type="button" class="ms-auto" size="small" severity="secondary" text icon="pi pi-replay" :label="t('dashboard.resetDefault')" @click="resetLayout" />
      </div>
    </div>

      <!-- تنبيه «بحاجة إلى إجراء» (ثابت أعلى اللوحة عند وجود معلّقات) -->
      <div v-if="hasActions" class="mb-6 rounded-2xl border border-amber-200 bg-amber-50/60 p-5 dark:border-amber-900 dark:bg-amber-950/30">
        <h2 class="mb-3 text-sm font-semibold text-amber-800 dark:text-amber-200">⚠️ {{ t('dashboard.needsAction') }}</h2>
        <div class="flex flex-wrap gap-3">
          <RouterLink v-if="stats.leavesPending > 0" :to="{ name: 'leaves' }" class="rounded-lg bg-white px-4 py-2 text-sm font-medium text-amber-800 shadow-sm hover:bg-amber-100 dark:bg-slate-900 dark:text-amber-200">{{ t('dashboard.pendingLeavesAction', { n: stats.leavesPending }) }}</RouterLink>
          <RouterLink v-if="stats.devicePending > 0" :to="{ name: 'device-requests' }" class="rounded-lg bg-white px-4 py-2 text-sm font-medium text-amber-800 shadow-sm hover:bg-amber-100 dark:bg-slate-900 dark:text-amber-200">{{ t('dashboard.pendingDevicesAction', { n: stats.devicePending }) }}</RouterLink>
        </div>
      </div>

      <p v-if="!visibleLayout.length" class="rounded-2xl border border-dashed border-surface-300 p-8 text-center text-sm text-surface-500 dark:border-surface-700">{{ t('dashboard.emptyLayout') }}</p>

      <!-- شبكة الودجتات القابلة للسحب -->
      <div class="grid gap-6 lg:grid-cols-2">
        <section
          v-for="id in visibleLayout"
          :key="id"
          :draggable="editMode"
          class="rounded-2xl border bg-white p-6 transition dark:bg-surface-900"
          :class="[
            widgetById(id)?.full ? 'lg:col-span-2' : '',
            editMode ? 'cursor-move border-primary-200 dark:border-primary-900' : 'border-surface-200 dark:border-surface-800',
            overId === id ? 'ring-2 ring-primary-400' : '',
            dragId === id ? 'opacity-40' : '',
          ]"
          @dragstart="onDragStart(id)"
          @dragenter.prevent="onDragEnter(id)"
          @dragover.prevent
          @drop="onDrop(id)"
        >
          <div class="mb-4 flex items-center justify-between gap-2">
            <h2 class="text-sm font-semibold text-surface-700 dark:text-surface-200">
              <span v-if="editMode" class="me-1 cursor-grab text-surface-400">⠿</span>{{ t(widgetById(id)?.titleKey || '') }}
            </h2>
            <Button v-if="editMode" type="button" icon="pi pi-times" severity="danger" text rounded size="small" :title="t('dashboard.removeWidget')" @click="removeWidget(id)" />
          </div>

          <!-- مؤشّر تحميل خاص بالوجد (لا يحجب بقية اللوحة) -->
          <div v-if="widgetLoading(id)" class="flex items-center justify-center py-10 text-surface-300 dark:text-surface-600">
            <i class="pi pi-spin pi-spinner text-2xl" />
          </div>
          <template v-else>
          <!-- إجراءات سريعة -->
          <div v-if="id === 'quickActions'" class="flex flex-wrap gap-2">
            <RouterLink v-for="a in quickActions" :key="a.key" :to="{ name: a.to }" class="inline-flex items-center gap-2 rounded-lg border border-surface-200 bg-white px-3.5 py-2 text-sm font-medium text-surface-700 transition hover:border-primary-300 hover:bg-primary-50 dark:border-surface-800 dark:bg-surface-900 dark:text-surface-200 dark:hover:border-primary-700 dark:hover:bg-primary-950">
              <span aria-hidden="true">{{ a.icon }}</span>{{ t('dashboard.qa.' + a.key) }}
            </RouterLink>
          </div>

          <!-- المؤشّرات -->
          <div v-else-if="id === 'kpis'" class="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            <component :is="k.to ? RouterLink : 'div'" v-for="k in kpis" :key="k.key" :to="k.to ? { name: k.to } : undefined"
              class="rounded-xl border p-4 transition dark:bg-surface-900"
              :class="k.accent ? 'border-amber-300 ring-1 ring-amber-200 dark:border-amber-700 dark:ring-amber-900' : 'border-surface-200 dark:border-surface-800'">
              <div class="text-2xl">{{ k.icon }}</div>
              <div class="mt-1 text-2xl font-bold text-surface-900 dark:text-white">{{ k.value }}</div>
              <div class="text-xs text-surface-500 dark:text-surface-400">{{ t('dashboard.kpi.' + k.key) }}</div>
            </component>
          </div>

          <!-- حضور الشهر -->
          <template v-else-if="id === 'attendance'">
            <BarChart v-if="stats.attHasData" :bars="attendanceBars" :unit="t('dashboard.days')" />
            <p v-else class="text-sm text-surface-500">{{ t('dashboard.noData') }}</p>
          </template>

          <!-- الإجازات حسب الحالة -->
          <template v-else-if="id === 'leavesStatus'">
            <DonutChart v-if="leavesHasData" :segments="leaveSegments" />
            <p v-else class="text-sm text-surface-500">{{ t('dashboard.noData') }}</p>
          </template>

          <!-- الموظفون حسب الحالة -->
          <template v-else-if="id === 'usersStatus'">
            <DonutChart v-if="stats.usersTotal" :segments="userSegments" />
            <p v-else class="text-sm text-surface-500">{{ t('dashboard.noData') }}</p>
          </template>

          <!-- الرواتب -->
          <template v-else-if="id === 'payroll'">
            <template v-if="stats.payrollCount > 0">
              <div class="text-3xl font-bold text-surface-900 dark:text-white" dir="ltr">{{ money(stats.payrollNet, stats.payrollCurrency) }}</div>
              <p class="mt-1 text-sm text-surface-500">{{ t('dashboard.payrollNet', { n: stats.payrollCount }) }}</p>
              <RouterLink :to="{ name: 'payroll' }" class="mt-3 inline-block text-sm text-primary-600 hover:underline dark:text-primary-400">{{ t('dashboard.viewPayroll') }} →</RouterLink>
            </template>
            <p v-else class="text-sm text-surface-500">{{ t('dashboard.noPayroll') }}</p>
          </template>

          <!-- أعلى المتأخّرين -->
          <template v-else-if="id === 'topLate'">
            <BarChart v-if="topLate.length" :bars="topLate" :unit="t('dashboard.days')" />
            <p v-else class="text-sm text-surface-500">{{ t('dashboard.noLate') }}</p>
          </template>

          <!-- الموظفون حسب القسم -->
          <template v-else-if="id === 'byDept'">
            <BarChart v-if="usersByDept.length" :bars="usersByDept" />
            <p v-else class="text-sm text-surface-500">{{ t('dashboard.noData') }}</p>
          </template>

          <!-- في إجازة اليوم -->
          <template v-else-if="id === 'onLeaveToday'">
            <ul v-if="onLeaveToday.length" class="space-y-2">
              <li v-for="(n, i) in onLeaveToday" :key="i" class="flex items-center gap-2 text-sm text-surface-700 dark:text-surface-200">
                <span class="inline-flex size-7 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700 dark:bg-primary-900 dark:text-primary-200">{{ n.slice(0, 1) }}</span>{{ n }}
              </li>
            </ul>
            <p v-else class="text-sm text-surface-500">{{ t('dashboard.noOneOnLeave') }}</p>
          </template>

          <!-- العطل القادمة -->
          <template v-else-if="id === 'upcomingHolidays'">
            <ul v-if="upcomingHolidays.length" class="space-y-2">
              <li v-for="(h, i) in upcomingHolidays" :key="i" class="flex items-center justify-between gap-3 text-sm">
                <span class="text-surface-700 dark:text-surface-200">{{ h.name }}</span>
                <span class="font-mono text-xs text-surface-500" dir="ltr">{{ h.date }}</span>
              </li>
            </ul>
            <p v-else class="text-sm text-surface-500">{{ t('dashboard.noHolidays') }}</p>
          </template>

          <!-- التقرير اليومي للحضور/الانصراف (اليوم) -->
          <template v-else-if="id === 'dailyAttendance'">
            <template v-if="dailyToday.hasData">
              <BarChart :bars="dailyBars" />
              <div class="mt-4 flex items-center justify-between gap-3 border-t border-surface-100 pt-3 dark:border-surface-800">
                <span class="text-sm text-surface-500">{{ t('dashboard.dailyW.netDeficiency', { n: dailyToday.netDeficiency }) }}</span>
                <RouterLink :to="{ name: 'daily-attendance' }" class="text-sm text-primary-600 hover:underline dark:text-primary-400">{{ t('dashboard.viewDetails') }} →</RouterLink>
              </div>
            </template>
            <p v-else class="text-sm text-surface-500">{{ t('dashboard.noData') }}</p>
          </template>

          <!-- طلبات تنتظر إجرائي -->
          <template v-else-if="id === 'pendingActions'">
            <ul v-if="pendingTotal > 0" class="space-y-2">
              <RouterLink
                v-for="r in pendingRows"
                :key="r.key"
                :to="{ name: r.to }"
                v-show="r.n > 0"
                class="flex items-center justify-between gap-3 rounded-lg border border-surface-200 px-3 py-2 text-sm transition hover:border-primary-300 hover:bg-primary-50 dark:border-surface-800 dark:hover:border-primary-700 dark:hover:bg-primary-950"
              >
                <span class="text-surface-700 dark:text-surface-200">{{ t('dashboard.pendingW.' + r.key) }}</span>
                <Tag :value="String(r.n)" severity="warn" />
              </RouterLink>
            </ul>
            <p v-else class="text-sm text-surface-500">{{ t('dashboard.pendingW.none') }}</p>
          </template>

          <!-- الغيابات غير المحلولة -->
          <template v-else-if="id === 'unresolvedAbsences'">
            <template v-if="absCount > 0">
              <div class="mb-3 text-3xl font-bold text-surface-900 dark:text-white">{{ absCount }}</div>
              <ul class="space-y-2">
                <li v-for="a in absRows" :key="a.id" class="flex items-center justify-between gap-3 text-sm">
                  <span class="text-surface-700 dark:text-surface-200">{{ a.user?.name ?? '#' + a.user_id }}</span>
                  <span class="font-mono text-xs text-surface-500" dir="ltr">{{ a.date.slice(0, 10) }}</span>
                </li>
              </ul>
              <RouterLink :to="{ name: 'absences' }" class="mt-3 inline-block text-sm text-primary-600 hover:underline dark:text-primary-400">{{ t('dashboard.viewDetails') }} →</RouterLink>
            </template>
            <p v-else class="text-sm text-surface-500">{{ t('dashboard.absW.none') }}</p>
          </template>

          <!-- طلبات ربط الأجهزة المعلّقة -->
          <template v-else-if="id === 'rebindRequests'">
            <template v-if="rebindList.length">
              <ul class="space-y-2">
                <li v-for="d in rebindList.slice(0, 6)" :key="d.id" class="flex items-center justify-between gap-3 text-sm">
                  <span class="text-surface-700 dark:text-surface-200">{{ d.user?.name ?? '#' + d.user_id }}</span>
                  <span class="font-mono text-[11px] text-surface-400" dir="ltr">{{ d.new_device_uid.slice(0, 10) }}…</span>
                </li>
              </ul>
              <RouterLink :to="{ name: 'device-requests' }" class="mt-3 inline-block text-sm text-primary-600 hover:underline dark:text-primary-400">{{ t('dashboard.viewDetails') }} →</RouterLink>
            </template>
            <p v-else class="text-sm text-surface-500">{{ t('dashboard.rebindW.none') }}</p>
          </template>

          <!-- التتبّع المباشر -->
          <template v-else-if="id === 'liveTracking'">
            <template v-if="livePositions.length">
              <div class="text-3xl font-bold text-surface-900 dark:text-white">{{ livePositions.length }}</div>
              <p class="mt-1 text-sm text-surface-500">{{ t('dashboard.liveW.summary', { seen: liveWithPoint }) }}</p>
              <RouterLink :to="{ name: 'tracking' }" class="mt-3 inline-block text-sm text-primary-600 hover:underline dark:text-primary-400">{{ t('dashboard.viewDetails') }} →</RouterLink>
            </template>
            <p v-else class="text-sm text-surface-500">{{ t('dashboard.liveW.none') }}</p>
          </template>

          <!-- آخر الإشعارات -->
          <template v-else-if="id === 'recentNotifications'">
            <ul v-if="recentNotifs.length" class="space-y-2">
              <component
                :is="n.link ? RouterLink : 'div'"
                v-for="n in recentNotifs"
                :key="n.id"
                :to="n.link || undefined"
                class="flex items-start gap-2.5 rounded-lg px-2 py-1.5 text-sm"
                :class="n.link ? 'transition hover:bg-surface-50 dark:hover:bg-surface-800' : ''"
              >
                <i class="pi mt-0.5 shrink-0 text-sm" :class="[notifSev(n.severity).icon, notifSev(n.severity).cls]" />
                <span class="min-w-0 flex-1 truncate text-surface-700 dark:text-surface-200">{{ n.title }}</span>
              </component>
            </ul>
            <p v-else class="text-sm text-surface-500">{{ t('dashboard.notifW.none') }}</p>
          </template>
          </template>
        </section>
      </div>
  </div>
</template>
