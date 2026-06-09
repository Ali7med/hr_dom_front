<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import Select from 'primevue/select'
import { ApiException } from '@/api/client'
import { payrollApi, type Payroll } from '@/api/payroll'
import { saveBlob } from '@/api/reports'
import { usersApi, type User } from '@/api/users'
import { useAuthStore } from '@/stores/auth'
import PageHeader from '@/components/PageHeader.vue'

const { t } = useI18n()
const auth = useAuthStore()
const toast = useToast()

const filters = reactive({ period: '', user_id: 0 })
const rows = ref<Payroll[]>([])
const users = ref<User[]>([])
const selected = ref<Payroll | null>(null)

const loading = ref(false)
const generating = ref(false)
const exporting = ref('')

function messageFor(e: unknown, fallback: string): string {
  return e instanceof ApiException ? e.message : fallback
}
function notifyError(e: unknown, fallback: string): void {
  toast.add({ severity: 'error', summary: t('common.error'), detail: messageFor(e, fallback), life: 4000 })
}
const money = (v: string | number, cur?: string | null) => `${Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${cur ? ' ' + cur : ''}`
const curCode = (p: Payroll) => p.currency?.code ?? ''
const totalDeductions = (p: Payroll) =>
  Number(p.late_deduction) + Number(p.absence_deduction) + Number(p.unpaid_leave_deduction)

function buildParams() {
  const p: { period?: string; user_id?: number } = {}
  if (filters.period) p.period = filters.period
  if (filters.user_id) p.user_id = filters.user_id
  return p
}

async function load(): Promise<void> {
  loading.value = true
  try {
    rows.value = await payrollApi.list(buildParams())
    selected.value = null
  } catch (e) {
    notifyError(e, t('common.loadError'))
  } finally {
    loading.value = false
  }
}

async function generate(): Promise<void> {
  if (!filters.period) {
    notifyError(null, t('payroll.periodRequired'))
    return
  }
  if (!window.confirm(t('payroll.confirmGenerate', { period: filters.period }))) return
  generating.value = true
  try {
    const res = await payrollApi.generate(buildParams() as { period: string; user_id?: number })
    toast.add({ severity: 'success', summary: t('common.saved'), detail: t('payroll.generated', { n: res.generated }), life: 2500 })
    await load()
  } catch (e) {
    notifyError(e, t('common.saveError'))
  } finally {
    generating.value = false
  }
}

async function exportAs(format: 'excel' | 'pdf'): Promise<void> {
  if (!filters.period) {
    notifyError(null, t('payroll.periodRequired'))
    return
  }
  exporting.value = format
  try {
    const blob = await payrollApi.download(buildParams(), format)
    saveBlob(blob, `payroll-${filters.period}.${format === 'excel' ? 'xlsx' : 'pdf'}`)
  } catch (e) {
    notifyError(e, t('payroll.exportError'))
  } finally {
    exporting.value = ''
  }
}

async function openDetails(p: Payroll): Promise<void> {
  try {
    selected.value = await payrollApi.get(p.id)
  } catch (e) {
    notifyError(e, t('common.loadError'))
  }
}

const breakdownKeys = [
  'working_days', 'daily_rate', 'hourly_rate', 'late_days',
  'absent_days', 'unpaid_leave_days', 'overtime_hours', 'overtime_mode',
] as const

onMounted(async () => {
  try {
    users.value = (await usersApi.list({ per_page: 100 })).data
  } catch {
    // اختياري
  }
  await load()
})
</script>

