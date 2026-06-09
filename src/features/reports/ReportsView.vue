<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ApiException } from '@/api/client'
import { reportsApi, saveBlob, type ReportType, type ReportRow } from '@/api/reports'
import { usersApi, departmentsApi, type User, type Department } from '@/api/users'

const { t } = useI18n()

const type = ref<ReportType>('attendance')
const filters = reactive({ from: '', to: '', period: '', department_id: 0, user_id: 0 })

const users = ref<User[]>([])
const departments = ref<Department[]>([])

const loading = ref(false)
const exporting = ref('')
const error = ref('')
const loaded = ref(false)
const title = ref('')
const headings = ref<string[]>([])
const rows = ref<ReportRow[]>([])
const total = ref(0)

const reportTypes: { key: ReportType; label: string }[] = [
  { key: 'attendance', label: 'reports.attendance' },
  { key: 'late-absence', label: 'reports.lateAbsence' },
  { key: 'timesheet', label: 'reports.timesheet' },
]

// عناوين الأعمدة المعروفة (مع fallback للمفتاح الخام لأي عمود غير معرّف).
const colLabels: Record<string, string> = {
  user_id: 'reports.col.userId',
  employee_no: 'reports.col.employeeNo',
  name: 'reports.col.name',
  working_days: 'reports.col.workingDays',
  present_days: 'reports.col.presentDays',
  absent_days: 'reports.col.absentDays',
  leave_days: 'reports.col.leaveDays',
  late_days: 'reports.col.lateDays',
  late_minutes: 'reports.col.lateMinutes',
  date: 'reports.col.date',
  incident: 'reports.col.incident',
}
function colLabel(h: string): string {
  return colLabels[h] ? t(colLabels[h]) : h
}
function cell(row: ReportRow, h: string): string {
  const v = row[h]
  if (v === null || v === undefined) return '—'
  if (h === 'incident') return t(`reports.incident.${v}`, String(v))
  return String(v)
}

function messageFor(e: unknown, fallback: string): string {
  return e instanceof ApiException ? e.message : fallback
}

const requiresUser = computed(() => type.value === 'timesheet')
const canRun = computed(() => !requiresUser.value || filters.user_id > 0)

function buildFilters() {
  const f: Record<string, string | number> = {}
  if (filters.from) f.from = filters.from
  if (filters.to) f.to = filters.to
  if (filters.period) f.period = filters.period
  if (filters.department_id) f.department_id = filters.department_id
  if (filters.user_id) f.user_id = filters.user_id
  return f
}

async function run(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const res = await reportsApi.fetch(type.value, buildFilters())
    title.value = res.title
    headings.value = res.headings
    rows.value = res.rows
    total.value = res.pagination?.total ?? res.rows.length
    loaded.value = true
  } catch (e) {
    error.value = messageFor(e, t('common.loadError'))
  } finally {
    loading.value = false
  }
}

async function exportAs(format: 'excel' | 'pdf'): Promise<void> {
  exporting.value = format
  error.value = ''
  try {
    const blob = await reportsApi.download(type.value, buildFilters(), format)
    const ext = format === 'excel' ? 'xlsx' : 'pdf'
    saveBlob(blob, `${type.value}-report.${ext}`)
  } catch (e) {
    error.value = messageFor(e, t('reports.exportError'))
  } finally {
    exporting.value = ''
  }
}

onMounted(async () => {
  try {
    const [us, deps] = await Promise.all([usersApi.list({ per_page: 100 }), departmentsApi.list()])
    users.value = us.data
    departments.value = deps
  } catch {
    // الفلاتر اختيارية — تجاهل فشل تحميل القوائم.
  }
})
</script>

