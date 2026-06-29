<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Dialog from '@/components/AppDialog.vue'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import DatePicker from 'primevue/datepicker'
import Checkbox from 'primevue/checkbox'
import Tag from 'primevue/tag'
import Message from 'primevue/message'
import { ApiException } from '@/api/client'
import {
  leaveTypesApi,
  leavesApi,
  leaveBalancesApi,
  type LeaveType,
  type LeaveRequest,
  type LeaveBalance,
  type LeaveStatus,
  type LeaveKind,
  type LeaveRequestPayload,
} from '@/api/leaves'
import { usersApi, type User } from '@/api/users'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import PageHeader from '@/components/PageHeader.vue'

const { t } = useI18n()
const auth = useAuthStore()
const ui = useUiStore()
const confirm = useConfirm()
const toast = useToast()

type Tab = 'requests' | 'types' | 'balances'
const tab = ref<Tab>('requests')

const saving = ref(false)
const acting = ref<number | null>(null)
const loadingRequests = ref(false)
const loadingTypes = ref(false)
const loadingBalances = ref(false)

const types = ref<LeaveType[]>([])
const requests = ref<LeaveRequest[]>([])
const users = ref<User[]>([])

function messageFor(e: unknown, fallback: string): string {
  return e instanceof ApiException ? e.message : fallback
}
function notifyError(e: unknown, fallback: string): void {
  toast.add({ severity: 'error', summary: t('common.error'), detail: messageFor(e, fallback), life: 4000 })
}
const ymd = (date: string | null) => (date ? date.slice(0, 10) : '—')
const userName = (id: number) => users.value.find((u) => u.id === id)?.name ?? `#${id}`
const typeName = (id: number) => types.value.find((x) => x.id === id)?.name ?? `#${id}`

const statusSeverity: Record<LeaveStatus, 'warn' | 'success' | 'danger' | 'secondary'> = {
  pending: 'warn',
  approved: 'success',
  rejected: 'danger',
  auto: 'secondary',
}

// ===== عرض المدّة حسب النوع + مُقدّم الطلب (FE-54) =====
const kindSeverity: Record<LeaveKind, 'info' | 'success' | 'warn' | 'danger'> = {
  hourly: 'info',
  daily: 'success',
  long: 'warn',
  sick: 'danger',
}

const localeTag = () => (ui.locale === 'ar' ? 'ar-u-nu-latn' : 'en')

function toNum(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

// "HH:mm" — يُفضّل start_time/end_time إن وُجدا، وإلا يُشتقّ من datetime في start_at/end_at
function timePart(explicit: string | null | undefined, dt: string | null | undefined): string {
  if (explicit) {
    const hm = explicit.match(/(\d{1,2}):(\d{2})/)
    if (hm) return `${hm[1].padStart(2, '0')}:${hm[2]}`
  }
  if (dt) {
    const d = new Date(dt)
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleTimeString(localeTag(), { hour: '2-digit', minute: '2-digit', hour12: false })
    }
  }
  return '—'
}

function durationFor(row: LeaveRequest): string {
  const kind = row.leave_type?.kind
  if (kind === 'hourly') {
    const date = ymd(row.start_at)
    const from = timePart(row.start_time, row.start_at)
    const to = timePart(row.end_time, row.end_at)
    const hours = toNum(row.hours)
    return t('leaves.durationHourly', { date, from, to, hours: hours ?? '—' })
  }
  const from = ymd(row.start_at)
  const to = ymd(row.end_at)
  const days = toNum(row.days)
  return t('leaves.durationRange', { from, to, days: days ?? '—' })
}

function submitterName(row: LeaveRequest): string {
  if (row.creator?.name && row.creator.id !== row.user_id) return row.creator.name
  return t('leaves.selfSubmitted')
}

