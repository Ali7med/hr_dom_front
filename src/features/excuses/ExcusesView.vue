<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import Tag from 'primevue/tag'
import Dialog from '@/components/AppDialog.vue'
import PageHeader from '@/components/PageHeader.vue'
import { ApiException } from '@/api/client'
import { excusesApi, type Excuse, type ExcuseStatus } from '@/api/excuses'
import { departmentsApi, usersApi, type Department, type User } from '@/api/users'

const { t } = useI18n()
const confirm = useConfirm()
const toast = useToast()

function messageFor(e: unknown, fallback: string): string {
  return e instanceof ApiException ? e.message : fallback
}
function notifyError(e: unknown, fallback: string): void {
  toast.add({ severity: 'error', summary: t('common.error'), detail: messageFor(e, fallback), life: 4000 })
}

const hhmm = (time?: string | null) => (time ? time.slice(0, 5) : '—')
const ymd = (d?: string | null) => (d ? d.slice(0, 10) : '—')

// ===== الفلاتر + السجل =====
const filters = reactive({
  from: '',
  to: '',
  department_id: 0,
  status: '' as '' | ExcuseStatus,
})
const statusOptions = [
  { value: '', label: 'excuses.allStatuses' },
  { value: 'pending', label: 'excuses.statusPending' },
  { value: 'approved', label: 'excuses.statusApproved' },
  { value: 'rejected', label: 'excuses.statusRejected' },
]

const departments = ref<Department[]>([])
const users = ref<User[]>([])
const excuses = ref<Excuse[]>([])
const total = ref(0)
const loading = ref(false)
const loaded = ref(false)
const actingId = ref<number | null>(null)

const employeeName = (e: Excuse) => e.user?.name ?? `#${e.user_id}`
const departmentName = (e: Excuse) =>
  e.department?.name ?? departments.value.find((d) => d.id === e.department_id)?.name ?? '—'

function statusSeverity(s: ExcuseStatus): 'warn' | 'success' | 'danger' {
  return s === 'approved' ? 'success' : s === 'rejected' ? 'danger' : 'warn'
}
function statusLabel(s: ExcuseStatus): string {
  return t('excuses.status' + s.charAt(0).toUpperCase() + s.slice(1))
}

function buildParams(): Record<string, unknown> {
  const p: Record<string, unknown> = {}
  if (filters.from) p.from = filters.from
  if (filters.to) p.to = filters.to
  if (filters.department_id) p.department_id = filters.department_id
  if (filters.status) p.status = filters.status
  return p
}

async function run(): Promise<void> {
  loading.value = true
  try {
    const res = await excusesApi.list(buildParams())
    excuses.value = res.data
    total.value = res.pagination?.total ?? res.data.length
    loaded.value = true
  } catch (e) {
    notifyError(e, t('common.loadError'))
  } finally {
    loading.value = false
  }
}

function decide(e: Excuse, approve: boolean): void {
  confirm.require({
    message: approve ? t('excuses.confirmApprove') : t('excuses.confirmReject'),
    header: approve ? t('excuses.approve') : t('excuses.reject'),
    icon: 'pi pi-question-circle',
    acceptProps: { severity: approve ? 'success' : 'danger', label: approve ? t('excuses.approve') : t('excuses.reject') },
    rejectProps: { severity: 'secondary', outlined: true, label: t('common.cancel') },
    accept: async () => {
      actingId.value = e.id
      try {
        await (approve ? excusesApi.approve(e.id) : excusesApi.reject(e.id))
        toast.add({ severity: 'success', summary: approve ? t('excuses.approved') : t('excuses.rejected'), life: 2500 })
        await run()
      } catch (err) {
        notifyError(err, t('common.saveError'))
      } finally {
        actingId.value = null
      }
    },
  })
}

// ===== تقديم بالنيابة =====
const form = reactive({
  open: false,
  user_id: 0,
  date: '',
  start_time: '10:00',
  end_time: '12:00',
  reason: '',
})
const saving = ref(false)
function openForm(): void {
  form.open = true
  form.user_id = users.value[0]?.id ?? 0
  form.date = ''
  form.start_time = '10:00'
  form.end_time = '12:00'
  form.reason = ''
}
async function submit(): Promise<void> {
  if (!form.user_id || !form.date || !form.reason.trim()) return
  if (form.end_time <= form.start_time) {
    toast.add({ severity: 'warn', summary: t('common.error'), detail: t('excuses.endAfterStart'), life: 4000 })
    return
  }
  saving.value = true
  try {
    await excusesApi.create({
      user_id: form.user_id,
      date: form.date,
      start_time: form.start_time,
      end_time: form.end_time,
      reason: form.reason.trim(),
    })
    form.open = false
    toast.add({ severity: 'success', summary: t('excuses.submitted'), life: 2500 })
    await run()
  } catch (e) {
    notifyError(e, t('common.saveError'))
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  try {
    const [deps, us] = await Promise.all([departmentsApi.list(), usersApi.list({ per_page: 100 })])
    departments.value = deps
    users.value = us.data
  } catch {
    // الفلاتر/القائمة اختيارية.
  }
  await run()
})
</script>

