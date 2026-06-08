<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import DonutChart from '@/components/charts/DonutChart.vue'
import BarChart from '@/components/charts/BarChart.vue'
import { usersApi, departmentsApi } from '@/api/users'
import { leavesApi } from '@/api/leaves'
import { devicesApi } from '@/api/devices'
import { reportsApi, type ReportRow } from '@/api/reports'
import { workSitesApi } from '@/api/worksites'
import { shiftsApi } from '@/api/schedule'
import { payrollApi } from '@/api/payroll'

const { t } = useI18n()
const auth = useAuthStore()

const loading = ref(true)
// الشهر الحالي بصيغة YYYY-MM (وقت المتصفّح).
const now = new Date()
const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

const stats = reactive({
  usersTotal: 0, usersActive: 0, usersSuspended: 0, usersLeft: 0,
  departments: 0, workSites: 0, shifts: 0,
  leavesPending: 0, leavesApproved: 0, leavesRejected: 0,
  devicePending: 0,
  attPresent: 0, attAbsent: 0, attLate: 0, attLeave: 0, attHasData: false,
  payrollCount: 0, payrollNet: 0, payrollCurrency: '',
})

const has = (p: string) => auth.can(p)

async function safe(fn: () => Promise<void>) {
  try { await fn() } catch { /* صلاحية ناقصة أو لا بيانات — تخطٍّ صامت */ }
}

async function loadUsers() {
  const { data } = await usersApi.list({ per_page: 100 })
  stats.usersTotal = data.length
  stats.usersActive = data.filter((u) => u.status === 'active').length
  stats.usersSuspended = data.filter((u) => u.status === 'suspended').length
  stats.usersLeft = data.filter((u) => u.status === 'left').length
}
async function loadDepartments() { stats.departments = (await departmentsApi.list()).length }
async function loadWorkSites() { stats.workSites = (await workSitesApi.list()).length }
async function loadShifts() { stats.shifts = (await shiftsApi.list()).length }
async function loadLeaves() {
  const { data } = await leavesApi.list()
  stats.leavesPending = data.filter((l) => l.status === 'pending').length
  stats.leavesApproved = data.filter((l) => l.status === 'approved').length
  stats.leavesRejected = data.filter((l) => l.status === 'rejected').length
}
async function loadDevices() { stats.devicePending = (await devicesApi.rebindRequests()).length }
async function loadAttendance() {
  const res = await reportsApi.fetch('attendance', { period })
  const sum = (k: string) => res.rows.reduce((a: number, r: ReportRow) => a + Number(r[k] ?? 0), 0)
  stats.attPresent = sum('present_days')
  stats.attAbsent = sum('absent_days')
  stats.attLate = sum('late_days')
  stats.attLeave = sum('leave_days')
  stats.attHasData = res.rows.length > 0
}
async function loadPayroll() {
  const rows = await payrollApi.list({ period })
  stats.payrollCount = rows.length
  stats.payrollNet = rows.reduce((a, p) => a + Number(p.net_salary), 0)
  stats.payrollCurrency = rows[0]?.currency?.code ?? ''
}

onMounted(async () => {
  const jobs: Promise<void>[] = []
  if (has('users.view')) { jobs.push(safe(loadUsers), safe(loadDepartments)) }
  if (has('work_sites.view')) jobs.push(safe(loadWorkSites))
  if (has('shifts.manage')) jobs.push(safe(loadShifts))
  if (has('leaves.view')) jobs.push(safe(loadLeaves))
  if (has('devices.rebind_approve')) jobs.push(safe(loadDevices))
  if (has('reports.view')) jobs.push(safe(loadAttendance))
  if (has('payroll.view')) jobs.push(safe(loadPayroll))
  await Promise.all(jobs)
  loading.value = false
})

const money = (v: number, cur: string) =>
  `${v.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}${cur ? ' ' + cur : ''}`

const kpis = computed(() => {
  const items: { key: string; value: number | string; icon: string; to?: string; accent?: boolean; show: boolean }[] = [
    { key: 'activeUsers', value: stats.usersActive, icon: '👥', to: 'users', show: has('users.view') },
    { key: 'departments', value: stats.departments, icon: '🏛️', show: has('users.view') },
    { key: 'workSites', value: stats.workSites, icon: '📍', to: 'work-sites', show: has('work_sites.view') },
    { key: 'shifts', value: stats.shifts, icon: '🗓️', to: 'schedule', show: has('shifts.manage') },
    { key: 'pendingLeaves', value: stats.leavesPending, icon: '🌴', to: 'leaves', accent: stats.leavesPending > 0, show: has('leaves.view') },
    { key: 'pendingDevices', value: stats.devicePending, icon: '📱', to: 'device-requests', accent: stats.devicePending > 0, show: has('devices.rebind_approve') },
  ]
  return items.filter((i) => i.show)
})

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
</script>

