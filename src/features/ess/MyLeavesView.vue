<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import Tag from 'primevue/tag'
import Message from 'primevue/message'
import Dialog from '@/components/AppDialog.vue'
import PageHeader from '@/components/PageHeader.vue'
import { ApiException } from '@/api/client'
import { myLeavesApi, type MyLeaveBalance } from '@/api/ess'
import { leavesApi, type LeaveRequest, type LeaveType, type LeaveStatus } from '@/api/leaves'

const { t } = useI18n()
const toast = useToast()

function messageFor(e: unknown, fallback: string): string {
  return e instanceof ApiException ? e.message : fallback
}
function notifyError(e: unknown, fallback: string): void {
  toast.add({ severity: 'error', summary: t('common.error'), detail: messageFor(e, fallback), life: 4000 })
}

const ymd = (d?: string | null) => (d ? d.slice(0, 10) : '—')

// ===== الحالة =====
const requests = ref<LeaveRequest[]>([])
const types = ref<LeaveType[]>([])
const balances = ref<MyLeaveBalance[]>([])
const loading = ref(false)
const typesAvailable = ref(true) // تدهور آمن: إن حُجب /me/leave-types يُعطَّل التقديم.
const balancesAvailable = ref(true)

function statusSeverity(s: LeaveStatus): 'warn' | 'success' | 'danger' | 'info' {
  return s === 'approved' || s === 'auto' ? 'success' : s === 'rejected' ? 'danger' : 'warn'
}
function statusLabel(s: LeaveStatus): string {
  return t('myLeaves.status' + s.charAt(0).toUpperCase() + s.slice(1))
}
const typeName = (r: LeaveRequest) =>
  r.leave_type?.name ?? types.value.find((x) => x.id === r.leave_type_id)?.name ?? `#${r.leave_type_id}`
const balanceName = (b: MyLeaveBalance) =>
  b.leave_type_name ?? (b.balance_type ? t('myLeaves.balanceType.' + b.balance_type) : '—')
const balanceValue = (b: MyLeaveBalance) => b.balance ?? b.balance_days ?? 0

async function load(): Promise<void> {
  loading.value = true
  try {
    requests.value = await myLeavesApi.list()
  } catch (e) {
    notifyError(e, t('common.loadError'))
  } finally {
    loading.value = false
  }
  // أنواع الإجازات للتقديم — اختيارية (تدهور آمن إن حُجبت).
  try {
    types.value = await myLeavesApi.types()
    typesAvailable.value = true
  } catch {
    typesAvailable.value = false
  }
  // الأرصدة — اختيارية.
  try {
    balances.value = await myLeavesApi.balances()
    balancesAvailable.value = true
  } catch {
    balancesAvailable.value = false
  }
}

// ===== نموذج التقديم الذاتي =====
const HALF_HOURS = Array.from({ length: 48 }, (_, i) => {
  const h = String(Math.floor(i / 2)).padStart(2, '0')
  const m = i % 2 === 0 ? '00' : '30'
  return `${h}:${m}`
})

const form = reactive({
  open: false,
  leave_type_id: 0,
  start_at: '',
  end_at: '',
  start_time: '08:00',
  end_time: '11:00',
  reason: '',
})
const saving = ref(false)

const selectedType = computed<LeaveType | undefined>(() => types.value.find((x) => x.id === form.leave_type_id))
const isHourly = computed(() => selectedType.value?.kind === 'hourly')

// خيارات الوقت ضمن نافذة النوع (allowed_from/allowed_to) إن وُجدت.
const timeOptions = computed(() => {
  const tp = selectedType.value
  if (!tp?.allowed_from || !tp?.allowed_to) return HALF_HOURS
  const from = tp.allowed_from.slice(0, 5)
  const to = tp.allowed_to.slice(0, 5)
  return HALF_HOURS.filter((h) => h >= from && h <= to)
})

