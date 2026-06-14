<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import PageHeader from '@/components/PageHeader.vue'
import { ApiException } from '@/api/client'
import { shiftSwapsApi, type ShiftSwap, type ShiftSwapStatus, type SwapSchedule } from '@/api/shiftSwaps'

const { t } = useI18n()
const confirm = useConfirm()
const toast = useToast()

function messageFor(e: unknown, fallback: string): string {
  return e instanceof ApiException ? e.message : fallback
}
function notifyError(e: unknown, fallback: string): void {
  toast.add({ severity: 'error', summary: t('common.error'), detail: messageFor(e, fallback), life: 4000 })
}

const hhmm = (time?: string | null) => (time ? time.slice(0, 5) : '')
const weekdayNames = ['days.sun', 'days.mon', 'days.tue', 'days.wed', 'days.thu', 'days.fri', 'days.sat']

// تمثيل مقروء لجدول وردية: «اسم الوردية — التاريخ/اليوم (الوقت)».
function scheduleLabel(s?: SwapSchedule | null): string {
  if (!s) return '—'
  const parts: string[] = []
  if (s.shift?.name) parts.push(s.shift.name)
  if (s.work_date) parts.push(s.work_date.slice(0, 10))
  else if (s.weekday !== null && s.weekday !== undefined && weekdayNames[s.weekday]) parts.push(t(weekdayNames[s.weekday]))
  const time = s.shift ? `${hhmm(s.shift.start_time)}–${hhmm(s.shift.end_time)}`.replace(/^–$/, '') : ''
  const head = parts.join(' — ') || `#${s.id}`
  return time ? `${head} (${time})` : head
}

const filters = reactive({ status: '' as '' | ShiftSwapStatus })
const statusOptions = [
  { value: '', label: 'shiftSwaps.allStatuses' },
  { value: 'pending', label: 'shiftSwaps.statusPending' },
  { value: 'approved', label: 'shiftSwaps.statusApproved' },
  { value: 'rejected', label: 'shiftSwaps.statusRejected' },
]

const rows = ref<ShiftSwap[]>([])
const total = ref(0)
const loading = ref(false)
const loaded = ref(false)
const actingId = ref<number | null>(null)

const requesterName = (e: ShiftSwap) => e.requester?.name ?? `#${e.requester_id}`
const colleagueName = (e: ShiftSwap) => e.with_user?.name ?? `#${e.with_user_id}`
const isGiveAway = (e: ShiftSwap) => e.with_schedule_id === null || e.with_schedule_id === undefined

function statusSeverity(s: ShiftSwapStatus): 'warn' | 'success' | 'danger' {
  return s === 'approved' ? 'success' : s === 'rejected' ? 'danger' : 'warn'
}
function statusLabel(s: ShiftSwapStatus): string {
  return t('shiftSwaps.status' + s.charAt(0).toUpperCase() + s.slice(1))
}

async function run(): Promise<void> {
  loading.value = true
  try {
    const res = await shiftSwapsApi.list(filters.status ? { status: filters.status } : {})
    rows.value = res.data
    total.value = res.pagination?.total ?? res.data.length
    loaded.value = true
  } catch (e) {
    notifyError(e, t('common.loadError'))
  } finally {
    loading.value = false
  }
}

function decide(e: ShiftSwap, approve: boolean): void {
  confirm.require({
    message: approve ? t('shiftSwaps.confirmApprove') : t('shiftSwaps.confirmReject'),
    header: approve ? t('shiftSwaps.approve') : t('shiftSwaps.reject'),
    icon: 'pi pi-question-circle',
    acceptProps: { severity: approve ? 'success' : 'danger', label: approve ? t('shiftSwaps.approve') : t('shiftSwaps.reject') },
    rejectProps: { severity: 'secondary', outlined: true, label: t('common.cancel') },
    accept: async () => {
      actingId.value = e.id
      try {
        await (approve ? shiftSwapsApi.approve(e.id) : shiftSwapsApi.reject(e.id))
        toast.add({ severity: 'success', summary: approve ? t('shiftSwaps.approved') : t('shiftSwaps.rejected'), life: 2500 })
        await run()
      } catch (err) {
        notifyError(err, t('common.saveError'))
      } finally {
        actingId.value = null
      }
    },
  })
}

onMounted(run)
</script>

<template>
  <div class="mx-auto max-w-6xl">
    <PageHeader :title="t('shiftSwaps.title')" :subtitle="t('shiftSwaps.subtitle')" />

    <!-- فلتر الحالة -->
    <div class="mb-6 rounded-2xl border border-surface-200 bg-white p-4 dark:border-surface-800 dark:bg-surface-900">
      <div class="flex flex-wrap items-end gap-4">
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('shiftSwaps.status') }}</span>
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
        <h2 class="text-sm font-semibold text-surface-700 dark:text-surface-200">{{ t('shiftSwaps.recordTitle') }}</h2>
        <span class="text-xs text-surface-500">{{ t('reports.rowsCount', { n: total }) }}</span>
      </div>
      <DataTable :value="rows" paginator :rows="15" :rows-per-page-options="[15, 30, 50]" data-key="id" striped-rows>
        <template #empty>
          <p class="py-6 text-center text-sm text-surface-500">{{ t('shiftSwaps.empty') }}</p>
        </template>

        <Column :header="t('shiftSwaps.requester')">
          <template #body="{ data }"><span class="font-medium text-surface-900 dark:text-white">{{ requesterName(data) }}</span></template>
        </Column>
        <Column :header="t('shiftSwaps.myShift')">
          <template #body="{ data }"><span class="text-surface-500">{{ scheduleLabel(data.my_schedule) }}</span></template>
        </Column>
        <Column :header="t('shiftSwaps.colleague')">
          <template #body="{ data }"><span class="text-surface-500">{{ colleagueName(data) }}</span></template>
        </Column>
        <Column :header="t('shiftSwaps.colleagueShift')">
          <template #body="{ data }">
            <Tag v-if="isGiveAway(data)" :value="t('shiftSwaps.giveAway')" severity="info" />
            <span v-else class="text-surface-500">{{ scheduleLabel(data.with_schedule) }}</span>
          </template>
        </Column>
        <Column :header="t('shiftSwaps.note')">
          <template #body="{ data }"><span class="text-surface-500">{{ data.note || '—' }}</span></template>
        </Column>
        <Column :header="t('shiftSwaps.statusCol')">
          <template #body="{ data }"><Tag :value="statusLabel(data.status)" :severity="statusSeverity(data.status)" /></template>
        </Column>
        <Column :header="t('companies.actions')" class="text-end">
          <template #body="{ data }">
            <div v-if="data.status === 'pending'" class="flex justify-end gap-1">
              <Button
                v-can="'shift_swaps.approve'"
                v-tooltip.top="t('shiftSwaps.approve')"
                icon="pi pi-check"
                severity="success"
                text
                rounded
                :loading="actingId === data.id"
                @click="decide(data, true)"
              />
              <Button
                v-can="'shift_swaps.approve'"
                v-tooltip.top="t('shiftSwaps.reject')"
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
  </div>
</template>
