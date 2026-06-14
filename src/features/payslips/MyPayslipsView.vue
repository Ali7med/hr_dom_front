<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Dialog from '@/components/AppDialog.vue'
import PageHeader from '@/components/PageHeader.vue'
import { ApiException } from '@/api/client'
import { payslipsApi, type Payslip } from '@/api/payslips'
import { saveBlob } from '@/api/reports'

const { t } = useI18n()
const toast = useToast()

const rows = ref<Payslip[]>([])
const selected = ref<Payslip | null>(null)
const loading = ref(false)
const downloading = ref('')

function messageFor(e: unknown, fallback: string): string {
  return e instanceof ApiException ? e.message : fallback
}
function notifyError(e: unknown, fallback: string): void {
  toast.add({ severity: 'error', summary: t('common.error'), detail: messageFor(e, fallback), life: 4000 })
}

const money = (v: string | number | null | undefined, cur?: string | null) =>
  `${Number(v ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${cur ? ' ' + cur : ''}`
const curCode = (p: Payslip) => p.currency?.code ?? ''
const totalDeductions = (p: Payslip) =>
  Number(p.late_deduction) + Number(p.absence_deduction) + Number(p.unpaid_leave_deduction)

const breakdownKeys = [
  'working_days', 'daily_rate', 'hourly_rate', 'late_days',
  'absent_days', 'unpaid_leave_days', 'overtime_hours', 'overtime_mode',
] as const

async function load(): Promise<void> {
  loading.value = true
  try {
    rows.value = await payslipsApi.list()
  } catch (e) {
    notifyError(e, t('common.loadError'))
  } finally {
    loading.value = false
  }
}

async function openDetails(p: Payslip): Promise<void> {
  try {
    selected.value = await payslipsApi.get(p.period)
  } catch (e) {
    notifyError(e, t('common.loadError'))
  }
}

async function downloadPdf(p: Payslip): Promise<void> {
  downloading.value = p.period
  try {
    const blob = await payslipsApi.downloadPdf(p.period)
    saveBlob(blob, `payslip-${p.period}.pdf`)
  } catch (e) {
    notifyError(e, t('payslips.downloadError'))
  } finally {
    downloading.value = ''
  }
}

onMounted(load)
</script>

<template>
  <div class="mx-auto max-w-4xl">
    <PageHeader :title="t('payslips.title')" :subtitle="t('payslips.subtitle')" />

    <div class="overflow-hidden rounded-2xl border border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
      <DataTable
        :value="rows"
        :loading="loading"
        paginator
        :rows="12"
        :rows-per-page-options="[12, 24, 48]"
        data-key="period"
        striped-rows
        removable-sort
      >
        <template #empty>
          <p class="py-6 text-center text-sm text-surface-500">{{ t('payslips.empty') }}</p>
        </template>

        <Column field="period" :header="t('payroll.period')" sortable>
          <template #body="{ data }"><span class="font-medium text-surface-900 dark:text-white" dir="ltr">{{ data.period }}</span></template>
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
            <div class="flex justify-end gap-1">
              <Button
                v-tooltip.top="t('payslips.details')"
                icon="pi pi-eye"
                severity="secondary"
                text
                rounded
                @click="openDetails(data)"
              />
              <Button
                v-tooltip.top="t('payslips.downloadPdf')"
                icon="pi pi-file-pdf"
                severity="secondary"
                text
                rounded
                :loading="downloading === data.period"
                @click="downloadPdf(data)"
              />
            </div>
          </template>
        </Column>
      </DataTable>
    </div>

    <!-- تفاصيل القسيمة -->
    <Dialog
      :visible="!!selected"
      modal
      :header="selected ? t('payslips.payslipFor', { period: selected.period }) : ''"
      :style="{ width: '34rem' }"
      :breakpoints="{ '640px': '95vw' }"
      @update:visible="(v: boolean) => { if (!v) selected = null }"
    >
      <template v-if="selected">
        <dl class="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div class="flex justify-between border-b border-surface-200/60 py-1 dark:border-surface-700/60"><dt class="text-surface-500">{{ t('payroll.base') }}</dt><dd dir="ltr">{{ money(selected.base_salary, curCode(selected)) }}</dd></div>
          <div class="flex justify-between border-b border-surface-200/60 py-1 dark:border-surface-700/60"><dt class="text-surface-500">{{ t('payroll.overtime') }}</dt><dd dir="ltr">{{ money(selected.overtime_amount, curCode(selected)) }}</dd></div>
          <div class="flex justify-between border-b border-surface-200/60 py-1 dark:border-surface-700/60"><dt class="text-surface-500">{{ t('payroll.bonuses') }}</dt><dd dir="ltr">{{ money(selected.bonuses_amount, curCode(selected)) }}</dd></div>
          <div class="flex justify-between border-b border-surface-200/60 py-1 dark:border-surface-700/60"><dt class="text-surface-500">{{ t('payroll.lateDeduction') }}</dt><dd dir="ltr">{{ money(selected.late_deduction, curCode(selected)) }}</dd></div>
          <div class="flex justify-between border-b border-surface-200/60 py-1 dark:border-surface-700/60"><dt class="text-surface-500">{{ t('payroll.absenceDeduction') }}</dt><dd dir="ltr">{{ money(selected.absence_deduction, curCode(selected)) }}</dd></div>
          <div class="flex justify-between border-b border-surface-200/60 py-1 dark:border-surface-700/60"><dt class="text-surface-500">{{ t('payroll.unpaidLeaveDeduction') }}</dt><dd dir="ltr">{{ money(selected.unpaid_leave_deduction, curCode(selected)) }}</dd></div>
          <div class="flex justify-between border-b border-surface-200/60 py-1 font-semibold sm:col-span-2 dark:border-surface-700/60"><dt>{{ t('payroll.net') }}</dt><dd dir="ltr">{{ money(selected.net_salary, curCode(selected)) }}</dd></div>
        </dl>
        <div v-if="selected.breakdown" class="mt-4">
          <h3 class="mb-2 text-xs font-semibold uppercase text-surface-500">{{ t('payroll.breakdown') }}</h3>
          <div class="flex flex-wrap gap-2">
            <span v-for="k in breakdownKeys" :key="k" class="rounded-full bg-surface-100 px-3 py-1 text-xs text-surface-600 dark:bg-surface-800 dark:text-surface-300">
              {{ t('payroll.bd.' + k) }}: <span dir="ltr">{{ selected.breakdown[k] ?? '—' }}</span>
            </span>
          </div>
        </div>
        <div class="mt-5 flex justify-end">
          <Button
            :label="downloading === selected.period ? t('common.loading') : t('payslips.downloadPdf')"
            icon="pi pi-file-pdf"
            :loading="downloading === selected.period"
            @click="downloadPdf(selected)"
          />
        </div>
      </template>
    </Dialog>
  </div>
</template>