<template>
  <div class="mx-auto max-w-5xl">
    <h1 class="mb-6 text-2xl font-bold text-slate-900 dark:text-white">{{ t('reports.title') }}</h1>

    <!-- نوع التقرير -->
    <div class="mb-6 flex gap-1 border-b border-slate-200 dark:border-slate-800">
      <button
        v-for="rt in reportTypes"
        :key="rt.key"
        type="button"
        class="-mb-px border-b-2 px-4 py-2 text-sm font-medium transition"
        :class="type === rt.key ? 'border-indigo-600 text-indigo-700 dark:text-indigo-300' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'"
        @click="type = rt.key; loaded = false"
      >
        {{ t(rt.label) }}
      </button>
    </div>

    <!-- الفلاتر -->
    <div class="mb-6 grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 sm:grid-cols-2 lg:grid-cols-3 dark:border-slate-800 dark:bg-slate-900">
      <label class="block text-sm"><span class="lbl">{{ t('reports.from') }}</span><input v-model="filters.from" type="date" class="field" /></label>
      <label class="block text-sm"><span class="lbl">{{ t('reports.to') }}</span><input v-model="filters.to" type="date" class="field" /></label>
      <label class="block text-sm"><span class="lbl">{{ t('reports.period') }}</span><input v-model="filters.period" type="month" class="field" /></label>
      <label class="block text-sm"><span class="lbl">{{ t('reports.department') }}</span>
        <select v-model.number="filters.department_id" class="field">
          <option :value="0">{{ t('reports.allDepartments') }}</option>
          <option v-for="d in departments" :key="d.id" :value="d.id">{{ d.name }}</option>
        </select>
      </label>
      <label class="block text-sm">
        <span class="lbl">{{ t('reports.employee') }}<span v-if="requiresUser" class="text-rose-500"> *</span></span>
        <select v-model.number="filters.user_id" class="field">
          <option :value="0">{{ requiresUser ? t('reports.chooseEmployee') : t('reports.allEmployees') }}</option>
          <option v-for="u in users" :key="u.id" :value="u.id">{{ u.name }}</option>
        </select>
      </label>
    </div>

    <div class="mb-6 flex flex-wrap gap-3">
      <button type="button" class="btn-primary disabled:opacity-50" :disabled="loading || !canRun" @click="run">{{ loading ? t('common.loading') : t('reports.generate') }}</button>
      <button v-can="'reports.export'" type="button" class="btn-ghost-bordered disabled:opacity-50" :disabled="!!exporting || !canRun" @click="exportAs('excel')">{{ exporting === 'excel' ? t('common.loading') : t('reports.exportExcel') }}</button>
      <button v-can="'reports.export'" type="button" class="btn-ghost-bordered disabled:opacity-50" :disabled="!!exporting || !canRun" @click="exportAs('pdf')">{{ exporting === 'pdf' ? t('common.loading') : t('reports.exportPdf') }}</button>
    </div>

    <p v-if="requiresUser && !canRun" class="mb-4 text-sm text-amber-600 dark:text-amber-400">{{ t('reports.timesheetNeedsUser') }}</p>
    <p v-if="error" class="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300" role="alert">{{ error }}</p>

    <!-- النتائج -->
    <div v-if="loaded" class="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div class="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <h2 class="text-sm font-semibold text-slate-700 dark:text-slate-200">{{ title }}</h2>
        <span class="text-xs text-slate-500">{{ t('reports.rowsCount', { n: total }) }}</span>
      </div>
      <p v-if="!rows.length" class="p-6 text-sm text-slate-500">{{ t('reports.empty') }}</p>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-start text-sm">
          <thead class="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            <tr>
              <th v-for="h in headings" :key="h" class="px-4 py-3 text-start whitespace-nowrap">{{ colLabel(h) }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            <tr v-for="(row, i) in rows" :key="i">
              <td v-for="h in headings" :key="h" class="px-4 py-3 text-slate-600 whitespace-nowrap dark:text-slate-300">{{ cell(row, h) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.field {
  width: 100%;
  border-radius: 0.5rem;
  border: 1px solid rgb(203 213 225);
  background: #fff;
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  color: rgb(15 23 42);
  outline: none;
}
.field:focus {
  border-color: rgb(99 102 241);
  box-shadow: 0 0 0 2px rgb(99 102 241 / 0.3);
}
:global(.dark) .field {
  border-color: rgb(51 65 85);
  background: rgb(30 41 59);
  color: #fff;
}
.lbl {
  margin-bottom: 0.25rem;
  display: block;
  font-weight: 500;
  font-size: 0.875rem;
  color: rgb(51 65 85);
}
:global(.dark) .lbl {
  color: rgb(203 213 225);
}
.btn-primary {
  border-radius: 0.5rem;
  background: rgb(79 70 229);
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: #fff;
  transition: background 0.15s;
}
.btn-primary:hover {
  background: rgb(67 56 202);
}
.btn-ghost-bordered {
  border-radius: 0.5rem;
  border: 1px solid rgb(203 213 225);
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: rgb(71 85 105);
}
.btn-ghost-bordered:hover {
  background: rgb(248 250 252);
}
:global(.dark) .btn-ghost-bordered {
  border-color: rgb(51 65 85);
  color: rgb(203 213 225);
}
</style>