<template>
  <div class="mx-auto max-w-5xl">
    <PageHeader :title="t('excuses.title')" :subtitle="t('excuses.subtitle')">
      <template #actions>
        <Button
          v-can="'excuses.view'"
          icon="pi pi-plus"
          :label="t('excuses.submitOnBehalf')"
          @click="openForm"
        />
      </template>
    </PageHeader>

    <!-- الفلاتر -->
    <div class="mb-6 rounded-2xl border border-surface-200 bg-white p-4 dark:border-surface-800 dark:bg-surface-900">
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('excuses.status') }}</span>
          <Select v-model="filters.status" :options="statusOptions" option-value="value" fluid>
            <template #value="{ value }">{{ t(statusOptions.find((o) => o.value === value)?.label ?? '') }}</template>
            <template #option="{ option }">{{ t(option.label) }}</template>
          </Select>
        </label>
      </div>
      <div class="mt-4">
        <Button icon="pi pi-search" :label="loading ? t('common.loading') : t('excuses.search')" :loading="loading" :disabled="loading" @click="run" />
      </div>
    </div>

    <!-- السجل -->
    <div v-if="loaded" class="overflow-hidden rounded-2xl border border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
      <div class="flex items-center justify-between border-b border-surface-100 px-4 py-3 dark:border-surface-800">
        <h2 class="text-sm font-semibold text-surface-700 dark:text-surface-200">{{ t('excuses.recordTitle') }}</h2>
        <span class="text-xs text-surface-500">{{ t('reports.rowsCount', { n: total }) }}</span>
      </div>
      <DataTable :value="excuses" paginator :rows="15" :rows-per-page-options="[15, 30, 50]" data-key="id" striped-rows removable-sort>
        <template #empty>
          <p class="py-6 text-center text-sm text-surface-500">{{ t('excuses.empty') }}</p>
        </template>

        <Column :header="t('excuses.employee')">
          <template #body="{ data }"><span class="font-medium text-surface-900 dark:text-white">{{ employeeName(data) }}</span></template>
        </Column>
        <Column :header="t('excuses.department')">
          <template #body="{ data }"><span class="text-surface-500">{{ departmentName(data) }}</span></template>
        </Column>
        <Column field="date" :header="t('excuses.date')" sortable>
          <template #body="{ data }"><span class="text-surface-500" dir="ltr">{{ ymd(data.date) }}</span></template>
        </Column>
        <Column :header="t('excuses.time')">
          <template #body="{ data }"><span class="text-surface-500" dir="ltr">{{ hhmm(data.start_time) }} – {{ hhmm(data.end_time) }}</span></template>
        </Column>
        <Column :header="t('excuses.reason')">
          <template #body="{ data }"><span class="text-surface-500">{{ data.reason }}</span></template>
        </Column>
        <Column :header="t('excuses.statusCol')">
          <template #body="{ data }"><Tag :value="statusLabel(data.status)" :severity="statusSeverity(data.status)" /></template>
        </Column>
        <Column :header="t('companies.actions')" class="text-end">
          <template #body="{ data }">
            <div v-if="data.status === 'pending'" class="flex justify-end gap-1">
              <Button
                v-can="'excuses.approve'"
                v-tooltip.top="t('excuses.approve')"
                icon="pi pi-check"
                severity="success"
                text
                rounded
                :loading="actingId === data.id"
                @click="decide(data, true)"
              />
              <Button
                v-can="'excuses.approve'"
                v-tooltip.top="t('excuses.reject')"
                icon="pi pi-times"
                severity="danger"
                text
                rounded
                :loading="actingId === data.id"
                @click="decide(data, false)"
              />
            </div>
            <span v-else class="text-xs text-surface-400">—</span>
          </template>
        </Column>
      </DataTable>
    </div>

    <!-- تقديم بالنيابة -->
    <Dialog
      v-model:visible="form.open"
      modal
      :header="t('excuses.submitOnBehalf')"
      :style="{ width: '34rem' }"
      :breakpoints="{ '640px': '95vw' }"
    >
      <form class="grid gap-4 pt-2 sm:grid-cols-2" @submit.prevent="submit">
        <label class="block text-sm sm:col-span-2">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('excuses.employee') }}</span>
          <Select v-model.number="form.user_id" :options="users" option-label="name" option-value="id" filter fluid />
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('excuses.date') }}</span>
          <input v-model="form.date" type="date" required class="field" />
        </label>
        <div class="grid grid-cols-2 gap-3">
          <label class="block text-sm">
            <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('excuses.start') }}</span>
            <input v-model="form.start_time" type="time" required class="field" />
          </label>
          <label class="block text-sm">
            <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('excuses.end') }}</span>
            <input v-model="form.end_time" type="time" required class="field" />
          </label>
        </div>
        <label class="block text-sm sm:col-span-2">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('excuses.reason') }}</span>
          <Textarea v-model="form.reason" rows="3" :maxlength="500" auto-resize fluid />
        </label>
        <div class="mt-2 flex justify-end gap-2 sm:col-span-2">
          <Button type="button" :label="t('common.cancel')" severity="secondary" text @click="form.open = false" />
          <Button type="submit" :label="saving ? t('common.saving') : t('excuses.submit')" icon="pi pi-check" :loading="saving" :disabled="!form.user_id || !form.date || !form.reason.trim()" />
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