// حساب الأيام/الساعات + التحقّق محلياً (الباك يفرضها أيضاً).
const dayCount = computed(() => {
  if (isHourly.value || !form.start_at || !form.end_at) return 0
  const a = new Date(form.start_at).getTime()
  const b = new Date(form.end_at).getTime()
  return b >= a ? Math.round((b - a) / 86400000) + 1 : 0
})
const hourCount = computed(() => {
  if (!isHourly.value) return 0
  const [sh, sm] = form.start_time.split(':').map(Number)
  const [eh, em] = form.end_time.split(':').map(Number)
  const mins = eh * 60 + em - (sh * 60 + sm)
  return mins > 0 ? mins / 60 : 0
})

const validationError = computed<string>(() => {
  const tp = selectedType.value
  if (!tp) return ''
  if (isHourly.value) {
    if (!form.start_at) return ''
    if (hourCount.value <= 0) return t('myLeaves.endAfterStart')
    if (tp.max_hours_per_day && hourCount.value > tp.max_hours_per_day)
      return t('myLeaves.maxHoursExceeded', { n: tp.max_hours_per_day })
  } else {
    if (!form.start_at || !form.end_at) return ''
    if (dayCount.value <= 0) return t('myLeaves.endAfterStart')
    if (tp.max_days_per_request && dayCount.value > tp.max_days_per_request)
      return t('myLeaves.maxDaysExceeded', { n: tp.max_days_per_request })
  }
  return ''
})

const canSubmit = computed(() => {
  if (!form.leave_type_id || validationError.value) return false
  if (isHourly.value) return !!form.start_at
  return !!form.start_at && !!form.end_at
})

function openForm(): void {
  form.open = true
  form.leave_type_id = types.value[0]?.id ?? 0
  form.start_at = ''
  form.end_at = ''
  form.start_time = timeOptions.value[0] ?? '08:00'
  form.end_time = timeOptions.value[timeOptions.value.length - 1] ?? '11:00'
  form.reason = ''
}

