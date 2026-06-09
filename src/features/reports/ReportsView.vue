<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import { ApiException } from '@/api/client'
import { reportsApi, saveBlob, type ReportType, type ReportRow } from '@/api/reports'
import { usersApi, departmentsApi, type User, type Department } from '@/api/users'
import PageHeader from '@/components/PageHeader.vue'

const { t } = useI18n()
const toast = useToast()

const type = ref<ReportType>('attendance')
const filters = reactive({ from: '', to: '', period: '', department_id: 0, user_id: 0 })

const users = ref<User[]>([])
const departments = ref<Department[]>([])

const loading = ref(false)
const exporting = ref('')
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
function notifyError(e: unknown, fallback: string): void {
  toast.add({ severity: 'error', summary: t('common.error'), detail: messageFor(e, fallback), life: 4000 })
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
  try {
    const res = await reportsApi.fetch(type.value, buildFilters())
    title.value = res.title
    headings.value = res.headings
    rows.value = res.rows
    total.value = res.pagination?.total ?? res.rows.length
    loaded.value = true
  } catch (e) {
    notifyError(e, t('common.loadError'))
  } finally {
    loading.value = false
  }
}

async function exportAs(format: 'excel' | 'pdf'): Promise<void> {
  exporting.value = format
  try {
    const blob = await reportsApi.download(type.value, buildFilters(), format)
    const ext = format === 'excel' ? 'xlsx' : 'pdf'
    saveBlob(blob, `${type.value}-report.${ext}`)
  } catch (e) {
    notifyError(e, t('reports.exportError'))
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
    <PageHeader :title="t('reports.title')">
      <template #actions>
        <Button
          v-can="'reports.export'"
          outlined
          icon="pi pi-file-excel"
          :label="exporting === 'excel' ? t('common.loading') : t('reports.exportExcel')"
          :disabled="!!exporting || !canRun"
          @click="exportAs('excel')"
        />
        <Button
          v-can="'reports.export'"
          outlined
          icon="pi pi-file-pdf"
          :label="exporting === 'pdf' ? t('common.loading') : t('reports.exportPdf')"
          :disabled="!!exporting || !canRun"
          @click="exportAs('pdf')"
        />
      </template>
    </PageHeader>

    <!-- نوع التقرير -->
    <div class="mb-6">
      <SelectButton
        v-model="type"
        :options="reportTypes"
        option-value="key"
        data-key="key"
        :allow-empty="false"
        @update:model-value="loaded = false"
      >
        <template #option="{ option }">{{ t(option.label) }}</template>
      </SelectButton>
    </div>

    <!-- الفلاتر -->
    <div class="mb-6 rounded-2xl border border-surface-200 bg-white p-4 dark:border-surface-800 dark:bg-surface-900">
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('reports.from') }}</span>
          <input v-model="filters.from" type="date" class="field" />
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('reports.to') }}</span>
          <input v-model="filters.to" type="date" class="field" />
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('reports.period') }}</span>
          <input v-model="filters.period" type="month" class="field" />
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('reports.department') }}</span>
          <Select
            v-model.number="filters.department_id"
            :options="[{ id: 0, name: t('reports.allDepartments') }, ...departments]"
            option-label="name"
            option-value="id"
            fluid
          />
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">
            {{ t('reports.employee') }}<span v-if="requiresUser" class="text-red-500"> *</span>
          </span>
          <Select
            v-model.number="filters.user_id"
            :options="[{ id: 0, name: requiresUser ? t('reports.chooseEmployee') : t('reports.allEmployees') }, ...users]"
            option-label="name"
            option-value="id"
            fluid
          />
        </label>
      </div>

      <div class="mt-4 flex flex-wrap gap-3">
        <Button
          icon="pi pi-search"
          :label="loading ? t('common.loading') : t('reports.generate')"
          :loading="loading"
          :disabled="loading || !canRun"
          @click="run"
        />
      </div>
    </div>

    <p v-if="requiresUser && !canRun" class="mb-4 text-sm text-amber-600 dark:text-amber-400">{{ t('reports.timesheetNeedsUser') }}</p>

    <!-- النتائج -->
    <div v-if="loaded" class="overflow-hidden rounded-2xl border border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
      <div class="flex items-center justify-between border-b border-surface-100 px-4 py-3 dark:border-surface-800">
        <h2 class="text-sm font-semibold text-surface-700 dark:text-surface-200">{{ title }}</h2>
        <span class="text-xs text-surface-500">{{ t('reports.rowsCount', { n: total }) }}</span>
      </div>
      <DataTable
        :value="rows"
        paginator
        :rows="15"
        :rows-per-page-options="[15, 30, 50]"
        striped-rows
        removable-sort
      >
        <template #empty>
          <p class="py-6 text-center text-sm text-surface-500">{{ t('reports.empty') }}</p>
        </template>
        <Column
          v-for="h in headings"
          :key="h"
          :field="h"
          :header="colLabel(h)"
          sortable
        >
          <template #body="{ data }">{{ cell(data, h) }}</template>
        </Column>
      </DataTable>
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
</style>
