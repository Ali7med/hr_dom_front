<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Tag from 'primevue/tag'
import Dialog from '@/components/AppDialog.vue'
import PageHeader from '@/components/PageHeader.vue'
import { ApiException } from '@/api/client'
import { useUiStore } from '@/stores/ui'
import { holidaysApi, schedulesApi, type Holiday, type Schedule } from '@/api/schedule'
import { leavesApi, type LeaveRequest } from '@/api/leaves'
import { usersApi } from '@/api/users'

const { t } = useI18n()
const toast = useToast()
const ui = useUiStore()

function notifyError(e: unknown, fallback: string): void {
  const msg = e instanceof ApiException ? e.message : fallback
  toast.add({ severity: 'error', summary: t('common.error'), detail: msg, life: 4000 })
}

// الأسبوع يبدأ السبت (اصطلاح إقليمي). getDay(): 0=الأحد…6=السبت.
const WEEK_START = 6
const dayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] // مفهرسة بـ getDay()
const weekHeaders = computed(() =>
  Array.from({ length: 7 }, (_, i) => t('days.' + dayKeys[(WEEK_START + i) % 7])),
)
const hhmm = (s?: string | null) => (s ? s.slice(0, 5) : '')
// iso محلي (تفادي انزياح UTC).
function isoOf(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const today = new Date()
const view = reactive({ year: today.getFullYear(), month: today.getMonth() }) // month: 0-11
const layers = reactive({ shifts: true, leaves: true, holidays: true })

const loading = ref(false)
const holidays = ref<Holiday[]>([])
const leaves = ref<LeaveRequest[]>([])
const schedules = ref<Schedule[]>([])
const userNames = ref<Record<number, string>>({})

const monthLabel = computed(() =>
  new Date(view.year, view.month, 1).toLocaleDateString(ui.locale === 'ar' ? 'ar-u-nu-latn' : 'en', {
    month: 'long',
    year: 'numeric',
  }),
)

// شبكة الأيام (أسابيع كاملة تغطّي الشهر).
interface Cell {
  date: Date
  iso: string
  dayNum: number
  inMonth: boolean
  isToday: boolean
  isWeekend: boolean
}
const weeks = computed<Cell[][]>(() => {
  const first = new Date(view.year, view.month, 1)
  const offset = (first.getDay() - WEEK_START + 7) % 7
  const start = new Date(view.year, view.month, 1 - offset)
  const daysInMonth = new Date(view.year, view.month + 1, 0).getDate()
  const totalCells = Math.ceil((offset + daysInMonth) / 7) * 7
  const todayIso = isoOf(today)
  const cells: Cell[] = []
  for (let i = 0; i < totalCells; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
    const dow = d.getDay()
    cells.push({
      date: d,
      iso: isoOf(d),
      dayNum: d.getDate(),
      inMonth: d.getMonth() === view.month,
      isToday: isoOf(d) === todayIso,
      isWeekend: dow === 5 || dow === 6, // الجمعة/السبت
    })
  }
  const out: Cell[][] = []
  for (let i = 0; i < cells.length; i += 7) out.push(cells.slice(i, i + 7))
  return out
})

// ===== فهارس لكل يوم =====
const holidaysByDate = computed(() => {
  const m: Record<string, Holiday> = {}
  for (const h of holidays.value) m[h.date.slice(0, 10)] = h
  return m
})
const leavesByDate = computed(() => {
  const m: Record<string, LeaveRequest[]> = {}
  for (const lv of leaves.value) {
    const s = new Date(lv.start_at.slice(0, 10) + 'T00:00:00')
    const e = new Date(lv.end_at.slice(0, 10) + 'T00:00:00')
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
      const iso = isoOf(d)
      ;(m[iso] ??= []).push(lv)
    }
  }
  return m
})
const shiftsByDate = computed(() => {
  // لكل يوم مرئيّ: الجداول بتاريخ صريح (work_date) أو المتكرّرة (weekday).
  const m: Record<string, Schedule[]> = {}
  const visible = weeks.value.flat()
  for (const cell of visible) {
    const dow = cell.date.getDay()
    const matches = schedules.value.filter((s) =>
      s.work_date ? s.work_date.slice(0, 10) === cell.iso : s.weekday === dow,
    )
    if (matches.length) m[cell.iso] = matches
  }
  return m
})

const userName = (id: number) => userNames.value[id] ?? `#${id}`

