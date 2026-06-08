<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ApiException } from '@/api/client'
import { payrollApi, type Payroll } from '@/api/payroll'
import { saveBlob } from '@/api/reports'
import { usersApi, type User } from '@/api/users'
import { useAuthStore } from '@/stores/auth'

const { t } = useI18n()
const auth = useAuthStore()

const filters = reactive({ period: '', user_id: 0 })
const rows = ref<Payroll[]>([])
const users = ref<User[]>([])
const selected = ref<Payroll | null>(null)

const loading = ref(false)
const generating = ref(false)
const exporting = ref('')
const error = ref('')
const notice = ref('')

function messageFor(e: unknown, fallback: string): string {
  return e instanceof ApiException ? e.message : fallback
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
  error.value = ''
  notice.value = ''
  try {
    rows.value = await payrollApi.list(buildParams())
    selected.value = null
  } catch (e) {
    error.value = messageFor(e, t('common.loadError'))
  } finally {
    loading.value = false
  }
}

async function generate(): Promise<void> {
  if (!filters.period) {
    error.value = t('payroll.periodRequired')
    return
  }
  if (!window.confirm(t('payroll.confirmGenerate', { period: filters.period }))) return
  generating.value = true
  error.value = ''
  notice.value = ''
  try {
    const res = await payrollApi.generate(buildParams() as { period: string; user_id?: number })
    notice.value = t('payroll.generated', { n: res.generated })
    await load()
  } catch (e) {
    error.value = messageFor(e, t('common.saveError'))
  } finally {
    generating.value = false
  }
}

async function exportAs(format: 'excel' | 'pdf'): Promise<void> {
  if (!filters.period) {
    error.value = t('payroll.periodRequired')
    return
  }
  exporting.value = format
  error.value = ''
  try {
    const blob = await payrollApi.download(buildParams(), format)
    saveBlob(blob, `payroll-${filters.period}.${format === 'excel' ? 'xlsx' : 'pdf'}`)
  } catch (e) {
    error.value = messageFor(e, t('payroll.exportError'))
  } finally {
    exporting.value = ''
  }
}

