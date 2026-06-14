<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Select from 'primevue/select'
import InputNumber from 'primevue/inputnumber'
import Textarea from 'primevue/textarea'
import Tag from 'primevue/tag'
import Dialog from '@/components/AppDialog.vue'
import PageHeader from '@/components/PageHeader.vue'
import { ApiException } from '@/api/client'
import { loansApi, type Loan, type LoanStatus, type LoanInstallment } from '@/api/loans'
import { usersApi, type User } from '@/api/users'

const { t } = useI18n()
const confirm = useConfirm()
const toast = useToast()

function messageFor(e: unknown, fallback: string): string {
  return e instanceof ApiException ? e.message : fallback
}
function notifyError(e: unknown, fallback: string): void {
  toast.add({ severity: 'error', summary: t('common.error'), detail: messageFor(e, fallback), life: 4000 })
}

const fmtMoney = (n?: number | null) => (n === null || n === undefined ? '—' : Number(n).toLocaleString())

// القسط الشهري المشتقّ إن لم يُرجِعه الباك.
const installmentAmount = (l: Loan) =>
  l.installment_amount ?? (l.installments ? l.amount / l.installments : 0)
const paidCount = (l: Loan) => l.installments_paid ?? 0
const canDelete = (l: Loan) => paidCount(l) === 0 && l.status !== 'settled'

