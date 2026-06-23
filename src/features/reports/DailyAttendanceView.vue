<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Select from 'primevue/select'
import Dialog from 'primevue/dialog'
import Textarea from 'primevue/textarea'
import Message from 'primevue/message'
import Tag from 'primevue/tag'
import PageHeader from '@/components/PageHeader.vue'
import { ApiException } from '@/api/client'
import { useAuthStore } from '@/stores/auth'
import { saveBlob } from '@/api/reports'
import { dailyAttendanceApi, type DailyAttendanceRow, type DailyAttendanceSummary, type DailyAttendanceParams } from '@/api/dailyAttendance'
import { excusesApi } from '@/api/excuses'
import { departmentsApi, usersApi, type Department, type User } from '@/api/users'

// جدول التتبّع اليومي (BE-90): من نقص دخولاً/خروجاً + دقائق التقصير الصافية + تبرير بإذن (BE-27).
const { t } = useI18n()
const toast = useToast()
const auth = useAuthStore()

const canApprove = computed(() => auth.can('excuses.approve'))

const rows = ref<DailyAttendanceRow[]>([])
const summary = ref<DailyAttendanceSummary>({})
const loading = ref(false)
const unavailable = ref(false)
const exporting = ref(false)

const departments = ref<Department[]>([])
const users = ref<User[]>([])