async function openDetails(p: Payroll): Promise<void> {
  error.value = ''
  try {
    selected.value = await payrollApi.get(p.id)
  } catch (e) {
    error.value = messageFor(e, t('common.loadError'))
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
    <h1 class="mb-6 text-2xl font-bold text-slate-900 dark:text-white">{{ t('payroll.title') }}</h1>

    <div class="mb-6 grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 sm:grid-cols-2 lg:grid-cols-3 dark:border-slate-800 dark:bg-slate-900">
      <label class="block text-sm"><span class="lbl">{{ t('payroll.period') }}</span><input v-model="filters.period" type="month" class="field" /></label>
      <label class="block text-sm"><span class="lbl">{{ t('payroll.employee') }}</span>
        <select v-model.number="filters.user_id" class="field">
          <option :value="0">{{ t('payroll.allEmployees') }}</option>
          <option v-for="u in users" :key="u.id" :value="u.id">{{ u.name }}</option>
        </select>
      </label>
    </div>

    <div class="mb-6 flex flex-wrap gap-3">
      <button type="button" class="btn-primary disabled:opacity-50" :disabled="loading" @click="load">{{ loading ? t('common.loading') : t('payroll.view') }}</button>
      <button v-if="auth.can('payroll.generate')" type="button" class="btn-primary disabled:opacity-50" :disabled="generating" @click="generate">{{ generating ? t('common.saving') : t('payroll.generate') }}</button>
      <button type="button" class="btn-ghost-bordered disabled:opacity-50" :disabled="!!exporting" @click="exportAs('excel')">{{ exporting === 'excel' ? t('common.loading') : t('payroll.exportExcel') }}</button>
      <button type="button" class="btn-ghost-bordered disabled:opacity-50" :disabled="!!exporting" @click="exportAs('pdf')">{{ exporting === 'pdf' ? t('common.loading') : t('payroll.exportPdf') }}</button>
    </div>

    <p v-if="notice" class="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">{{ notice }}</p>
    <p v-if="error" class="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300" role="alert">{{ error }}</p>

    <!-- تفاصيل كشف -->
    <div v-if="selected" class="mb-6 rounded-2xl border border-indigo-200 bg-indigo-50/40 p-6 dark:border-indigo-900 dark:bg-indigo-950/30">
      <div class="mb-4 flex items-center justify-between">
        <h2 class="font-semibold text-slate-800 dark:text-slate-100">{{ t('payroll.payslipOf', { name: selected.user?.name ?? '#' + selected.user_id, period: selected.period }) }}</h2>
        <button type="button" class="text-sm text-slate-500 hover:underline" @click="selected = null">{{ t('common.cancel') }}</button>
      </div>
      <dl class="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <div class="flex justify-between border-b border-slate-200/60 py-1 dark:border-slate-700/60"><dt class="text-slate-500">{{ t('payroll.base') }}</dt><dd dir="ltr">{{ money(selected.base_salary, curCode(selected)) }}</dd></div>
        <div class="flex justify-between border-b border-slate-200/60 py-1 dark:border-slate-700/60"><dt class="text-slate-500">{{ t('payroll.overtime') }}</dt><dd dir="ltr">{{ money(selected.overtime_amount, curCode(selected)) }}</dd></div>
        <div class="flex justify-between border-b border-slate-200/60 py-1 dark:border-slate-700/60"><dt class="text-slate-500">{{ t('payroll.bonuses') }}</dt><dd dir="ltr">{{ money(selected.bonuses_amount, curCode(selected)) }}</dd></div>
        <div class="flex justify-between border-b border-slate-200/60 py-1 dark:border-slate-700/60"><dt class="text-slate-500">{{ t('payroll.lateDeduction') }}</dt><dd dir="ltr">{{ money(selected.late_deduction, curCode(selected)) }}</dd></div>
        <div class="flex justify-between border-b border-slate-200/60 py-1 dark:border-slate-700/60"><dt class="text-slate-500">{{ t('payroll.absenceDeduction') }}</dt><dd dir="ltr">{{ money(selected.absence_deduction, curCode(selected)) }}</dd></div>
        <div class="flex justify-between border-b border-slate-200/60 py-1 dark:border-slate-700/60"><dt class="text-slate-500">{{ t('payroll.unpaidLeaveDeduction') }}</dt><dd dir="ltr">{{ money(selected.unpaid_leave_deduction, curCode(selected)) }}</dd></div>
        <div class="flex justify-between border-b border-slate-200/60 py-1 font-semibold dark:border-slate-700/60"><dt>{{ t('payroll.net') }}</dt><dd dir="ltr">{{ money(selected.net_salary, curCode(selected)) }}</dd></div>
      </dl>
      <div v-if="selected.breakdown" class="mt-4">
        <h3 class="mb-2 text-xs font-semibold uppercase text-slate-500">{{ t('payroll.breakdown') }}</h3>
        <div class="flex flex-wrap gap-2">
          <span v-for="k in breakdownKeys" :key="k" class="rounded-full bg-white px-3 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {{ t('payroll.bd.' + k) }}: <span dir="ltr">{{ selected.breakdown[k] ?? '—' }}</span>
          </span>
        </div>
      </div>
    </div>

    <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <p v-if="loading" class="p-6 text-sm text-slate-500">{{ t('common.loading') }}</p>
      <p v-else-if="!rows.length" class="p-6 text-sm text-slate-500">{{ t('payroll.empty') }}</p>
      <div v-else class="overflow-x-auto">
        <table class="w-full text-start text-sm">
          <thead class="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            <tr>
              <th class="px-4 py-3 text-start">{{ t('payroll.employee') }}</th>
              <th class="px-4 py-3 text-start">{{ t('payroll.period') }}</th>
              <th class="px-4 py-3 text-start">{{ t('payroll.base') }}</th>
              <th class="px-4 py-3 text-start">{{ t('payroll.deductions') }}</th>
              <th class="px-4 py-3 text-start">{{ t('payroll.net') }}</th>
              <th class="px-4 py-3 text-end">{{ t('companies.actions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            <tr v-for="p in rows" :key="p.id">
              <td class="px-4 py-3 font-medium text-slate-900 dark:text-white">{{ p.user?.name ?? '#' + p.user_id }}</td>
              <td class="px-4 py-3 text-slate-500" dir="ltr">{{ p.period }}</td>
              <td class="px-4 py-3 text-slate-500" dir="ltr">{{ money(p.base_salary, curCode(p)) }}</td>
              <td class="px-4 py-3 text-rose-600 dark:text-rose-400" dir="ltr">{{ money(totalDeductions(p), curCode(p)) }}</td>
              <td class="px-4 py-3 font-semibold text-slate-900 dark:text-white" dir="ltr">{{ money(p.net_salary, curCode(p)) }}</td>
              <td class="px-4 py-3">
                <div class="flex justify-end">
                  <button type="button" class="text-indigo-600 hover:underline dark:text-indigo-400" @click="openDetails(p)">{{ t('payroll.details') }}</button>
                </div>
              </td>
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
