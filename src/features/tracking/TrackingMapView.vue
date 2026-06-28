<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import MultiSelect from 'primevue/multiselect'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import Button from 'primevue/button'
import Message from 'primevue/message'
import Tag from 'primevue/tag'
import PageHeader from '@/components/PageHeader.vue'
import GroupTrackMap, { type GroupSeries } from '@/components/GroupTrackMap.vue'
import { ApiException } from '@/api/client'
import {
  trackingApi,
  type TrackingEnrollment,
  type TrackSeries,
  type LivePosition,
  type TrackUser,
  type TracksQuery,
} from '@/api/tracking'
import { departmentsApi, type Department } from '@/api/users'

// الخريطة الجماعية (BE-92 / FE-48): مسارات عدّة موظفين بألوان مميّزة + وضعان (تاريخي/مباشر) + مشغّل زمني.
// تتطلّب tracking.view. تُبنى استباقياً بتدهور آمن (404/403 → بانر غير متاح).
const { t, locale } = useI18n()
const toast = useToast()

// لوحة ألوان متباينة (~20) تُسنَد لكل موظف بثبات خلال الجلسة.
const PALETTE = [
  '#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
  '#f97316', '#6366f1', '#14b8a6', '#eab308', '#d946ef', '#0ea5e9', '#10b981', '#f43f5e',
  '#a855f7', '#0891b2', '#65a30d', '#db2777',
]
const colorMap = new Map<number, string>()
function colorFor(id: number): string {
  if (!colorMap.has(id)) colorMap.set(id, PALETTE[colorMap.size % PALETTE.length])
  return colorMap.get(id) as string
}

const loading = ref(false)
const unavailable = ref(false)
const loadingMap = ref(false)

// ملء الشاشة لقسم الخريطة (يشمل المشغّل الزمني ومفتاح الألوان للاستفادة من المساحة).
const isFullscreen = ref(false)
function toggleFullscreen(): void {
  isFullscreen.value = !isFullscreen.value
}
function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') isFullscreen.value = false
}

const enrollments = ref<TrackingEnrollment[]>([])
const departments = ref<Department[]>([])

// الوضع: تاريخي (مسارات ضمن فترة) أو مباشر (آخر موقع باستطلاع دوري).
const mode = ref<'history' | 'live'>('history')
const modeOptions = computed(() => [
  { label: t('trackingMap.modeHistory'), value: 'history' },
  { label: t('trackingMap.modeLive'), value: 'live' },
])

// الاختيار + الفلتر.
const selectedUserIds = ref<number[]>([])
const deptFilter = ref<number | null>(null)
const employeeOptions = computed(() =>
  enrollments.value
    .filter((e) => deptFilter.value == null || e.department_id === deptFilter.value)
    .map((e) => ({ label: e.employee_no ? `${e.name} (${e.employee_no})` : e.name, value: e.user_id })),
)
const deptOptions = computed(() => [
  { label: t('trackingMap.allDepartments'), value: null },
  ...departments.value.map((d) => ({ label: d.name, value: d.id })),
])

function selectAll(): void {
  selectedUserIds.value = employeeOptions.value.map((o) => o.value)
}
function clearSelection(): void {
  selectedUserIds.value = []
}

