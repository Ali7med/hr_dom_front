<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import InputText from 'primevue/inputtext'
import Tag from 'primevue/tag'
import { ApiException } from '@/api/client'
import { saveBlob, type ReportRow } from '@/api/reports'
import { leaveReportsApi } from '@/api/leaveReports'
import { departmentsApi, type Department } from '@/api/users'
import { leaveTypesApi, type LeaveType } from '@/api/leaves'
import PageHeader from '@/components/PageHeader.vue'

const { t } = useI18n()
const toast = useToast()

type Mode = 'balances' | 'today' | 'general'
const mode = ref<Mode>('balances')
const modes: { key: Mode; label: string }[] = [
  { key: 'balances', label: 'leaveReports.modeBalances' },
  { key: 'today', label: 'leaveReports.modeToday' },
  { key: 'general', label: 'leaveReports.modeGeneral' },
]

const filters = reactive({
  q: '',
  department_id: 0,
  balance_type: '' as '' | 'normal' | 'sick',
  from: '',
  to: '',
  leave_type_id: 0,
  status: '' as '' | 'pending' | 'approved' | 'rejected',
  group_by: '' as '' | 'department' | 'type' | 'status',
})

const departments = ref<Department[]>([])
const types = ref<LeaveType[]>([])

const loading = ref(false)
const exporting = ref('')
const loaded = ref(false)
const title = ref('')
const headings = ref<string[]>([])
const rows = ref<ReportRow[]>([])
const total = ref(0)

const balanceTypeOptions = [
  { value: '', label: 'leaveReports.allBalanceTypes' },
  { value: 'normal', label: 'leaveBalanceType.normal' },
  { value: 'sick', label: 'leaveBalanceType.sick' },
]
const statusOptions = [
  { value: '', label: 'leaveReports.allStatuses' },
  { value: 'pending', label: 'leaveStatus.pending' },
  { value: 'approved', label: 'leaveStatus.approved' },
  { value: 'rejected', label: 'leaveStatus.rejected' },
]
const groupOptions = [
  { value: '', label: 'leaveReports.noGroup' },
  { value: 'department', label: 'leaveReports.groupDepartment' },
  { value: 'type', label: 'leaveReports.groupType' },
  { value: 'status', label: 'leaveReports.groupStatus' },
]

const colLabels: Record<string, string> = {
  user_id: 'leaveReports.col.userId',
  id: 'leaveReports.col.id',
  employee_no: 'leaveReports.col.employeeNo',
  name: 'leaveReports.col.name',
  department: 'leaveReports.col.department',
  normal_days: 'leaveReports.col.normalDays',
  sick_days: 'leaveReports.col.sickDays',
  type: 'leaveReports.col.type',
  start_at: 'leaveReports.col.startAt',
  end_at: 'leaveReports.col.endAt',
  days: 'leaveReports.col.days',
  hours: 'leaveReports.col.hours',
  status: 'leaveReports.col.status',
  group: 'leaveReports.col.group',
  count: 'leaveReports.col.count',
  total_days: 'leaveReports.col.totalDays',
  total_hours: 'leaveReports.col.totalHours',
}
function colLabel(h: string): string {
  return colLabels[h] ? t(colLabels[h]) : h
}

function messageFor(e: unknown, fallback: string): string {
  return e instanceof ApiException ? e.message : fallback
}
function notifyError(e: unknown, fallback: string): void {
  toast.add({ severity: 'error', summary: t('common.error'), detail: messageFor(e, fallback), life: 4000 })
}