function submittedAt(row: LeaveRequest): string {
  if (!row.created_at) return '—'
  const d = new Date(row.created_at)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString(localeTag(), {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

async function loadTypes(): Promise<void> {
  loadingTypes.value = true
  try {
    types.value = await leaveTypesApi.list()
  } finally {
    loadingTypes.value = false
  }
}
async function loadUsers(): Promise<void> {
  if (users.value.length) return
  users.value = (await usersApi.list({ per_page: 100 })).data
}

// ===== طلبات الإجازة =====
const statusFilter = ref<'' | LeaveStatus>('')
const statusOptions = computed(() => [
  { label: t('leaves.allStatuses'), value: '' },
  { label: t('leaveStatus.pending'), value: 'pending' },
  { label: t('leaveStatus.approved'), value: 'approved' },
  { label: t('leaveStatus.rejected'), value: 'rejected' },
])
async function loadRequests(): Promise<void> {
  loadingRequests.value = true
  try {
    const params = statusFilter.value ? { status: statusFilter.value } : {}
    requests.value = (await leavesApi.list(params)).data
  } catch (e) {
    notifyError(e, t('common.loadError'))
  } finally {
    loadingRequests.value = false
  }
}
async function decide(r: LeaveRequest, approve: boolean): Promise<void> {
  const msg = approve ? 'leaves.confirmApprove' : 'leaves.confirmReject'
  confirm.require({
    message: t(msg, { name: r.user?.name ?? userName(r.user_id) }),
    header: approve ? t('leaves.approve') : t('leaves.reject'),
    icon: 'pi pi-exclamation-triangle',
    rejectProps: { severity: 'secondary', outlined: true, label: t('common.cancel') },
    acceptProps: approve
      ? { severity: 'success', label: t('leaves.approve') }
      : { severity: 'danger', label: t('leaves.reject') },
    accept: async () => {
      acting.value = r.id
      try {
        if (approve) await leavesApi.approve(r.id)
        else await leavesApi.reject(r.id)
        toast.add({ severity: 'success', summary: t('common.saved'), life: 2500 })
        await loadRequests()
      } catch (e) {
        notifyError(e, t('common.saveError'))
      } finally {
        acting.value = null
      }
    },
  })
}

const reqForm = reactive({ open: false, user_id: 0, leave_type_id: 0, start_at: '', end_at: '', start_time: '', end_time: '' })

// ===== الواجهة الشرطية حسب نوع الإجازة (FE-18) =====
const selectedReqType = computed(() => types.value.find((x) => x.id === reqForm.leave_type_id) ?? null)
const isHourlyReq = computed(() => selectedReqType.value?.kind === 'hourly')

function toHHmm(s: string | null | undefined): string | null {
  return s ? s.slice(0, 5) : null
}
function hmToMin(s: string): number {
  const [h, m] = s.split(':').map(Number)
  return h * 60 + m
}
function minToHm(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}
function buildSlots(fromMin: number, toMin: number): string[] {
  const out: string[] = []
  for (let m = fromMin; m <= toMin; m += 30) out.push(minToHm(m))
  return out
}

// حدود النوع الزمني: نافذة الوقت المسموحة (افتراضي اليوم كامل) + أقصى ساعات/أيام.
const windowFromMin = computed(() => hmToMin(toHHmm(selectedReqType.value?.allowed_from) ?? '00:00'))
const windowToMin = computed(() => hmToMin(toHHmm(selectedReqType.value?.allowed_to) ?? '23:30'))
const maxHours = computed(() => {
  const v = selectedReqType.value?.max_hours_per_day
  return v == null ? null : Number(v)
})
const maxDays = computed(() => selectedReqType.value?.max_days_per_request ?? null)

// قوائم الوقت كل 30 دقيقة: البداية ضمن النافذة، والنهاية بعد البداية وضمن النافذة و≤ أقصى ساعات.
const startTimeOptions = computed(() => buildSlots(windowFromMin.value, windowToMin.value - 30))
const endTimeOptions = computed(() => {
  if (!reqForm.start_time) return []
  const startMin = hmToMin(reqForm.start_time)
  let cap = windowToMin.value
  if (maxHours.value != null) cap = Math.min(cap, startMin + maxHours.value * 60)
  return buildSlots(startMin + 30, cap)
})

const reqHours = computed(() =>
  reqForm.start_time && reqForm.end_time ? (hmToMin(reqForm.end_time) - hmToMin(reqForm.start_time)) / 60 : 0,
)
const reqDays = computed(() => {
  if (!reqForm.start_at || !reqForm.end_at) return 0
  return Math.floor((new Date(reqForm.end_at).getTime() - new Date(reqForm.start_at).getTime()) / 86400000) + 1
})

// خطأ تجاوز حدّ النوع (يعطّل الإرسال).
const reqLimitError = computed<string | null>(() => {
  if (!selectedReqType.value) return null
  if (isHourlyReq.value) {
    if (reqForm.start_time && reqForm.end_time && hmToMin(reqForm.end_time) <= hmToMin(reqForm.start_time))
      return t('leaves.endTimeAfterStart')
    if (maxHours.value != null && reqHours.value > maxHours.value) return t('leaves.maxHoursError', { n: maxHours.value })
  } else {
    if (reqForm.start_at && reqForm.end_at && reqForm.end_at < reqForm.start_at) return t('leaves.endAfterStart')
    if (maxDays.value != null && reqDays.value > maxDays.value) return t('leaves.maxDaysError', { n: maxDays.value })
  }
  return null
})

// نصّ حدود النوع للعرض.
const reqLimitHint = computed(() => {
  const ty = selectedReqType.value
  if (!ty) return ''
  if (isHourlyReq.value) {
    const parts: string[] = []
    if (ty.allowed_from && ty.allowed_to) parts.push(`${toHHmm(ty.allowed_from)}–${toHHmm(ty.allowed_to)}`)
    if (maxHours.value != null) parts.push(t('leaves.maxHoursHint', { n: maxHours.value }))
    return parts.join(' · ')
  }
  return maxDays.value != null ? t('leaves.maxDaysHint', { n: maxDays.value }) : ''
})

// عند تبديل النوع: صفّر الأوقات/التواريخ. وعند تبديل وقت البداية: ألغِ نهاية صارت خارج الخيارات.
watch(
  () => reqForm.leave_type_id,
  () => {
    reqForm.start_time = ''
    reqForm.end_time = ''
  },
)
watch(
  () => reqForm.start_time,
  () => {
    if (reqForm.end_time && !endTimeOptions.value.includes(reqForm.end_time)) reqForm.end_time = ''
  },
)
const reqStartDate = computed({
  get: () => (reqForm.start_at ? new Date(reqForm.start_at) : null),
  set: (d: Date | null) => {
    reqForm.start_at = d ? toYmd(d) : ''
  },
})
const reqEndDate = computed({
  get: () => (reqForm.end_at ? new Date(reqForm.end_at) : null),
  set: (d: Date | null) => {
    reqForm.end_at = d ? toYmd(d) : ''
  },
})
function toYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function openRequest(): void {
  reqForm.open = true
  reqForm.user_id = users.value[0]?.id ?? 0
  reqForm.leave_type_id = types.value[0]?.id ?? 0
  reqForm.start_at = ''
  reqForm.end_at = ''
  reqForm.start_time = ''
  reqForm.end_time = ''
}
async function submitRequest(): Promise<void> {
  if (reqLimitError.value) {
    toast.add({ severity: 'warn', summary: reqLimitError.value, life: 3000 })
    return
  }
  saving.value = true
  try {
    const payload: LeaveRequestPayload = {
      user_id: reqForm.user_id,
      leave_type_id: reqForm.leave_type_id,
      start_at: reqForm.start_at,
      // الزمنية: نفس اليوم (start_at)؛ غيرها: «من»/«إلى».
      end_at: isHourlyReq.value ? reqForm.start_at : reqForm.end_at,
      source: 'panel',
    }
    if (isHourlyReq.value) {
      payload.start_time = reqForm.start_time
      payload.end_time = reqForm.end_time
    }
    await leavesApi.create(payload)
    reqForm.open = false
    toast.add({ severity: 'success', summary: t('common.saved'), life: 2500 })
    await loadRequests()
  } catch (e) {
    notifyError(e, t('common.saveError'))
  } finally {
    saving.value = false
  }
}
const canCreateRequest = computed(() => users.value.length > 0 && types.value.length > 0)

// ===== أنواع الإجازات =====
const typeForm = reactive({
  open: false,
  id: null as number | null,
  name: '',
  kind: 'daily' as LeaveType['kind'],
  needs_approval: true,
  affects_balance: 'normal' as NonNullable<LeaveType['affects_balance']>,
  is_paid: true,
  max_days_per_request: null as number | null,
  max_hours_per_day: null as number | null,
  allowed_from: '' as string,
  allowed_to: '' as string,
})

// محرّرا الوقت (HH:mm) لحقلي «مسموح من»/«مسموح إلى» — DatePicker يعمل بـ Date فقط
function timeStrToDate(s: string): Date | null {
  if (!s) return null
  const [h, m] = s.split(':').map((n) => Number(n))
  if (Number.isNaN(h) || Number.isNaN(m)) return null
  const d = new Date()
  d.setHours(h, m, 0, 0)
  return d
}
function dateToTimeStr(d: Date | null): string {
  if (!d) return ''
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
const allowedFromTime = computed({
  get: () => timeStrToDate(typeForm.allowed_from),
  set: (d: Date | null) => {
    typeForm.allowed_from = dateToTimeStr(d)
  },
})
const allowedToTime = computed({
  get: () => timeStrToDate(typeForm.allowed_to),
  set: (d: Date | null) => {
    typeForm.allowed_to = dateToTimeStr(d)
  },
})
const kindOptions = computed(() => [
  { label: t('leaveKind.hourly'), value: 'hourly' },
  { label: t('leaveKind.daily'), value: 'daily' },
  { label: t('leaveKind.long'), value: 'long' },
  { label: t('leaveKind.sick'), value: 'sick' },
])
const affectsBalanceOptions = computed(() => [
  { label: t('leaveBalanceType.normal'), value: 'normal' },
  { label: t('leaveBalanceType.sick'), value: 'sick' },
  { label: t('leaves.affectsNone'), value: 'none' },
])
function openType(x?: LeaveType): void {
  typeForm.open = true
  typeForm.id = x?.id ?? null
  typeForm.name = x?.name ?? ''
  typeForm.kind = x?.kind ?? 'daily'
  typeForm.needs_approval = x?.needs_approval ?? true
  typeForm.affects_balance = x?.affects_balance ?? 'normal'
  typeForm.is_paid = x?.is_paid ?? true
  typeForm.max_days_per_request = x?.max_days_per_request ?? null
  typeForm.max_hours_per_day = x?.max_hours_per_day ?? null
  typeForm.allowed_from = x?.allowed_from ?? ''
  typeForm.allowed_to = x?.allowed_to ?? ''
}
async function submitType(): Promise<void> {
  // تحقّق العميل: allowed_to > allowed_from (للنوع hourly عند ضبط الاثنين)
  if (
    typeForm.kind === 'hourly' &&
    typeForm.allowed_from &&
    typeForm.allowed_to &&
    typeForm.allowed_to <= typeForm.allowed_from
  ) {
    notifyError(null, t('leaves.allowedRangeInvalid'))
    return
  }
  saving.value = true
  try {
    const isHourly = typeForm.kind === 'hourly'
    const payload = {
      name: typeForm.name,
      kind: typeForm.kind,
      needs_approval: typeForm.needs_approval,
      affects_balance: typeForm.affects_balance,
      is_paid: typeForm.is_paid,
      max_days_per_request: isHourly ? null : typeForm.max_days_per_request,
      max_hours_per_day: isHourly ? typeForm.max_hours_per_day : null,
      allowed_from: isHourly ? typeForm.allowed_from || null : null,
      allowed_to: isHourly ? typeForm.allowed_to || null : null,
    }
    if (typeForm.id === null) await leaveTypesApi.create(payload)
    else await leaveTypesApi.update(typeForm.id, payload)
    typeForm.open = false
    toast.add({ severity: 'success', summary: t('common.saved'), life: 2500 })
    await loadTypes()
  } catch (e) {
    notifyError(e, t('common.saveError'))
  } finally {
    saving.value = false
  }
}
async function removeType(x: LeaveType): Promise<void> {
  confirm.require({
    message: t('leaves.confirmDeleteType', { name: x.name }),
    header: t('common.delete'),
    icon: 'pi pi-exclamation-triangle',
    rejectProps: { severity: 'secondary', outlined: true, label: t('common.cancel') },
    acceptProps: { severity: 'danger', label: t('common.delete') },
    accept: async () => {
      try {
        await leaveTypesApi.remove(x.id)
        toast.add({ severity: 'success', summary: t('common.deleted'), life: 2500 })
        await loadTypes()
      } catch (e) {
        notifyError(e, t('common.saveError'))
      }
    },
  })
}

// ===== الأرصدة =====
const balanceUserId = ref(0)
const balances = ref<LeaveBalance[]>([])
const balForm = reactive({ balance_type: 'normal' as 'normal' | 'sick', balance_days: 0, mode: 'set' as 'set' | 'increment' })
const balanceUserOptions = computed(() => [
  { label: t('leaves.chooseEmployee'), value: 0 },
  ...users.value.map((u) => ({ label: u.name, value: u.id })),
])
const balanceTypeOptions = computed(() => [
  { label: t('leaveBalanceType.normal'), value: 'normal' },
  { label: t('leaveBalanceType.sick'), value: 'sick' },
])
const modeOptions = computed(() => [
  { label: t('leaves.modeSet'), value: 'set' },
  { label: t('leaves.modeIncrement'), value: 'increment' },
])
async function loadBalances(): Promise<void> {
  if (!balanceUserId.value) {
    balances.value = []
    return
  }
  loadingBalances.value = true
  try {
    balances.value = await leaveBalancesApi.list(balanceUserId.value)
  } catch (e) {
    notifyError(e, t('common.loadError'))
  } finally {
    loadingBalances.value = false
  }
}
async function submitBalance(): Promise<void> {
  if (!balanceUserId.value) return
  saving.value = true
  try {
    await leaveBalancesApi.upsert(balanceUserId.value, {
      balance_type: balForm.balance_type,
      balance_days: balForm.balance_days,
      mode: balForm.mode,
    })
    toast.add({ severity: 'success', summary: t('common.saved'), life: 2500 })
    await loadBalances()
  } catch (e) {
    notifyError(e, t('common.saveError'))
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  try {
    await Promise.all([loadTypes(), loadUsers(), loadRequests()])
  } catch (e) {
    notifyError(e, t('common.loadError'))
  }
})
</script>

<template>
  <div class="mx-auto max-w-5xl">
    <PageHeader :title="t('leaves.title')" />

    <Tabs :value="tab" @update:value="(v) => (tab = v as Tab)">
      <TabList>
        <Tab value="requests">{{ t('leaves.tabRequests') }}</Tab>
        <Tab value="types">{{ t('leaves.tabTypes') }}</Tab>
        <Tab value="balances">{{ t('leaves.tabBalances') }}</Tab>
      </TabList>
      <TabPanels>
        <!-- ===== الطلبات ===== -->
        <TabPanel value="requests">
          <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
            <label class="flex items-center gap-2 text-sm">
              <span class="text-surface-500">{{ t('leaves.status') }}</span>
              <Select
                v-model="statusFilter"
                :options="statusOptions"
                option-label="label"
                option-value="value"
                @change="loadRequests"
              />
            </label>
            <Button
              v-if="auth.can('leaves.approve')"
              :label="t('leaves.newRequest')"
              icon="pi pi-plus"
              :disabled="!canCreateRequest"
              @click="openRequest"
            />
          </div>

          <div class="overflow-hidden rounded-2xl border border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
            <DataTable
              :value="requests"
              :loading="loadingRequests"
              paginator
              :rows="10"
              :rows-per-page-options="[10, 20, 50]"
              data-key="id"
              striped-rows
              removable-sort
            >
              <template #empty>
                <p class="py-6 text-center text-sm text-surface-500">{{ t('leaves.emptyRequests') }}</p>
              </template>

              <Column :header="t('leaves.employee')" sortable>
                <template #body="{ data }">
                  <span class="font-medium text-surface-900 dark:text-white">{{ data.user?.name ?? userName(data.user_id) }}</span>
                </template>
              </Column>
              <Column :header="t('leaves.type')">
                <template #body="{ data }">
                  <div class="flex items-center gap-2">
                    <span class="text-surface-700 dark:text-surface-300">{{ data.leave_type?.name ?? typeName(data.leave_type_id) }}</span>
                    <Tag
                      v-if="data.leave_type?.kind"
                      :value="t('leaveKind.' + data.leave_type.kind)"
                      :severity="kindSeverity[data.leave_type.kind as LeaveKind]"
                    />
                  </div>
                </template>
              </Column>
              <Column :header="t('leaves.period')">
                <template #body="{ data }">
                  <span class="text-surface-600 dark:text-surface-300" dir="ltr">{{ durationFor(data) }}</span>
                </template>
              </Column>
              <Column :header="t('leaves.submittedBy')">
                <template #body="{ data }">
                  <div class="flex items-center gap-2">
                    <span class="text-surface-600 dark:text-surface-300">{{ submitterName(data) }}</span>
                    <Tag
                      v-if="data.source"
                      :value="data.source === 'app' ? t('leaves.sourceApp') : t('leaves.sourcePanel')"
                      severity="secondary"
                    />
                  </div>
                </template>
              </Column>
              <Column :header="t('leaves.submittedAt')">
                <template #body="{ data }">
                  <span class="text-surface-500" dir="ltr">{{ submittedAt(data) }}</span>
                </template>
              </Column>
              <Column :header="t('leaves.status')">
                <template #body="{ data }">
                  <Tag :value="t('leaveStatus.' + data.status)" :severity="statusSeverity[data.status as LeaveStatus]" />
                </template>
              </Column>
              <Column :header="t('companies.actions')" class="text-end">
                <template #body="{ data }">
                  <div v-if="data.status === 'pending'" class="flex justify-end gap-1">
                    <Button
                      v-can="'leaves.approve'"
                      v-tooltip.top="t('leaves.approve')"
                      icon="pi pi-check"
                      severity="success"
                      text
                      rounded
                      :disabled="acting === data.id"
                      @click="decide(data, true)"
                    />
                    <Button
                      v-can="'leaves.approve'"
                      v-tooltip.top="t('leaves.reject')"
                      icon="pi pi-times"
                      severity="danger"
                      text
                      rounded
                      :disabled="acting === data.id"
                      @click="decide(data, false)"
                    />
                  </div>
                  <span v-else class="flex justify-end text-xs text-surface-400">—</span>
                </template>
              </Column>
            </DataTable>
          </div>
        </TabPanel>

        <!-- ===== الأنواع ===== -->
        <TabPanel value="types">
          <div class="mb-4 flex justify-end">
            <Button v-can="'leave_types.create'" :label="t('leaves.addType')" icon="pi pi-plus" @click="openType()" />
          </div>

          <div class="overflow-hidden rounded-2xl border border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
            <DataTable
              :value="types"
              :loading="loadingTypes"
              paginator
              :rows="10"
              :rows-per-page-options="[10, 20, 50]"
              data-key="id"
              striped-rows
              removable-sort
            >
              <template #empty>
                <p class="py-6 text-center text-sm text-surface-500">{{ t('leaves.emptyTypes') }}</p>
              </template>

              <Column field="name" :header="t('leaves.typeName')" sortable>
                <template #body="{ data }">
                  <span class="font-medium text-surface-900 dark:text-white">{{ data.name }}</span>
                </template>
              </Column>
              <Column :header="t('leaves.kind')">
                <template #body="{ data }">
                  <span class="text-surface-500">{{ t('leaveKind.' + data.kind) }}</span>
                </template>
              </Column>
              <Column :header="t('leaves.needsApproval')">
                <template #body="{ data }">
                  <span class="text-surface-500">{{ data.needs_approval ? t('common.yes') : t('common.no') }}</span>
                </template>
              </Column>
              <Column :header="t('leaves.isPaid')">
                <template #body="{ data }">
                  <span class="text-surface-500">{{ data.is_paid ? t('common.yes') : t('common.no') }}</span>
                </template>
              </Column>
              <Column :header="t('companies.actions')" class="text-end">
                <template #body="{ data }">
                  <div class="flex justify-end gap-1">
                    <Button
                      v-can="'leave_types.update'"
                      v-tooltip.top="t('common.edit')"
                      icon="pi pi-pencil"
                      severity="secondary"
                      text
                      rounded
                      @click="openType(data)"
                    />
                    <Button
                      v-can="'leave_types.delete'"
                      v-tooltip.top="t('common.delete')"
                      icon="pi pi-trash"
                      severity="danger"
                      text
                      rounded
                      @click="removeType(data)"
                    />
                  </div>
                </template>
              </Column>
            </DataTable>
          </div>
        </TabPanel>

        <!-- ===== الأرصدة ===== -->
        <TabPanel value="balances">
          <div class="mb-4 max-w-xs">
            <label class="block text-sm">
              <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('leaves.employee') }}</span>
              <Select
                v-model="balanceUserId"
                :options="balanceUserOptions"
                option-label="label"
                option-value="value"
                fluid
                @change="loadBalances"
              />
            </label>
          </div>

          <template v-if="balanceUserId">
            <div class="mb-6 overflow-hidden rounded-2xl border border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
              <DataTable
                :value="balances"
                :loading="loadingBalances"
                paginator
                :rows="10"
                :rows-per-page-options="[10, 20, 50]"
                data-key="id"
                striped-rows
                removable-sort
              >
                <template #empty>
                  <p class="py-6 text-center text-sm text-surface-500">{{ t('leaves.emptyBalances') }}</p>
                </template>

                <Column :header="t('leaves.balanceType')">
                  <template #body="{ data }">
                    <span class="font-medium text-surface-900 dark:text-white">{{ t('leaveBalanceType.' + data.balance_type) }}</span>
                  </template>
                </Column>
                <Column field="balance_days" :header="t('leaves.days')" sortable>
                  <template #body="{ data }">
                    <span class="text-surface-500">{{ data.balance_days }}</span>
                  </template>
                </Column>
              </DataTable>
            </div>

            <form
              v-can="'leaves.manage_balances'"
              class="space-y-4 rounded-2xl border border-surface-200 bg-white p-6 dark:border-surface-800 dark:bg-surface-900"
              @submit.prevent="submitBalance"
            >
              <h2 class="font-semibold">{{ t('leaves.setBalance') }}</h2>
              <div class="grid gap-4 sm:grid-cols-3">
                <label class="block text-sm">
                  <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('leaves.balanceType') }}</span>
                  <Select v-model="balForm.balance_type" :options="balanceTypeOptions" option-label="label" option-value="value" fluid />
                </label>
                <label class="block text-sm">
                  <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('leaves.days') }}</span>
                  <InputNumber v-model="balForm.balance_days" :min="0" :step="0.5" :min-fraction-digits="0" :max-fraction-digits="2" show-buttons fluid />
                </label>
                <label class="block text-sm">
                  <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('leaves.mode') }}</span>
                  <Select v-model="balForm.mode" :options="modeOptions" option-label="label" option-value="value" fluid />
                </label>
              </div>
              <Button type="submit" :label="saving ? t('common.saving') : t('common.save')" icon="pi pi-check" :loading="saving" />
            </form>
          </template>
        </TabPanel>
      </TabPanels>
    </Tabs>

    <!-- نموذج طلب الإجازة بالنيابة -->
    <Dialog
      v-model:visible="reqForm.open"
      modal
      :header="t('leaves.newRequest')"
      :style="{ width: '32rem' }"
      :breakpoints="{ '640px': '95vw' }"
    >
      <form class="grid gap-4 pt-2 sm:grid-cols-2" @submit.prevent="submitRequest">
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('leaves.employee') }}</span>
          <Select v-model="reqForm.user_id" :options="users" option-label="name" option-value="id" required fluid />
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('leaves.type') }}</span>
          <Select v-model="reqForm.leave_type_id" :options="types" option-label="name" option-value="id" required fluid />
        </label>
        <!-- حدود النوع المختار -->
        <p v-if="reqLimitHint" class="-mt-1 flex items-center gap-1.5 text-xs text-surface-500 sm:col-span-2">
          <i class="pi pi-info-circle" />{{ t('leaves.limitsLabel') }}: {{ reqLimitHint }}
        </p>

        <!-- زمنية: يوم واحد + قائمتا وقت كل 30 دقيقة -->
        <template v-if="isHourlyReq">
          <label class="block text-sm sm:col-span-2">
            <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('leaves.date') }}</span>
            <DatePicker v-model="reqStartDate" date-format="yy-mm-dd" show-icon fluid />
          </label>
          <label class="block text-sm">
            <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('leaves.fromTime') }}</span>
            <Select v-model="reqForm.start_time" :options="startTimeOptions" :placeholder="t('leaves.pickTime')" fluid />
          </label>
          <label class="block text-sm">
            <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('leaves.toTime') }}</span>
            <Select
              v-model="reqForm.end_time"
              :options="endTimeOptions"
              :placeholder="t('leaves.pickTime')"
              :disabled="!reqForm.start_time"
              fluid
            />
          </label>
          <p v-if="reqHours > 0" class="text-xs text-surface-500 sm:col-span-2">
            {{ t('leaves.computedHours', { n: reqHours }) }}
          </p>
        </template>

        <!-- يومية/مرضية/طويلة: من/إلى بالتاريخ -->
        <template v-else>
          <label class="block text-sm">
            <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('leaves.startAt') }}</span>
            <DatePicker v-model="reqStartDate" date-format="yy-mm-dd" show-icon fluid />
          </label>
          <label class="block text-sm">
            <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('leaves.endAt') }}</span>
            <DatePicker v-model="reqEndDate" date-format="yy-mm-dd" :min-date="reqStartDate ?? undefined" show-icon fluid />
          </label>
          <p v-if="reqDays > 0" class="text-xs text-surface-500 sm:col-span-2">
            {{ t('leaves.computedDays', { n: reqDays }) }}
          </p>
        </template>

        <Message v-if="reqLimitError" severity="warn" :closable="false" class="sm:col-span-2">{{ reqLimitError }}</Message>

        <div class="mt-2 flex justify-end gap-2 sm:col-span-2">
          <Button type="button" :label="t('common.cancel')" severity="secondary" text @click="reqForm.open = false" />
          <Button
            type="submit"
            :label="saving ? t('common.saving') : t('common.save')"
            icon="pi pi-check"
            :loading="saving"
            :disabled="!!reqLimitError"
          />
        </div>
      </form>
    </Dialog>

    <!-- نموذج إنشاء/تعديل نوع الإجازة -->
    <Dialog
      v-model:visible="typeForm.open"
      modal
      :header="typeForm.id === null ? t('leaves.addType') : t('leaves.editType')"
      :style="{ width: '32rem' }"
      :breakpoints="{ '640px': '95vw' }"
    >
      <form class="grid gap-4 pt-2 sm:grid-cols-2" @submit.prevent="submitType">
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('leaves.typeName') }}</span>
          <InputText v-model="typeForm.name" required maxlength="100" fluid />
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('leaves.kind') }}</span>
          <Select v-model="typeForm.kind" :options="kindOptions" option-label="label" option-value="value" fluid />
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('leaves.affectsBalance') }}</span>
          <Select v-model="typeForm.affects_balance" :options="affectsBalanceOptions" option-label="label" option-value="value" fluid />
        </label>
        <div class="flex items-center gap-6 pt-6">
          <label class="flex items-center gap-2 text-sm">
            <Checkbox v-model="typeForm.needs_approval" binary />
            <span class="font-medium text-surface-700 dark:text-surface-300">{{ t('leaves.needsApproval') }}</span>
          </label>
          <label class="flex items-center gap-2 text-sm">
            <Checkbox v-model="typeForm.is_paid" binary />
            <span class="font-medium text-surface-700 dark:text-surface-300">{{ t('leaves.isPaid') }}</span>
          </label>
        </div>

        <!-- حدود النوع — مشروطة بالصنف (BE-23) -->
        <!-- daily / sick / long → أقصى أيام للطلب -->
        <label v-if="typeForm.kind !== 'hourly'" class="block text-sm sm:col-span-2">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('leaves.maxDaysPerRequest') }}</span>
          <InputNumber
            v-model="typeForm.max_days_per_request"
            :min="1"
            :max-fraction-digits="0"
            show-buttons
            fluid
            :placeholder="t('leaves.noLimit')"
          />
        </label>

        <!-- hourly → أقصى ساعات لليوم + نافذة الوقت المسموح -->
        <template v-else>
          <label class="block text-sm sm:col-span-2">
            <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('leaves.maxHoursPerDay') }}</span>
            <InputNumber
              v-model="typeForm.max_hours_per_day"
              :min="0.5"
              :max="24"
              :step="0.5"
              :min-fraction-digits="0"
              :max-fraction-digits="2"
              show-buttons
              fluid
              :placeholder="t('leaves.noLimit')"
            />
          </label>
          <label class="block text-sm">
            <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('leaves.allowedFrom') }}</span>
            <DatePicker v-model="allowedFromTime" time-only hour-format="24" show-icon icon-display="input" fluid />
          </label>
          <label class="block text-sm">
            <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('leaves.allowedTo') }}</span>
            <DatePicker v-model="allowedToTime" time-only hour-format="24" show-icon icon-display="input" fluid />
          </label>
        </template>

        <div class="mt-2 flex justify-end gap-2 sm:col-span-2">
          <Button type="button" :label="t('common.cancel')" severity="secondary" text @click="typeForm.open = false" />
          <Button type="submit" :label="saving ? t('common.saving') : t('common.save')" icon="pi pi-check" :loading="saving" />
        </div>
      </form>
    </Dialog>
  </div>
</template>