// الفترة (الوضع التاريخي).
const todayStr = (): string => {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}
const fromDate = ref(todayStr())
const toDate = ref(todayStr())
function setRangeDays(days: number): void {
  const to = new Date()
  const from = new Date()
  from.setDate(from.getDate() - (days - 1))
  const p = (n: number) => String(n).padStart(2, '0')
  const fmt = (d: Date) => `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
  fromDate.value = fmt(from)
  toDate.value = fmt(to)
  void apply()
}

// بيانات الخريطة.
const seriesData = ref<TrackSeries[]>([]) // الوضع التاريخي
const positions = ref<LivePosition[]>([]) // الوضع المباشر
const liveTrails = ref<Record<number, import('@/api/tracking').TrackPoint[]>>({}) // أثر حديث للوضع المباشر
const downsampled = ref(false)
const hidden = ref<Set<number>>(new Set()) // معرّفات مخفيّة من مفتاح الألوان

const labelOf = (u: TrackUser): string => u.name

function notifyError(e: unknown, fallback: string): void {
  const msg = e instanceof ApiException ? e.message : fallback
  toast.add({ severity: 'error', summary: t('common.error'), detail: msg, life: 4000 })
}

function buildScopeParams(): { user_ids?: string; department_id?: number } {
  if (selectedUserIds.value.length) return { user_ids: selectedUserIds.value.join(',') }
  if (deptFilter.value != null) return { department_id: deptFilter.value }
  return {}
}

// ===== المشغّل الزمني (الوضع التاريخي) =====
const minTime = ref(0)
const maxTime = ref(0)
const cursorTime = ref<number | null>(null)
const playing = ref(false)
const speed = ref(1)
const speedOptions = [
  { label: '1×', value: 1 },
  { label: '2×', value: 2 },
  { label: '4×', value: 4 },
]
let raf = 0
let lastTs = 0
const BASE_MS = 20000 // الفترة كاملة تُعرض في 20 ثانية عند سرعة 1×

const hasTimeline = computed(() => mode.value === 'history' && maxTime.value > minTime.value)
const sliderStep = computed(() => Math.max(1, Math.floor((maxTime.value - minTime.value) / 600)))
const cursorLabel = computed(() => {
  if (cursorTime.value == null) return '—'
  try {
    return new Date(cursorTime.value).toLocaleString(locale.value === 'ar' ? 'ar' : 'en', {
      dateStyle: 'short',
      timeStyle: 'medium',
    })
  } catch {
    return '—'
  }
})

function setupTimeline(): void {
  let lo = Infinity
  let hi = -Infinity
  for (const s of seriesData.value) {
    for (const p of s.points) {
      const tm = new Date(p.recorded_at).getTime()
      if (tm < lo) lo = tm
      if (tm > hi) hi = tm
    }
  }
  if (lo === Infinity) {
    minTime.value = 0
    maxTime.value = 0
    cursorTime.value = null
    return
  }
  minTime.value = lo
  maxTime.value = hi
  cursorTime.value = lo
}

function tick(ts: number): void {
  if (!playing.value) return
  if (!lastTs) lastTs = ts
  const dt = ts - lastTs
  lastTs = ts
  const range = maxTime.value - minTime.value
  if (range > 0 && cursorTime.value != null) {
    const next = cursorTime.value + (dt / BASE_MS) * range * speed.value
    if (next >= maxTime.value) {
      cursorTime.value = maxTime.value
      stopPlayback()
      return
    }
    cursorTime.value = next
  }
  raf = requestAnimationFrame(tick)
}
function play(): void {
  if (maxTime.value <= minTime.value) return
  if (cursorTime.value == null || cursorTime.value >= maxTime.value) cursorTime.value = minTime.value
  playing.value = true
  lastTs = 0
  raf = requestAnimationFrame(tick)
}
function stopPlayback(): void {
  playing.value = false
  cancelAnimationFrame(raf)
  lastTs = 0
}
function togglePlay(): void {
  playing.value ? stopPlayback() : play()
}
function onSliderInput(e: Event): void {
  stopPlayback()
  cursorTime.value = Number((e.target as HTMLInputElement).value)
}

// ===== التحميل =====
async function loadTracks(): Promise<void> {
  loadingMap.value = true
  stopPlayback()
  try {
    const params: TracksQuery = {
      ...buildScopeParams(),
      from: `${fromDate.value}T00:00:00`,
      to: `${toDate.value}T23:59:59`,
    }
    const res = await trackingApi.listTracks(params)
    seriesData.value = res.series
    // الباك يُرجِع دائماً meta.max_points + meta.truncated_users (مصفوفة)؛ التحذير يظهر فقط
    // عند اعتيان فعلي = truncated_users غير فارغة (أو علَم downsampled صريح).
    const m = res.meta || {}
    const truncated = Array.isArray(m.truncated_users) ? m.truncated_users.length > 0 : false
    downsampled.value = truncated || m.downsampled === true
    setupTimeline()
  } catch (e) {
    if (e instanceof ApiException && (e.status === 403 || e.status === 404)) unavailable.value = true
    else notifyError(e, t('common.loadError'))
  } finally {
    loadingMap.value = false
  }
}

// ===== الوضع المباشر =====
let liveTimer: number | undefined
const lastPolledAt = ref<string | null>(null)
async function pollPositions(): Promise<void> {
  try {
    const res = await trackingApi.listPositions(buildScopeParams())
    positions.value = res
    lastPolledAt.value = new Date().toLocaleTimeString(locale.value === 'ar' ? 'ar' : 'en')
    // راكِم أثراً حديثاً قصيراً لكل موظف (آخر 30 نقطة).
    const trails = { ...liveTrails.value }
    for (const p of res) {
      if (!p.point) continue
      const arr = trails[p.user.id] ? [...trails[p.user.id]] : []
      const last = arr[arr.length - 1]
      if (!last || last.recorded_at !== p.point.recorded_at) {
        arr.push(p.point)
        if (arr.length > 30) arr.shift()
      }
      trails[p.user.id] = arr
    }
    liveTrails.value = trails
    unavailable.value = false
  } catch (e) {
    if (e instanceof ApiException && (e.status === 403 || e.status === 404)) {
      unavailable.value = true
      stopLive()
    }
    // أخطاء أخرى أثناء الاستطلاع تُتجاهَل بهدوء.
  }
}
function startLive(): void {
  stopLive()
  void pollPositions()
  liveTimer = window.setInterval(() => void pollPositions(), 12000)
}
function stopLive(): void {
  if (liveTimer) {
    clearInterval(liveTimer)
    liveTimer = undefined
  }
}

// زرّ التطبيق/التحديث الموحّد.
async function apply(): Promise<void> {
  if (mode.value === 'history') await loadTracks()
  else await pollPositions()
}

// ===== سلاسل الخريطة + مفتاح الألوان =====
const mapSeries = computed<GroupSeries[]>(() => {
  if (mode.value === 'live') {
    return positions.value
      .filter((p) => p.point)
      .map((p) => ({
        userId: p.user.id,
        name: labelOf(p.user),
        color: colorFor(p.user.id),
        visible: !hidden.value.has(p.user.id),
        points: liveTrails.value[p.user.id] ?? [p.point as import('@/api/tracking').TrackPoint],
        lastSeenAt: p.last_seen_at,
      }))
  }
  return seriesData.value.map((s) => ({
    userId: s.user.id,
    name: labelOf(s.user),
    color: colorFor(s.user.id),
    visible: !hidden.value.has(s.user.id),
    points: s.points,
  }))
})

interface LegendRow {
  id: number
  name: string
  color: string
  hidden: boolean
  count: number
  lastSeen: string | null
}
const legend = computed<LegendRow[]>(() => {
  if (mode.value === 'live') {
    return positions.value
      .filter((p) => p.point)
      .map((p) => ({
        id: p.user.id,
        name: labelOf(p.user),
        color: colorFor(p.user.id),
        hidden: hidden.value.has(p.user.id),
        count: liveTrails.value[p.user.id]?.length ?? 1,
        lastSeen: p.last_seen_at,
      }))
  }
  return seriesData.value.map((s) => ({
    id: s.user.id,
    name: labelOf(s.user),
    color: colorFor(s.user.id),
    hidden: hidden.value.has(s.user.id),
    count: s.points.length,
    lastSeen: s.points.length ? s.points[s.points.length - 1].recorded_at : null,
  }))
})

function toggleHidden(id: number): void {
  const next = new Set(hidden.value)
  next.has(id) ? next.delete(id) : next.add(id)
  hidden.value = next
}

const ymd = (d?: string | null) => (d ? d.slice(0, 19).replace('T', ' ') : '—')

// تبديل الوضع: ابدأ/أوقف الاستطلاع وأعد التحميل المناسب.
watch(mode, (m) => {
  stopPlayback()
  if (m === 'live') {
    seriesData.value = []
    startLive()
  } else {
    stopLive()
    positions.value = []
    liveTrails.value = {}
    void loadTracks()
  }
})

onMounted(async () => {
  window.addEventListener('keydown', onKeydown)
  loading.value = true
  try {
    departments.value = await departmentsApi.list().catch(() => [])
    enrollments.value = await trackingApi.listEnrollments()
    unavailable.value = false
    await loadTracks()
  } catch (e) {
    if (e instanceof ApiException && (e.status === 403 || e.status === 404)) unavailable.value = true
    else notifyError(e, t('common.loadError'))
  } finally {
    loading.value = false
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  stopLive()
  stopPlayback()
})
</script>

<template>
  <div>
    <PageHeader :title="t('trackingMap.title')" :subtitle="t('trackingMap.subtitle')" />

    <Message v-if="unavailable" severity="info" :closable="false">{{ t('trackingMap.unavailable') }}</Message>

    <template v-else>
      <!-- شريط التحكّم -->
      <div class="mb-4 rounded-2xl border border-surface-200 bg-white p-4 dark:border-surface-800 dark:bg-surface-900">
        <div class="flex flex-wrap items-end gap-3">
          <div>
            <label class="mb-1 block text-xs text-surface-500">{{ t('trackingMap.mode') }}</label>
            <SelectButton v-model="mode" :options="modeOptions" option-label="label" option-value="value" :allow-empty="false" />
          </div>
          <div class="min-w-40">
            <label class="mb-1 block text-xs text-surface-500">{{ t('trackingMap.department') }}</label>
            <Select v-model="deptFilter" :options="deptOptions" option-label="label" option-value="value" fluid />
          </div>
          <div class="min-w-64 flex-1">
            <label class="mb-1 block text-xs text-surface-500">{{ t('trackingMap.employees') }}</label>
            <MultiSelect
              v-model="selectedUserIds"
              :options="employeeOptions"
              option-label="label"
              option-value="value"
              :placeholder="t('trackingMap.selectEmployees')"
              filter
              fluid
              :max-selected-labels="3"
              :selected-items-label="t('trackingMap.nSelected', { n: selectedUserIds.length })"
            />
          </div>
          <div class="flex gap-2">
            <Button :label="t('trackingMap.selectAll')" size="small" severity="secondary" outlined icon="pi pi-check-square" @click="selectAll" />
            <Button :label="t('trackingMap.clear')" size="small" severity="secondary" text :disabled="!selectedUserIds.length" @click="clearSelection" />
          </div>
        </div>

        <!-- صفّ الفترة (تاريخي فقط) -->
        <div v-if="mode === 'history'" class="mt-3 flex flex-wrap items-end gap-3 border-t border-surface-100 pt-3 dark:border-surface-800">
          <div>
            <label class="mb-1 block text-xs text-surface-500">{{ t('trackingMap.from') }}</label>
            <input v-model="fromDate" type="date" class="rounded-lg border border-surface-300 bg-transparent px-3 py-2 text-sm text-surface-800 dark:border-surface-700 dark:text-surface-100" />
          </div>
          <div>
            <label class="mb-1 block text-xs text-surface-500">{{ t('trackingMap.to') }}</label>
            <input v-model="toDate" type="date" class="rounded-lg border border-surface-300 bg-transparent px-3 py-2 text-sm text-surface-800 dark:border-surface-700 dark:text-surface-100" />
          </div>
          <Button :label="t('trackingMap.apply')" icon="pi pi-search" :loading="loadingMap" @click="apply" />
          <div class="flex gap-2">
            <Button :label="t('trackingMap.today')" size="small" severity="secondary" outlined @click="setRangeDays(1)" />
            <Button :label="t('trackingMap.last7')" size="small" severity="secondary" outlined @click="setRangeDays(7)" />
          </div>
        </div>

        <!-- شريط المباشر -->
        <div v-else class="mt-3 flex flex-wrap items-center gap-3 border-t border-surface-100 pt-3 dark:border-surface-800">
          <span class="inline-flex items-center gap-2 text-sm font-medium text-rose-600 dark:text-rose-400">
            <span class="relative flex size-2.5">
              <span class="absolute inline-flex size-full animate-ping rounded-full bg-rose-400 opacity-75"></span>
              <span class="relative inline-flex size-2.5 rounded-full bg-rose-500"></span>
            </span>
            {{ t('trackingMap.liveBadge') }}
          </span>
          <span class="text-xs text-surface-500">{{ t('trackingMap.liveHint') }}</span>
          <span v-if="lastPolledAt" class="text-xs text-surface-400" dir="ltr">· {{ t('trackingMap.updated') }} {{ lastPolledAt }}</span>
          <Button :label="t('trackingMap.refresh')" size="small" icon="pi pi-refresh" severity="secondary" outlined class="ms-auto" @click="apply" />
        </div>
      </div>

      <div v-if="downsampled" class="mb-3">
        <Message severity="warn" :closable="false">{{ t('trackingMap.downsampled') }}</Message>
      </div>

      <div
        :class="isFullscreen ? 'fixed inset-0 z-[1100] flex flex-col gap-3 overflow-auto bg-surface-50 p-4 dark:bg-surface-950' : ''"
      >
        <div class="mb-3 flex items-center justify-end" :class="isFullscreen ? '!mb-0' : ''">
          <Button
            :icon="isFullscreen ? 'pi pi-window-minimize' : 'pi pi-window-maximize'"
            :label="isFullscreen ? t('trackingMap.exitFullscreen') : t('trackingMap.fullscreen')"
            size="small"
            severity="secondary"
            outlined
            @click="toggleFullscreen"
          />
        </div>

        <div class="grid gap-4 lg:grid-cols-[1fr_18rem]" :class="isFullscreen ? 'min-h-0 flex-1' : ''">
        <!-- الخريطة + المشغّل الزمني -->
        <div class="flex min-w-0 flex-col">
          <Message v-if="!mapSeries.length" severity="info" :closable="false">{{ t('trackingMap.noTracks') }}</Message>
          <template v-else>
            <div :class="isFullscreen ? 'min-h-0 flex-1' : 'h-[32rem]'">
              <GroupTrackMap :series="mapSeries" :mode="mode" :cursor-time="cursorTime" />
            </div>

            <!-- المشغّل الزمني (تاريخي) -->
            <div v-if="hasTimeline" class="mt-3 rounded-xl border border-surface-200 bg-white p-3 dark:border-surface-800 dark:bg-surface-900">
              <div class="flex items-center gap-3">
                <Button :icon="playing ? 'pi pi-pause' : 'pi pi-play'" rounded :aria-label="playing ? t('trackingMap.pause') : t('trackingMap.play')" @click="togglePlay" />
                <input
                  type="range"
                  class="h-2 flex-1 cursor-pointer accent-primary-600"
                  :min="minTime"
                  :max="maxTime"
                  :step="sliderStep"
                  :value="cursorTime ?? minTime"
                  @input="onSliderInput"
                />
                <span class="min-w-40 text-end font-mono text-xs text-surface-600 dark:text-surface-300" dir="ltr">{{ cursorLabel }}</span>
              </div>
              <div class="mt-2 flex items-center gap-2">
                <span class="text-xs text-surface-500">{{ t('trackingMap.speed') }}</span>
                <SelectButton v-model="speed" :options="speedOptions" option-label="label" option-value="value" :allow-empty="false" size="small" />
              </div>
            </div>
          </template>
        </div>

        <!-- مفتاح الألوان (legend) -->
        <div class="rounded-2xl border border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
          <div class="border-b border-surface-100 px-4 py-3 dark:border-surface-800">
            <h2 class="text-sm font-semibold text-surface-700 dark:text-surface-200">{{ t('trackingMap.legend') }}</h2>
          </div>
          <div class="max-h-[28rem] overflow-y-auto p-2">
            <p v-if="!legend.length" class="px-2 py-6 text-center text-sm text-surface-500">{{ t('trackingMap.noTracks') }}</p>
            <button
              v-for="row in legend"
              :key="row.id"
              type="button"
              class="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-start transition hover:bg-surface-50 dark:hover:bg-surface-800"
              :class="{ 'opacity-40': row.hidden }"
              :title="row.hidden ? t('trackingMap.show') : t('trackingMap.hide')"
              @click="toggleHidden(row.id)"
            >
              <span class="size-3 shrink-0 rounded-full" :style="{ backgroundColor: row.color }"></span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-medium text-surface-800 dark:text-surface-100">{{ row.name }}</span>
                <span class="block text-[11px] text-surface-500" dir="ltr">
                  <Tag v-if="!row.lastSeen" :value="t('trackingMap.never')" severity="secondary" class="!py-0 !text-[10px]" />
                  <template v-else>{{ ymd(row.lastSeen) }} · {{ t('trackingMap.pointsN', { n: row.count }) }}</template>
                </span>
              </span>
              <i class="pi shrink-0 text-surface-400" :class="row.hidden ? 'pi-eye-slash' : 'pi-eye'" />
            </button>
          </div>
        </div>
        </div>
      </div>
    </template>
  </div>
</template>