async function load(): Promise<void> {
  loading.value = true
  const monthStart = isoOf(new Date(view.year, view.month, 1))
  const monthEnd = isoOf(new Date(view.year, view.month + 1, 0))
  try {
    const [hs, lv, sc, us] = await Promise.all([
      holidaysApi.list().catch(() => []),
      leavesApi.list({ from: monthStart, to: monthEnd, status: 'approved', per_page: 300 }).then((r) => r.data).catch(() => []),
      schedulesApi.list().catch(() => []),
      usersApi.list({ per_page: 300 }).then((r) => r.data).catch(() => []),
    ])
    holidays.value = hs
    leaves.value = lv
    schedules.value = sc
    userNames.value = Object.fromEntries(us.map((u) => [u.id, u.name]))
  } catch (e) {
    notifyError(e, t('common.loadError'))
  } finally {
    loading.value = false
  }
}

function shiftMonth(delta: number): void {
  const d = new Date(view.year, view.month + delta, 1)
  view.year = d.getFullYear()
  view.month = d.getMonth()
  void load()
}
function goToday(): void {
  view.year = today.getFullYear()
  view.month = today.getMonth()
  void load()
}

// ===== حوار تفاصيل اليوم =====
const detail = reactive({ open: false, iso: '', label: '' })
function openDay(cell: Cell): void {
  const hasAny =
    (layers.holidays && holidaysByDate.value[cell.iso]) ||
    (layers.leaves && leavesByDate.value[cell.iso]?.length) ||
    (layers.shifts && shiftsByDate.value[cell.iso]?.length)
  if (!hasAny) return
  detail.open = true
  detail.iso = cell.iso
  detail.label = cell.date.toLocaleDateString(ui.locale === 'ar' ? 'ar-u-nu-latn' : 'en', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
const detailHoliday = computed(() => holidaysByDate.value[detail.iso] ?? null)
const detailLeaves = computed(() => leavesByDate.value[detail.iso] ?? [])
const detailShifts = computed(() => shiftsByDate.value[detail.iso] ?? [])

onMounted(load)
</script>

<template>
  <div class="mx-auto max-w-6xl">
    <PageHeader :title="t('calendar.title')" :subtitle="t('calendar.subtitle')">
      <template #actions>
        <div class="flex items-center gap-2">
          <Button icon="pi pi-angle-right" severity="secondary" text rounded :aria-label="t('calendar.prev')" @click="shiftMonth(-1)" />
          <Button :label="t('calendar.today')" severity="secondary" outlined size="small" @click="goToday" />
          <Button icon="pi pi-angle-left" severity="secondary" text rounded :aria-label="t('calendar.next')" @click="shiftMonth(1)" />
        </div>
      </template>
    </PageHeader>

    <!-- الترويسة: الشهر + مفاتيح الطبقات -->
    <div class="mb-4 flex flex-wrap items-center justify-between gap-4">
      <h2 class="text-lg font-bold text-surface-900 dark:text-white" dir="ltr">{{ monthLabel }}</h2>
      <div class="flex flex-wrap items-center gap-4 text-sm">
        <label class="flex items-center gap-2">
          <Checkbox v-model="layers.shifts" binary />
          <span class="inline-flex items-center gap-1"><span class="size-2.5 rounded-full bg-primary-500" />{{ t('calendar.shifts') }}</span>
        </label>
        <label class="flex items-center gap-2">
          <Checkbox v-model="layers.leaves" binary />
          <span class="inline-flex items-center gap-1"><span class="size-2.5 rounded-full bg-amber-500" />{{ t('calendar.leaves') }}</span>
        </label>
        <label class="flex items-center gap-2">
          <Checkbox v-model="layers.holidays" binary />
          <span class="inline-flex items-center gap-1"><span class="size-2.5 rounded-full bg-rose-500" />{{ t('calendar.holidays') }}</span>
        </label>
      </div>
    </div>

    <!-- الشبكة -->
    <div class="overflow-hidden rounded-2xl border border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
      <!-- رؤوس الأيام -->
      <div class="grid grid-cols-7 border-b border-surface-200 dark:border-surface-800">
        <div
          v-for="h in weekHeaders"
          :key="h"
          class="px-2 py-2.5 text-center text-xs font-semibold text-surface-500 dark:text-surface-400"
        >
          {{ h }}
        </div>
      </div>
      <!-- الأسابيع -->
      <div v-for="(week, wi) in weeks" :key="wi" class="grid grid-cols-7">
        <button
          v-for="cell in week"
          :key="cell.iso"
          type="button"
          class="relative min-h-24 border-b border-e border-surface-100 p-1.5 text-start align-top transition hover:bg-surface-50 dark:border-surface-800 dark:hover:bg-surface-800/50"
          :class="[
            cell.inMonth ? '' : 'bg-surface-50/60 dark:bg-surface-950/40',
            cell.isWeekend && cell.inMonth ? 'bg-surface-50 dark:bg-surface-800/30' : '',
          ]"
          @click="openDay(cell)"
        >
          <!-- رقم اليوم -->
          <div class="mb-1 flex items-center justify-between">
            <span
              class="grid size-6 place-items-center rounded-full text-xs font-medium"
              :class="[
                cell.isToday ? 'bg-primary text-primary-contrast' : '',
                cell.inMonth ? 'text-surface-700 dark:text-surface-200' : 'text-surface-400 dark:text-surface-600',
              ]"
              dir="ltr"
            >{{ cell.dayNum }}</span>
            <span v-if="layers.holidays && holidaysByDate[cell.iso]" class="size-2 rounded-full bg-rose-500" />
          </div>
          <!-- شارات -->
          <div class="space-y-1">
            <div
              v-if="layers.holidays && holidaysByDate[cell.iso]"
              class="truncate rounded bg-rose-100 px-1.5 py-0.5 text-[0.7rem] font-medium text-rose-700 dark:bg-rose-500/20 dark:text-rose-300"
            >
              {{ holidaysByDate[cell.iso].name }}
            </div>
            <div
              v-if="layers.leaves && leavesByDate[cell.iso]?.length"
              class="truncate rounded bg-amber-100 px-1.5 py-0.5 text-[0.7rem] font-medium text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
            >
              {{ t('calendar.onLeave', { n: leavesByDate[cell.iso].length }) }}
            </div>
            <div
              v-if="layers.shifts && shiftsByDate[cell.iso]?.length"
              class="truncate rounded bg-primary-100 px-1.5 py-0.5 text-[0.7rem] font-medium text-primary-700 dark:bg-primary-500/20 dark:text-primary-300"
            >
              {{ t('calendar.shiftsCount', { n: shiftsByDate[cell.iso].length }) }}
            </div>
          </div>
        </button>
      </div>
    </div>

    <p v-if="loading" class="mt-3 text-center text-sm text-surface-500">{{ t('common.loading') }}</p>

    <!-- تفاصيل اليوم -->
    <Dialog
      v-model:visible="detail.open"
      modal
      :header="detail.label"
      :style="{ width: '32rem' }"
      :breakpoints="{ '640px': '95vw' }"
    >
      <div class="space-y-5 pt-2">
        <!-- عطلة -->
        <div v-if="detailHoliday">
          <h3 class="mb-2 flex items-center gap-2 text-sm font-semibold text-surface-700 dark:text-surface-200">
            <span class="size-2.5 rounded-full bg-rose-500" />{{ t('calendar.holidays') }}
          </h3>
          <Tag :value="detailHoliday.name" severity="danger" />
        </div>
        <!-- إجازات -->
        <div v-if="detailLeaves.length">
          <h3 class="mb-2 flex items-center gap-2 text-sm font-semibold text-surface-700 dark:text-surface-200">
            <span class="size-2.5 rounded-full bg-amber-500" />{{ t('calendar.leaves') }} ({{ detailLeaves.length }})
          </h3>
          <ul class="space-y-1.5">
            <li v-for="lv in detailLeaves" :key="lv.id" class="flex items-center justify-between rounded-lg bg-surface-50 px-3 py-2 text-sm dark:bg-surface-800">
              <span class="font-medium text-surface-800 dark:text-surface-100">{{ lv.user?.name ?? userName(lv.user_id) }}</span>
              <span class="text-surface-500">{{ lv.leave_type?.name ?? '—' }}</span>
            </li>
          </ul>
        </div>
        <!-- ورديات -->
        <div v-if="detailShifts.length">
          <h3 class="mb-2 flex items-center gap-2 text-sm font-semibold text-surface-700 dark:text-surface-200">
            <span class="size-2.5 rounded-full bg-primary-500" />{{ t('calendar.shifts') }} ({{ detailShifts.length }})
          </h3>
          <ul class="space-y-1.5">
            <li v-for="s in detailShifts" :key="s.id" class="flex items-center justify-between rounded-lg bg-surface-50 px-3 py-2 text-sm dark:bg-surface-800">
              <span class="font-medium text-surface-800 dark:text-surface-100">{{ userName(s.user_id) }}</span>
              <span class="text-surface-500">
                {{ s.shift?.name ?? '—' }}
                <span v-if="s.shift" dir="ltr" class="ms-1 text-xs">({{ hhmm(s.shift.start_time) }}–{{ hhmm(s.shift.end_time) }})</span>
              </span>
            </li>
          </ul>
        </div>
      </div>
    </Dialog>
  </div>
</template>