<template>
  <div class="mx-auto max-w-6xl">
    <header class="mb-6">
      <h1 class="text-2xl font-bold text-slate-900 dark:text-white">
        {{ t('home.welcome') }}<span v-if="auth.user">، {{ auth.user.name }}</span>
        <span v-if="auth.isSuperAdmin" class="ms-2 rounded-full bg-amber-100 px-2 py-0.5 align-middle text-xs font-medium text-amber-800 dark:bg-amber-900 dark:text-amber-200">{{ t('home.superAdmin') }}</span>
      </h1>
      <p class="mt-1 text-slate-500 dark:text-slate-400">{{ t('dashboard.subtitle', { period }) }}</p>
    </header>

    <p v-if="loading" class="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">{{ t('common.loading') }}</p>

    <template v-else>
      <!-- بطاقات المؤشّرات -->
      <div class="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <component
          :is="k.to ? RouterLink : 'div'"
          v-for="k in kpis"
          :key="k.key"
          :to="k.to ? { name: k.to } : undefined"
          class="rounded-2xl border bg-white p-4 transition dark:bg-slate-900"
          :class="k.accent ? 'border-amber-300 ring-1 ring-amber-200 dark:border-amber-700 dark:ring-amber-900' : 'border-slate-200 dark:border-slate-800'"
        >
          <div class="text-2xl">{{ k.icon }}</div>
          <div class="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{{ k.value }}</div>
          <div class="text-xs text-slate-500 dark:text-slate-400">{{ t('dashboard.kpi.' + k.key) }}</div>
        </component>
      </div>

      <!-- بحاجة إلى إجراء -->
      <div v-if="hasActions" class="mb-6 rounded-2xl border border-amber-200 bg-amber-50/60 p-5 dark:border-amber-900 dark:bg-amber-950/30">
        <h2 class="mb-3 text-sm font-semibold text-amber-800 dark:text-amber-200">⚠️ {{ t('dashboard.needsAction') }}</h2>
        <div class="flex flex-wrap gap-3">
          <RouterLink v-if="stats.leavesPending > 0" :to="{ name: 'leaves' }" class="rounded-lg bg-white px-4 py-2 text-sm font-medium text-amber-800 shadow-sm hover:bg-amber-100 dark:bg-slate-900 dark:text-amber-200">
            {{ t('dashboard.pendingLeavesAction', { n: stats.leavesPending }) }}
          </RouterLink>
          <RouterLink v-if="stats.devicePending > 0" :to="{ name: 'device-requests' }" class="rounded-lg bg-white px-4 py-2 text-sm font-medium text-amber-800 shadow-sm hover:bg-amber-100 dark:bg-slate-900 dark:text-amber-200">
            {{ t('dashboard.pendingDevicesAction', { n: stats.devicePending }) }}
          </RouterLink>
        </div>
      </div>

      <!-- الرسوم -->
      <div class="grid gap-6 lg:grid-cols-2">
        <section v-if="has('reports.view')" class="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <h2 class="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">{{ t('dashboard.attendanceTitle') }}</h2>
          <BarChart v-if="stats.attHasData" :bars="attendanceBars" :unit="t('dashboard.days')" />
          <p v-else class="text-sm text-slate-500">{{ t('dashboard.noData') }}</p>
        </section>

        <section v-if="has('leaves.view')" class="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <h2 class="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">{{ t('dashboard.leavesTitle') }}</h2>
          <DonutChart v-if="leavesHasData" :segments="leaveSegments" />
          <p v-else class="text-sm text-slate-500">{{ t('dashboard.noData') }}</p>
        </section>

        <section v-if="has('users.view')" class="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <h2 class="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">{{ t('dashboard.usersTitle') }}</h2>
          <DonutChart v-if="stats.usersTotal" :segments="userSegments" />
          <p v-else class="text-sm text-slate-500">{{ t('dashboard.noData') }}</p>
        </section>

        <section v-if="has('payroll.view')" class="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <h2 class="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-200">{{ t('dashboard.payrollTitle', { period }) }}</h2>
          <template v-if="stats.payrollCount > 0">
            <div class="text-3xl font-bold text-slate-900 dark:text-white" dir="ltr">{{ money(stats.payrollNet, stats.payrollCurrency) }}</div>
            <p class="mt-1 text-sm text-slate-500">{{ t('dashboard.payrollNet', { n: stats.payrollCount }) }}</p>
            <RouterLink :to="{ name: 'payroll' }" class="mt-3 inline-block text-sm text-indigo-600 hover:underline dark:text-indigo-400">{{ t('dashboard.viewPayroll') }} →</RouterLink>
          </template>
          <p v-else class="text-sm text-slate-500">{{ t('dashboard.noPayroll') }}</p>
        </section>
      </div>
    </template>
  </div>
</template>