const todayStr = (): string => {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const filters = reactive<{
  date: string
  status: DailyAttendanceParams['status'] | null
  justification: 'any' | 'justified' | 'unjustified'
  department_id: number | null
  user_id: number | null
}>({ date: todayStr(), status: null, justification: 'any', department_id: null, user_id: null })

const statusOptions = computed(() => [
  { label: t('daily.status.all'), value: null },
  { label: t('daily.status.present'), value: 'present' },
  { label: t('daily.status.missing_check_in'), value: 'missing_check_in' },
  { label: t('daily.status.missing_check_out'), value: 'missing_check_out' },
  { label: t('daily.status.missing_both'), value: 'missing_both' },
  { label: t('daily.status.incomplete'), value: 'incomplete' },
  { label: t('daily.status.on_leave'), value: 'on_leave' },
])
const justificationOptions = computed(() => [
  { label: t('daily.just.any'), value: 'any' },
  { label: t('daily.just.justified'), value: 'justified' },
  { label: t('daily.just.unjustified'), value: 'unjustified' },
])

const statusSeverity: Record<string, string> = {
  present: 'success',
  missing_check_in: 'warn',
  missing_check_out: 'warn',
  missing_both: 'danger',
  on_leave: 'info',
}

const summaryCards = computed(() => {
  const c = summary.value.counts ?? {}
  return [
    { key: 'present', value: c.present, cls: 'text-emerald-600 dark:text-emerald-400' },
    { key: 'missing_check_in', value: c.missing_check_in, cls: 'text-amber-600 dark:text-amber-400' },
    { key: 'missing_check_out', value: c.missing_check_out, cls: 'text-amber-600 dark:text-amber-400' },
    { key: 'missing_both', value: c.missing_both, cls: 'text-red-600 dark:text-red-400' },
    { key: 'on_leave', value: c.on_leave, cls: 'text-sky-600 dark:text-sky-400' },
    { key: 'net_deficiency_minutes', value: summary.value.total_net_deficiency_minutes, cls: 'text-surface-700 dark:text-surface-200' },
  ]
})

function notifyError(e: unknown, fallback: string): void {
  const msg = e instanceof ApiException ? e.message : fallback
  toast.add({ severity: 'error', summary: t('common.error'), detail: msg, life: 4000 })
}

const hhmm = (dt: string | null): string => {
  if (!dt) return '—'
  const m = /T(\d{2}:\d{2})/.exec(dt) || /\b(\d{2}:\d{2})/.exec(dt)
  return m ? m[1] : dt
}
const shiftLabel = (r: DailyAttendanceRow): string => {
  if (!r.shift_name && !r.shift_start) return '—'
  const win = r.shift_start && r.shift_end ? ` (${r.shift_start}–${r.shift_end})` : ''
  return `${r.shift_name ?? ''}${win}`.trim() || '—'
}

function buildParams(): DailyAttendanceParams {
  const p: DailyAttendanceParams = { date: filters.date, justification: filters.justification }
  if (filters.status) p.status = filters.status
  if (filters.department_id) p.department_id = filters.department_id
  if (filters.user_id) p.user_id = filters.user_id
  return p
}

async function load(): Promise<void> {
  loading.value = true
  try {
    const res = await dailyAttendanceApi.list({ ...buildParams(), per_page: 100 })
    rows.value = res.data
    summary.value = res.summary ?? {}
    unavailable.value = false
  } catch (e) {
    if (e instanceof ApiException && (e.status === 403 || e.status === 404)) unavailable.value = true
    else notifyError(e, t('common.loadError'))
  } finally {
    loading.value = false
  }
}

async function exportExcel(): Promise<void> {
  exporting.value = true
  try {
    const blob = await dailyAttendanceApi.download(buildParams(), 'excel')
    saveBlob(blob, `daily-attendance-${filters.date}.xlsx`)
  } catch (e) {
    notifyError(e, t('common.error'))
  } finally {
    exporting.value = false
  }
}

// ===== تبرير نقص بإذن بالنيابة (BE-27) =====
const showJustify = ref(false)
const justifying = ref(false)
const justifyRow = ref<DailyAttendanceRow | null>(null)
const justifyForm = reactive({ start_time: '', end_time: '', reason: '' })

// صفّ نقص غير مبرّر يمكن تبريره (لا الإجازة/العطلة، وفيه نقص صافٍ).
function canJustify(r: DailyAttendanceRow): boolean {
  return r.status !== 'on_leave' && !r.justified && (r.net_deficiency_minutes ?? 0) > 0
}

function openJustify(r: DailyAttendanceRow): void {
  justifyRow.value = r
  // نافذة افتراضية تغطّي التقصير: التأخّر فقط → [بداية الوردية، الدخول]؛ الخروج المبكر فقط → [الخروج، نهاية الوردية]؛ غير ذلك → الوردية كاملة.
  const onlyLate = (r.late_minutes ?? 0) > 0 && (r.early_out_minutes ?? 0) === 0
  const onlyEarly = (r.early_out_minutes ?? 0) > 0 && (r.late_minutes ?? 0) === 0
  if (onlyLate) {
    justifyForm.start_time = r.shift_start ?? '08:00'
    justifyForm.end_time = hhmm(r.check_in_at) !== '—' ? hhmm(r.check_in_at) : (r.shift_end ?? '16:00')
  } else if (onlyEarly) {
    justifyForm.start_time = hhmm(r.check_out_at) !== '—' ? hhmm(r.check_out_at) : (r.shift_start ?? '08:00')
    justifyForm.end_time = r.shift_end ?? '16:00'
  } else {
    justifyForm.start_time = r.shift_start ?? '08:00'
    justifyForm.end_time = r.shift_end ?? '16:00'
  }
  justifyForm.reason = ''
  showJustify.value = true
}

async function submitJustify(): Promise<void> {
  const r = justifyRow.value
  if (!r) return
  if (!justifyForm.start_time || !justifyForm.end_time) {
    toast.add({ severity: 'warn', summary: t('daily.justifyTimeRequired'), life: 3000 })
    return
  }
  if (!justifyForm.reason.trim()) {
    toast.add({ severity: 'warn', summary: t('daily.justifyReasonRequired'), life: 3000 })
    return
  }
  justifying.value = true
  try {
    const excuse = await excusesApi.create({
      user_id: r.user_id,
      date: r.date,
      start_time: justifyForm.start_time,
      end_time: justifyForm.end_time,
      reason: justifyForm.reason.trim(),
    })
    // اعتماد فوري إن كان المستخدم يملك صلاحية الاعتماد (يُسحب النقص).
    if (canApprove.value && excuse?.status !== 'approved' && excuse?.id) {
      await excusesApi.approve(excuse.id)
    }
    toast.add({ severity: 'success', summary: t('daily.justified'), life: 2800 })
    showJustify.value = false
    await load()
  } catch (e) {
    notifyError(e, t('common.saveError'))
  } finally {
    justifying.value = false
  }
}

onMounted(async () => {
  departments.value = await departmentsApi.list().catch(() => [])
  users.value = await usersApi.list({ per_page: 200 }).then((r) => r.data).catch(() => [])
  await load()
})
</script>

<template>
  <div>
    <PageHeader :title="t('daily.title')" :subtitle="t('daily.subtitle')">
      <template #actions>
        <Button :label="t('daily.exportExcel')" icon="pi pi-file-excel" severity="secondary" outlined :loading="exporting" :disabled="unavailable || !rows.length" @click="exportExcel" />
      </template>
    </PageHeader>

    <Message v-if="unavailable" severity="info" :closable="false">{{ t('daily.unavailable') }}</Message>

    <template v-else>
      <!-- الفلاتر -->
      <div class="mb-5 flex flex-wrap items-end gap-3 rounded-2xl border border-surface-200 bg-white p-4 dark:border-surface-800 dark:bg-surface-900">
        <div>
          <label class="mb-1 block text-xs text-surface-500">{{ t('daily.date') }}</label>
          <input v-model="filters.date" type="date" class="rounded-lg border border-surface-300 bg-transparent px-3 py-2 text-sm text-surface-800 dark:border-surface-700 dark:text-surface-100" @change="load" />
        </div>
        <div class="min-w-44">
          <label class="mb-1 block text-xs text-surface-500">{{ t('daily.statusFilter') }}</label>
          <Select v-model="filters.status" :options="statusOptions" option-label="label" option-value="value" fluid @change="load" />
        </div>
        <div class="min-w-40">
          <label class="mb-1 block text-xs text-surface-500">{{ t('daily.justification') }}</label>
          <Select v-model="filters.justification" :options="justificationOptions" option-label="label" option-value="value" fluid @change="load" />
        </div>
        <div class="min-w-44">
          <label class="mb-1 block text-xs text-surface-500">{{ t('daily.department') }}</label>
          <Select v-model="filters.department_id" :options="departments" option-label="name" option-value="id" :placeholder="t('daily.allDepartments')" show-clear filter fluid @change="load" />
        </div>
        <div class="min-w-52">
          <label class="mb-1 block text-xs text-surface-500">{{ t('daily.employee') }}</label>
          <Select v-model="filters.user_id" :options="users" option-label="name" option-value="id" :placeholder="t('daily.allEmployees')" show-clear filter fluid @change="load" />
        </div>
        <Button icon="pi pi-refresh" :label="t('common.search')" :loading="loading" @click="load" />
      </div>

      <!-- بطاقات الملخّص -->
      <div class="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div v-for="c in summaryCards" :key="c.key" class="rounded-2xl border border-surface-200 bg-white p-3 text-center dark:border-surface-800 dark:bg-surface-900">
          <p class="text-xs text-surface-500">{{ t('daily.summary.' + c.key) }}</p>
          <p class="mt-1 text-xl font-semibold" :class="c.cls" dir="ltr">{{ c.value ?? 0 }}</p>
        </div>
      </div>

      <!-- الجدول -->
      <div class="overflow-hidden rounded-2xl border border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
        <DataTable :value="rows" :loading="loading" paginator :rows="20" :rows-per-page-options="[20, 50, 100]" data-key="user_id" striped-rows>
          <template #empty>
            <p class="py-6 text-center text-sm text-surface-500">{{ t('daily.noRows') }}</p>
          </template>
          <Column field="name" :header="t('daily.employee')" sortable>
            <template #body="{ data }">
              <div class="font-medium text-surface-900 dark:text-white">{{ data.name }}</div>
              <div class="text-xs text-surface-500" dir="ltr">{{ data.employee_no || '—' }}</div>
            </template>
          </Column>
          <Column :header="t('daily.department')"><template #body="{ data }">{{ data.department || '—' }}</template></Column>
          <Column :header="t('daily.shift')"><template #body="{ data }"><span dir="ltr">{{ shiftLabel(data) }}</span></template></Column>
          <Column :header="t('daily.checkIn')"><template #body="{ data }"><span class="font-mono text-xs" dir="ltr">{{ hhmm(data.check_in_at) }}</span></template></Column>
          <Column :header="t('daily.checkOut')"><template #body="{ data }"><span class="font-mono text-xs" dir="ltr">{{ hhmm(data.check_out_at) }}</span></template></Column>
          <Column :header="t('daily.statusFilter')" sortable field="status">
            <template #body="{ data }">
              <Tag :value="t('daily.status.' + data.status)" :severity="statusSeverity[data.status] || 'secondary'" />
              <span v-if="data.status === 'on_leave' && data.leave_type" class="ms-1 text-xs text-surface-500">{{ data.leave_type }}</span>
            </template>
          </Column>
          <Column :header="t('daily.late')"><template #body="{ data }"><span dir="ltr">{{ data.late_minutes || 0 }}</span></template></Column>
          <Column :header="t('daily.earlyOut')"><template #body="{ data }"><span dir="ltr">{{ data.early_out_minutes || 0 }}</span></template></Column>
          <Column :header="t('daily.netDeficiency')" sortable field="net_deficiency_minutes">
            <template #body="{ data }">
              <span dir="ltr" :class="(data.net_deficiency_minutes || 0) > 0 ? 'font-semibold text-red-600 dark:text-red-400' : 'text-surface-400'">{{ data.net_deficiency_minutes || 0 }}</span>
            </template>
          </Column>
          <Column :header="t('daily.justifiedCol')">
            <template #body="{ data }">
              <Tag v-if="data.justified" :value="t('daily.justifiedYes')" severity="success" />
              <span v-else-if="data.status === 'on_leave' || (data.net_deficiency_minutes || 0) === 0" class="text-surface-400">—</span>
              <Tag v-else :value="t('daily.justifiedNo')" severity="danger" />
            </template>
          </Column>
          <Column class="text-end">
            <template #body="{ data }">
              <Button v-if="canApprove && canJustify(data)" v-tooltip.top="t('daily.justify')" icon="pi pi-check-circle" severity="secondary" text rounded @click="openJustify(data)" />
            </template>
          </Column>
        </DataTable>
      </div>
    </template>

    <!-- حوار التبرير -->
    <Dialog v-model:visible="showJustify" modal :header="t('daily.justify')" :style="{ width: '32rem' }" :dismissable-mask="true" :draggable="false">
      <div v-if="justifyRow" class="space-y-4">
        <p class="text-sm text-surface-600 dark:text-surface-300">
          {{ t('daily.justifyIntro', { name: justifyRow.name, date: justifyRow.date }) }}
        </p>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="mb-1 block text-sm text-surface-600 dark:text-surface-300">{{ t('daily.from') }}</label>
            <input v-model="justifyForm.start_time" type="time" step="60" class="w-full rounded-lg border border-surface-300 bg-transparent px-3 py-2 text-sm dark:border-surface-700" />
          </div>
          <div>
            <label class="mb-1 block text-sm text-surface-600 dark:text-surface-300">{{ t('daily.to') }}</label>
            <input v-model="justifyForm.end_time" type="time" step="60" class="w-full rounded-lg border border-surface-300 bg-transparent px-3 py-2 text-sm dark:border-surface-700" />
          </div>
        </div>
        <div>
          <label class="mb-1 block text-sm text-surface-600 dark:text-surface-300">{{ t('daily.reason') }}</label>
          <Textarea v-model="justifyForm.reason" rows="3" fluid :placeholder="t('daily.reasonPlaceholder')" />
        </div>
        <Message severity="info" :closable="false">{{ t('daily.justifyNote') }}</Message>
      </div>
      <template #footer>
        <Button :label="t('common.cancel')" severity="secondary" outlined @click="showJustify = false" />
        <Button :label="t('daily.justifyConfirm')" icon="pi pi-check" :loading="justifying" @click="submitJustify" />
      </template>
    </Dialog>
  </div>
</template>