async function submit(): Promise<void> {
  if (!canSubmit.value) return
  saving.value = true
  try {
    const payload = isHourly.value
      ? {
          leave_type_id: form.leave_type_id,
          start_at: form.start_at,
          end_at: form.start_at,
          start_time: form.start_time,
          end_time: form.end_time,
          source: 'panel' as const,
        }
      : {
          leave_type_id: form.leave_type_id,
          start_at: form.start_at,
          end_at: form.end_at,
          source: 'panel' as const,
        }
    await leavesApi.create(payload)
    form.open = false
    toast.add({ severity: 'success', summary: t('myLeaves.submitted'), life: 2500 })
    await load()
  } catch (e) {
    notifyError(e, t('common.saveError'))
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="mx-auto max-w-4xl">
    <PageHeader :title="t('myLeaves.title')" :subtitle="t('myLeaves.subtitle')">
      <template #actions>
        <Button
          v-if="typesAvailable"
          icon="pi pi-plus"
          :label="t('myLeaves.submit')"
          :disabled="types.length === 0"
          @click="openForm"
        />
      </template>
    </PageHeader>

    <!-- التقديم محجوب (تدهور آمن) -->
    <Message v-if="!typesAvailable" severity="info" :closable="false" class="mb-5">
      {{ t('myLeaves.submitUnavailable') }}
    </Message>

    <!-- الأرصدة -->
    <div v-if="balancesAvailable && balances.length" class="mb-6 grid gap-3 sm:grid-cols-3">
      <div
        v-for="(b, i) in balances"
        :key="i"
        class="rounded-2xl border border-surface-200 bg-white p-4 dark:border-surface-800 dark:bg-surface-900"
      >
        <p class="text-xs text-surface-500">{{ balanceName(b) }}</p>
        <p class="mt-1 text-2xl font-semibold text-surface-900 dark:text-white" dir="ltr">{{ balanceValue(b) }}</p>
        <p class="text-xs text-surface-400">{{ t('myLeaves.days') }}</p>
      </div>
    </div>

    <!-- طلباتي -->
    <div class="overflow-hidden rounded-2xl border border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
      <div class="border-b border-surface-100 px-4 py-3 dark:border-surface-800">
        <h2 class="text-sm font-semibold text-surface-700 dark:text-surface-200">{{ t('myLeaves.requestsTitle') }}</h2>
      </div>
      <DataTable :value="requests" :loading="loading" paginator :rows="12" :rows-per-page-options="[12, 24, 48]" data-key="id" striped-rows removable-sort>
        <template #empty>
          <p class="py-6 text-center text-sm text-surface-500">{{ t('myLeaves.empty') }}</p>
        </template>
        <Column :header="t('myLeaves.type')">
          <template #body="{ data }"><span class="font-medium text-surface-900 dark:text-white">{{ typeName(data) }}</span></template>
        </Column>
        <Column field="start_at" :header="t('myLeaves.from')" sortable>
          <template #body="{ data }"><span class="text-surface-500" dir="ltr">{{ ymd(data.start_at) }}</span></template>
        </Column>
        <Column field="end_at" :header="t('myLeaves.to')" sortable>
          <template #body="{ data }"><span class="text-surface-500" dir="ltr">{{ ymd(data.end_at) }}</span></template>
        </Column>
        <Column :header="t('myLeaves.amount')">
          <template #body="{ data }">
            <span class="text-surface-500" dir="ltr">
              {{ data.hours ? `${data.hours} ${t('myLeaves.hoursUnit')}` : data.days ? `${data.days} ${t('myLeaves.days')}` : '—' }}
            </span>
          </template>
        </Column>
        <Column :header="t('myLeaves.statusCol')">
          <template #body="{ data }"><Tag :value="statusLabel(data.status)" :severity="statusSeverity(data.status)" /></template>
        </Column>
      </DataTable>
    </div>

    <!-- نموذج التقديم -->
    <Dialog
      v-model:visible="form.open"
      modal
      :header="t('myLeaves.submit')"
      :style="{ width: '34rem' }"
      :breakpoints="{ '640px': '95vw' }"
    >
      <form class="grid gap-4 pt-2 sm:grid-cols-2" @submit.prevent="submit">
        <label class="block text-sm sm:col-span-2">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('myLeaves.type') }}</span>
          <Select v-model.number="form.leave_type_id" :options="types" option-label="name" option-value="id" :placeholder="t('myLeaves.selectType')" fluid />
        </label>

        <!-- زمنية (hourly): تاريخ واحد + وقتان -->
        <template v-if="isHourly">
          <label class="block text-sm sm:col-span-2">
            <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('myLeaves.date') }}</span>
            <input v-model="form.start_at" type="date" required class="field" />
          </label>
          <label class="block text-sm">
            <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('myLeaves.startTime') }}</span>
            <Select v-model="form.start_time" :options="timeOptions" fluid />
          </label>
          <label class="block text-sm">
            <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('myLeaves.endTime') }}</span>
            <Select v-model="form.end_time" :options="timeOptions" fluid />
          </label>
          <p v-if="hourCount > 0 && !validationError" class="text-xs text-surface-500 sm:col-span-2">
            {{ t('myLeaves.hoursComputed', { n: hourCount }) }}
          </p>
        </template>

        <!-- يومية/طويلة/مرضية: مدى تواريخ -->
        <template v-else>
          <label class="block text-sm">
            <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('myLeaves.from') }}</span>
            <input v-model="form.start_at" type="date" required class="field" />
          </label>
          <label class="block text-sm">
            <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('myLeaves.to') }}</span>
            <input v-model="form.end_at" type="date" required class="field" />
          </label>
          <p v-if="dayCount > 0 && !validationError" class="text-xs text-surface-500 sm:col-span-2">
            {{ t('myLeaves.daysComputed', { n: dayCount }) }}
          </p>
        </template>

        <label class="block text-sm sm:col-span-2">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('myLeaves.reason') }}</span>
          <Textarea v-model="form.reason" rows="2" :maxlength="500" auto-resize fluid />
        </label>

        <Message v-if="validationError" severity="warn" :closable="false" class="sm:col-span-2">{{ validationError }}</Message>

        <div class="mt-2 flex justify-end gap-2 sm:col-span-2">
          <Button type="button" :label="t('common.cancel')" severity="secondary" text @click="form.open = false" />
          <Button type="submit" :label="saving ? t('common.saving') : t('myLeaves.submit')" icon="pi pi-check" :loading="saving" :disabled="!canSubmit" />
        </div>
      </form>
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