<template>
  <div class="mx-auto max-w-5xl">
    <PageHeader :title="t('payroll.title')">
      <template #actions>
        <Button
          v-if="auth.can('payroll.generate')"
          :label="generating ? t('common.saving') : t('payroll.generate')"
          icon="pi pi-cog"
          :loading="generating"
          @click="generate"
        />
        <Button
          v-can="'payroll.export'"
          :label="exporting === 'excel' ? t('common.loading') : t('payroll.exportExcel')"
          icon="pi pi-file-excel"
          severity="secondary"
          outlined
          :loading="exporting === 'excel'"
          :disabled="!!exporting"
          @click="exportAs('excel')"
        />
        <Button
          v-can="'payroll.export'"
          :label="exporting === 'pdf' ? t('common.loading') : t('payroll.exportPdf')"
          icon="pi pi-file-pdf"
          severity="secondary"
          outlined
          :loading="exporting === 'pdf'"
          :disabled="!!exporting"
          @click="exportAs('pdf')"
        />
      </template>
    </PageHeader>

    <!-- شريط الفلاتر -->
    <div class="mb-6 grid gap-4 rounded-2xl border border-surface-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-3 dark:border-surface-800 dark:bg-surface-900">
      <label class="block text-sm">
        <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('payroll.period') }}</span>
        <!-- native <input type="month"> kept: preserves exact 'YYYY-MM' string binding the API expects -->
        <input
          v-model="filters.period"
          type="month"
          class="w-full rounded-md border border-surface-300 bg-white px-3 py-2 text-sm text-surface-900 outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/30 dark:border-surface-700 dark:bg-surface-800 dark:text-white"
        />
      </label>
      <label class="block text-sm">
        <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('payroll.employee') }}</span>
        <Select
          v-model.number="filters.user_id"
          :options="[{ id: 0, name: t('payroll.allEmployees') }, ...users]"
          option-label="name"
          option-value="id"
          fluid
        />
      </label>
      <div class="flex items-end">
        <Button
          :label="loading ? t('common.loading') : t('payroll.view')"
          icon="pi pi-search"
          :loading="loading"
          :disabled="loading"
          @click="load"
        />
      </div>
    </div>

    <!-- قائمة الكشوف -->
    <div class="overflow-hidden rounded-2xl border border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
      <DataTable
        :value="rows"
        :loading="loading"
        paginator
        :rows="10"
        :rows-per-page-options="[10, 20, 50]"
        data-key="id"
        striped-rows
        removable-sort
      >
        <template #empty>
          <p class="py-6 text-center text-sm text-surface-500">{{ t('payroll.empty') }}</p>
        </template>

        <Column field="user.name" :header="t('payroll.employee')" sortable>
          <template #body="{ data }">
            <span class="font-medium text-surface-900 dark:text-white">{{ data.user?.name ?? '#' + data.user_id }}</span>
          </template>
        </Column>
        <Column field="period" :header="t('payroll.period')" sortable>
          <template #body="{ data }"><span dir="ltr">{{ data.period }}</span></template>
        </Column>
        <Column field="base_salary" :header="t('payroll.base')" sortable>
          <template #body="{ data }"><span class="text-surface-500" dir="ltr">{{ money(data.base_salary, curCode(data)) }}</span></template>
        </Column>
        <Column :header="t('payroll.deductions')">
          <template #body="{ data }"><span class="text-red-600 dark:text-red-400" dir="ltr">{{ money(totalDeductions(data), curCode(data)) }}</span></template>
        </Column>
        <Column field="net_salary" :header="t('payroll.net')" sortable>
          <template #body="{ data }"><span class="font-semibold text-surface-900 dark:text-white" dir="ltr">{{ money(data.net_salary, curCode(data)) }}</span></template>
        </Column>
        <Column :header="t('companies.actions')" class="text-end">
          <template #body="{ data }">
            <div class="flex justify-end">
              <Button
                v-tooltip.top="t('payroll.details')"
                icon="pi pi-eye"
                severity="secondary"
                text
                rounded
                @click="openDetails(data)"
              />
            </div>
          </template>
        </Column>
      </DataTable>
    </div>

    <!-- تفاصيل كشف -->
    <Dialog
      :visible="!!selected"
      modal
      :header="selected ? t('payroll.payslipOf', { name: selected.user?.name ?? '#' + selected.user_id, period: selected.period }) : ''"
      :style="{ width: '34rem' }"
      :breakpoints="{ '640px': '95vw' }"
      @update:visible="(v) => { if (!v) selected = null }"
    >
      <template v-if="selected">
        <dl class="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div class="flex justify-between border-b border-surface-200/60 py-1 dark:border-surface-700/60"><dt class="text-surface-500">{{ t('payroll.base') }}</dt><dd dir="ltr">{{ money(selected.base_salary, curCode(selected)) }}</dd></div>
          <div class="flex justify-between border-b border-surface-200/60 py-1 dark:border-surface-700/60"><dt class="text-surface-500">{{ t('payroll.overtime') }}</dt><dd dir="ltr">{{ money(selected.overtime_amount, curCode(selected)) }}</dd></div>
          <div class="flex justify-between border-b border-surface-200/60 py-1 dark:border-surface-700/60"><dt class="text-surface-500">{{ t('payroll.bonuses') }}</dt><dd dir="ltr">{{ money(selected.bonuses_amount, curCode(selected)) }}</dd></div>
          <div class="flex justify-between border-b border-surface-200/60 py-1 dark:border-surface-700/60"><dt class="text-surface-500">{{ t('payroll.lateDeduction') }}</dt><dd dir="ltr">{{ money(selected.late_deduction, curCode(selected)) }}</dd></div>
          <div class="flex justify-between border-b border-surface-200/60 py-1 dark:border-surface-700/60"><dt class="text-surface-500">{{ t('payroll.absenceDeduction') }}</dt><dd dir="ltr">{{ money(selected.absence_deduction, curCode(selected)) }}</dd></div>
          <div class="flex justify-between border-b border-surface-200/60 py-1 dark:border-surface-700/60"><dt class="text-surface-500">{{ t('payroll.unpaidLeaveDeduction') }}</dt><dd dir="ltr">{{ money(selected.unpaid_leave_deduction, curCode(selected)) }}</dd></div>
          <div class="flex justify-between border-b border-surface-200/60 py-1 font-semibold dark:border-surface-700/60"><dt>{{ t('payroll.net') }}</dt><dd dir="ltr">{{ money(selected.net_salary, curCode(selected)) }}</dd></div>
        </dl>
        <div v-if="selected.breakdown" class="mt-4">
          <h3 class="mb-2 text-xs font-semibold uppercase text-surface-500">{{ t('payroll.breakdown') }}</h3>
          <div class="flex flex-wrap gap-2">
            <span v-for="k in breakdownKeys" :key="k" class="rounded-full bg-surface-100 px-3 py-1 text-xs text-surface-600 dark:bg-surface-800 dark:text-surface-300">
              {{ t('payroll.bd.' + k) }}: <span dir="ltr">{{ selected.breakdown[k] ?? '—' }}</span>
            </span>
          </div>
        </div>
      </template>
    </Dialog>
  </div>
</template>