// يزيد شهراً على "YYYY-MM".
function addMonths(period: string, n: number): string {
  const [y, m] = period.split('-').map(Number)
  if (!y || !m) return period
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// جدول أقساط: من الباك إن وُجد، وإلا مُشتقّ من البدء/العدد/القيمة.
function scheduleOf(l: Loan): LoanInstallment[] {
  if (l.installments_schedule && l.installments_schedule.length) return l.installments_schedule
  const per = installmentAmount(l)
  const paid = paidCount(l)
  return Array.from({ length: l.installments }, (_, i) => ({
    period: addMonths(l.start_period, i),
    amount: per,
    deducted_at: i < paid ? 'derived' : null,
  }))
}

const filters = reactive({ user_id: 0, status: '' as '' | LoanStatus })
const statusOptions = [
  { value: '', label: 'loans.allStatuses' },
  { value: 'active', label: 'loans.statusActive' },
  { value: 'settled', label: 'loans.statusSettled' },
  { value: 'pending', label: 'loans.statusPending' },
  { value: 'rejected', label: 'loans.statusRejected' },
]

const users = ref<User[]>([])
const rows = ref<Loan[]>([])
const total = ref(0)
const loading = ref(false)
const loaded = ref(false)

const employeeName = (l: Loan) => l.user?.name ?? users.value.find((u) => u.id === l.user_id)?.name ?? `#${l.user_id}`

function statusSeverity(s: LoanStatus): 'info' | 'success' | 'warn' | 'danger' {
  return s === 'active' ? 'info' : s === 'settled' ? 'success' : s === 'rejected' ? 'danger' : 'warn'
}
function statusLabel(s: LoanStatus): string {
  return t('loans.status' + s.charAt(0).toUpperCase() + s.slice(1))
}

function buildParams(): Record<string, unknown> {
  const p: Record<string, unknown> = {}
  if (filters.user_id) p.user_id = filters.user_id
  if (filters.status) p.status = filters.status
  return p
}

async function run(): Promise<void> {
  loading.value = true
  try {
    const res = await loansApi.list(buildParams())
    rows.value = res.data
    total.value = res.pagination?.total ?? res.data.length
    loaded.value = true
  } catch (e) {
    notifyError(e, t('common.loadError'))
  } finally {
    loading.value = false
  }
}

// ===== تفاصيل سلفة (جدول الأقساط) =====
const details = reactive({ open: false, loan: null as Loan | null, loading: false })
async function openDetails(l: Loan): Promise<void> {
  details.open = true
  details.loan = l
  details.loading = true
  try {
    details.loan = await loansApi.get(l.id)
  } catch {
    // نُبقي صفّ القائمة كحدّ أدنى للعرض.
  } finally {
    details.loading = false
  }
}
const detailSchedule = computed(() => (details.loan ? scheduleOf(details.loan) : []))

// ===== إنشاء سلفة =====
const form = reactive({
  open: false,
  user_id: 0,
  amount: 0,
  installments: 1,
  start_period: '',
  reason: '',
})
const saving = ref(false)
function openForm(): void {
  form.open = true
  form.user_id = users.value[0]?.id ?? 0
  form.amount = 0
  form.installments = 1
  form.start_period = ''
  form.reason = ''
}
const formInstallment = computed(() =>
  form.installments > 0 ? form.amount / form.installments : 0,
)
async function submit(): Promise<void> {
  if (!form.user_id || !form.amount || form.amount <= 0 || !form.installments || !form.start_period) return
  saving.value = true
  try {
    await loansApi.create({
      user_id: form.user_id,
      amount: form.amount,
      installments: form.installments,
      start_period: form.start_period,
      reason: form.reason.trim() || null,
    })
    form.open = false
    toast.add({ severity: 'success', summary: t('loans.created'), life: 2500 })
    await run()
  } catch (e) {
    notifyError(e, t('common.saveError'))
  } finally {
    saving.value = false
  }
}

function remove(l: Loan): void {
  confirm.require({
    message: t('loans.confirmDelete', { name: employeeName(l) }),
    header: t('common.delete'),
    icon: 'pi pi-exclamation-triangle',
    acceptProps: { severity: 'danger', label: t('common.delete') },
    rejectProps: { severity: 'secondary', outlined: true, label: t('common.cancel') },
    accept: async () => {
      try {
        await loansApi.remove(l.id)
        toast.add({ severity: 'success', summary: t('common.deleted'), life: 2500 })
        await run()
      } catch (e) {
        notifyError(e, t('common.saveError'))
      }
    },
  })
}

onMounted(async () => {
  try {
    const us = await usersApi.list({ per_page: 100 })
    users.value = us.data
  } catch {
    // قائمة الموظفين اختيارية للفلتر/الإنشاء.
  }
  await run()
})
</script>

<template>
  <div class="mx-auto max-w-5xl">
    <PageHeader :title="t('loans.title')" :subtitle="t('loans.subtitle')">
      <template #actions>
        <Button v-can="'payroll.manage_rules'" icon="pi pi-plus" :label="t('loans.create')" @click="openForm" />
      </template>
    </PageHeader>

    <!-- الفلاتر -->
    <div class="mb-6 rounded-2xl border border-surface-200 bg-white p-4 dark:border-surface-800 dark:bg-surface-900">
      <div class="flex flex-wrap items-end gap-4">
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('loans.employee') }}</span>
          <Select
            v-model.number="filters.user_id"
            :options="[{ id: 0, name: t('loans.allEmployees') }, ...users]"
            option-label="name"
            option-value="id"
            filter
            class="w-64"
          />
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('loans.status') }}</span>
          <Select v-model="filters.status" :options="statusOptions" option-value="value" class="w-56">
            <template #value="{ value }">{{ t(statusOptions.find((o) => o.value === value)?.label ?? '') }}</template>
            <template #option="{ option }">{{ t(option.label) }}</template>
          </Select>
        </label>
        <Button icon="pi pi-search" :label="loading ? t('common.loading') : t('common.search')" :loading="loading" :disabled="loading" @click="run" />
      </div>
    </div>

    <!-- السجل -->
    <div v-if="loaded" class="overflow-hidden rounded-2xl border border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
      <div class="flex items-center justify-between border-b border-surface-100 px-4 py-3 dark:border-surface-800">
        <h2 class="text-sm font-semibold text-surface-700 dark:text-surface-200">{{ t('loans.recordTitle') }}</h2>
        <span class="text-xs text-surface-500">{{ t('reports.rowsCount', { n: total }) }}</span>
      </div>
      <DataTable :value="rows" paginator :rows="15" :rows-per-page-options="[15, 30, 50]" data-key="id" striped-rows removable-sort>
        <template #empty>
          <p class="py-6 text-center text-sm text-surface-500">{{ t('loans.empty') }}</p>
        </template>

        <Column :header="t('loans.employee')">
          <template #body="{ data }"><span class="font-medium text-surface-900 dark:text-white">{{ employeeName(data) }}</span></template>
        </Column>
        <Column field="amount" :header="t('loans.amount')" sortable>
          <template #body="{ data }"><span class="text-surface-500" dir="ltr">{{ fmtMoney(data.amount) }}</span></template>
        </Column>
        <Column :header="t('loans.installments')">
          <template #body="{ data }"><span class="text-surface-500" dir="ltr">{{ data.installments }}</span></template>
        </Column>
        <Column :header="t('loans.installmentAmount')">
          <template #body="{ data }"><span class="text-surface-500" dir="ltr">{{ fmtMoney(installmentAmount(data)) }}</span></template>
        </Column>
        <Column field="start_period" :header="t('loans.startPeriod')" sortable>
          <template #body="{ data }"><span class="text-surface-500" dir="ltr">{{ data.start_period }}</span></template>
        </Column>
        <Column :header="t('loans.statusCol')">
          <template #body="{ data }"><Tag :value="statusLabel(data.status)" :severity="statusSeverity(data.status)" /></template>
        </Column>
        <Column :header="t('companies.actions')" class="text-end">
          <template #body="{ data }">
            <div class="flex justify-end gap-1">
              <Button v-tooltip.top="t('loans.details')" icon="pi pi-eye" severity="secondary" text rounded @click="openDetails(data)" />
              <Button
                v-if="canDelete(data)"
                v-can="'payroll.manage_rules'"
                v-tooltip.top="t('common.delete')"
                icon="pi pi-trash"
                severity="danger"
                text
                rounded
                @click="remove(data)"
              />
            </div>
          </template>
        </Column>
      </DataTable>
    </div>

    <!-- إنشاء سلفة -->
    <Dialog
      v-model:visible="form.open"
      modal
      :header="t('loans.create')"
      :style="{ width: '34rem' }"
      :breakpoints="{ '640px': '95vw' }"
    >
      <form class="grid gap-4 pt-2 sm:grid-cols-2" @submit.prevent="submit">
        <label class="block text-sm sm:col-span-2">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('loans.employee') }}</span>
          <Select v-model.number="form.user_id" :options="users" option-label="name" option-value="id" filter fluid />
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('loans.amount') }}</span>
          <InputNumber v-model="form.amount" :min="0" :min-fraction-digits="0" :max-fraction-digits="2" fluid />
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('loans.installments') }}</span>
          <InputNumber v-model="form.installments" :min="1" :max="60" show-buttons fluid />
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('loans.startPeriod') }}</span>
          <input v-model="form.start_period" type="month" required class="field" />
        </label>
        <div class="block self-end text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('loans.installmentAmount') }}</span>
          <div class="rounded-lg border border-surface-200 bg-surface-50 px-3 py-2 text-surface-700 dark:border-surface-700 dark:bg-surface-800 dark:text-surface-200" dir="ltr">
            {{ fmtMoney(formInstallment) }}
          </div>
        </div>
        <label class="block text-sm sm:col-span-2">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('loans.reason') }}</span>
          <Textarea v-model="form.reason" rows="2" :maxlength="500" auto-resize fluid />
        </label>
        <div class="mt-2 flex justify-end gap-2 sm:col-span-2">
          <Button type="button" :label="t('common.cancel')" severity="secondary" text @click="form.open = false" />
          <Button type="submit" :label="saving ? t('common.saving') : t('common.save')" icon="pi pi-check" :loading="saving" :disabled="!form.user_id || !form.amount || form.amount <= 0 || !form.installments || !form.start_period" />
        </div>
      </form>
    </Dialog>

    <!-- تفاصيل السلفة + جدول الأقساط -->
    <Dialog
      v-model:visible="details.open"
      modal
      :header="t('loans.details')"
      :style="{ width: '40rem' }"
      :breakpoints="{ '640px': '95vw' }"
    >
      <div v-if="details.loan" class="pt-2">
        <div class="mb-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
          <div>
            <p class="text-xs text-surface-500">{{ t('loans.employee') }}</p>
            <p class="font-medium text-surface-900 dark:text-white">{{ employeeName(details.loan) }}</p>
          </div>
          <div>
            <p class="text-xs text-surface-500">{{ t('loans.amount') }}</p>
            <p class="font-medium text-surface-900 dark:text-white" dir="ltr">{{ fmtMoney(details.loan.amount) }}</p>
          </div>
          <div>
            <p class="text-xs text-surface-500">{{ t('loans.installments') }}</p>
            <p class="font-medium text-surface-900 dark:text-white" dir="ltr">{{ details.loan.installments }}</p>
          </div>
          <div>
            <p class="text-xs text-surface-500">{{ t('loans.statusCol') }}</p>
            <Tag :value="statusLabel(details.loan.status)" :severity="statusSeverity(details.loan.status)" />
          </div>
        </div>
        <p v-if="details.loan.reason" class="mb-4 text-sm text-surface-600 dark:text-surface-300">{{ details.loan.reason }}</p>

        <DataTable :value="detailSchedule" :loading="details.loading" data-key="period" striped-rows class="text-sm">
          <template #empty><p class="py-4 text-center text-sm text-surface-500">{{ t('loans.noInstallments') }}</p></template>
          <Column :header="t('loans.period')">
            <template #body="{ data }"><span dir="ltr">{{ data.period }}</span></template>
          </Column>
          <Column :header="t('loans.installmentAmount')">
            <template #body="{ data }"><span dir="ltr">{{ fmtMoney(data.amount) }}</span></template>
          </Column>
          <Column :header="t('loans.installmentStatus')">
            <template #body="{ data }">
              <Tag
                :value="data.deducted_at ? t('loans.deducted') : t('loans.notDeducted')"
                :severity="data.deducted_at ? 'success' : 'secondary'"
              />
            </template>
          </Column>
        </DataTable>
      </div>
      <div class="mt-4 flex justify-end">
        <Button :label="t('common.cancel')" severity="secondary" text @click="details.open = false" />
      </div>
    </Dialog>
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