function todayYmd(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// يبني فلاتر الطلب حسب وضع التقرير الحالي.
function buildParams(): Record<string, unknown> {
  if (mode.value === 'balances') {
    const p: Record<string, unknown> = {}
    if (filters.q) p.q = filters.q
    if (filters.department_id) p.department_id = filters.department_id
    if (filters.balance_type) p.balance_type = filters.balance_type
    return p
  }
  if (mode.value === 'today') {
    const today = todayYmd()
    const p: Record<string, unknown> = { from: today, to: today, group_by: 'department' }
    if (filters.department_id) p.department_id = filters.department_id
    return p
  }
  // general
  const p: Record<string, unknown> = {}
  if (filters.from) p.from = filters.from
  if (filters.to) p.to = filters.to
  if (filters.department_id) p.department_id = filters.department_id
  if (filters.leave_type_id) p.leave_type_id = filters.leave_type_id
  if (filters.status) p.status = filters.status
  if (filters.group_by) p.group_by = filters.group_by
  return p
}

function isBalances(): boolean {
  return mode.value === 'balances'
}

async function run(): Promise<void> {
  loading.value = true
  try {
    const params = buildParams()
    const res = isBalances() ? await leaveReportsApi.balances(params) : await leaveReportsApi.leaves(params)
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
    const params = buildParams()
    const blob = isBalances()
      ? await leaveReportsApi.balancesDownload(params, format)
      : await leaveReportsApi.leavesDownload(params, format)
    const ext = format === 'excel' ? 'xlsx' : 'pdf'
    saveBlob(blob, `${mode.value}-leave-report.${ext}`)
  } catch (e) {
    notifyError(e, t('reports.exportError'))
  } finally {
    exporting.value = ''
  }
}

function switchMode(): void {
  loaded.value = false
  run()
}

onMounted(async () => {
  try {
    const [deps, ty] = await Promise.all([departmentsApi.list(), leaveTypesApi.list()])
    departments.value = deps
    types.value = ty
  } catch {
    // الفلاتر اختيارية — تجاهل فشل تحميل القوائم.
  }
  run()
})
</script>

<template>
  <div class="mx-auto max-w-5xl">
    <PageHeader :title="t('leaveReports.title')">
      <template #actions>
        <Button
          v-can="'reports.export'"
          outlined
          icon="pi pi-file-excel"
          :label="exporting === 'excel' ? t('common.loading') : t('reports.exportExcel')"
          :disabled="!!exporting"
          @click="exportAs('excel')"
        />
        <Button
          v-can="'reports.export'"
          outlined
          icon="pi pi-file-pdf"
          :label="exporting === 'pdf' ? t('common.loading') : t('reports.exportPdf')"
          :disabled="!!exporting"
          @click="exportAs('pdf')"
        />
      </template>
    </PageHeader>

    <!-- وضع التقرير -->
    <div class="mb-6">
      <SelectButton
        v-model="mode"
        :options="modes"
        option-value="key"
        data-key="key"
        :allow-empty="false"
        @update:model-value="switchMode"
      >
        <template #option="{ option }">{{ t(option.label) }}</template>
      </SelectButton>
    </div>

    <!-- الفلاتر -->
    <div class="mb-6 rounded-2xl border border-surface-200 bg-white p-4 dark:border-surface-800 dark:bg-surface-900">
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <!-- أرصدة الموظفين -->
        <template v-if="mode === 'balances'">
          <label class="block text-sm">
            <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('leaveReports.search') }}</span>
            <InputText v-model="filters.q" :placeholder="t('leaveReports.searchPlaceholder')" fluid @keyup.enter="run" />
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
            <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('leaveReports.balanceType') }}</span>
            <Select
              v-model="filters.balance_type"
              :options="balanceTypeOptions"
              option-value="value"
              fluid
            >
              <template #value="{ value }">{{ t(balanceTypeOptions.find((o) => o.value === value)?.label ?? '') }}</template>
              <template #option="{ option }">{{ t(option.label) }}</template>
            </Select>
          </label>
        </template>

        <!-- إجازات اليوم حسب القسم -->
        <template v-else-if="mode === 'today'">
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
          <p class="self-end text-xs text-surface-500 sm:col-span-2">{{ t('leaveReports.todayHint') }}</p>
        </template>

        <!-- تقرير الإجازات العام -->
        <template v-else>
          <label class="block text-sm">
            <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('reports.from') }}</span>
            <input v-model="filters.from" type="date" class="field" />
          </label>
          <label class="block text-sm">
            <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('reports.to') }}</span>
            <input v-model="filters.to" type="date" class="field" />
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
            <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('leaveReports.type') }}</span>
            <Select
              v-model.number="filters.leave_type_id"
              :options="[{ id: 0, name: t('leaveReports.allTypes') }, ...types]"
              option-label="name"
              option-value="id"
              fluid
            />
          </label>
          <label class="block text-sm">
            <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('leaveReports.status') }}</span>
            <Select v-model="filters.status" :options="statusOptions" option-value="value" fluid>
              <template #value="{ value }">{{ t(statusOptions.find((o) => o.value === value)?.label ?? '') }}</template>
              <template #option="{ option }">{{ t(option.label) }}</template>
            </Select>
          </label>
          <label class="block text-sm">
            <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('leaveReports.groupBy') }}</span>
            <Select v-model="filters.group_by" :options="groupOptions" option-value="value" fluid>
              <template #value="{ value }">{{ t(groupOptions.find((o) => o.value === value)?.label ?? '') }}</template>
              <template #option="{ option }">{{ t(option.label) }}</template>
            </Select>
          </label>
        </template>
      </div>

      <div class="mt-4 flex flex-wrap gap-3">
        <Button
          icon="pi pi-search"
          :label="loading ? t('common.loading') : t('reports.generate')"
          :loading="loading"
          :disabled="loading"
          @click="run"
        />
      </div>
    </div>

    <!-- النتائج -->
    <div v-if="loaded" class="overflow-hidden rounded-2xl border border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
      <div class="flex items-center justify-between border-b border-surface-100 px-4 py-3 dark:border-surface-800">
        <h2 class="text-sm font-semibold text-surface-700 dark:text-surface-200">{{ title }}</h2>
        <span class="text-xs text-surface-500">{{ t('reports.rowsCount', { n: total }) }}</span>
      </div>
      <DataTable :value="rows" paginator :rows="15" :rows-per-page-options="[15, 30, 50]" striped-rows removable-sort>
        <template #empty>
          <p class="py-6 text-center text-sm text-surface-500">{{ t('reports.empty') }}</p>
        </template>
        <Column v-for="h in headings" :key="h" :field="h" :header="colLabel(h)" sortable>
          <template #body="{ data }">
            <Tag
              v-if="h === 'status' && data[h]"
              :value="t('leaveStatus.' + data[h])"
              :severity="data[h] === 'approved' ? 'success' : data[h] === 'rejected' ? 'danger' : 'warn'"
            />
            <span v-else>{{ data[h] ?? '—' }}</span>
          </template>
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
