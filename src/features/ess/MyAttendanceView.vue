<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import Message from 'primevue/message'
import PageHeader from '@/components/PageHeader.vue'
import { ApiException } from '@/api/client'
import { myAttendanceApi, type MyAttendanceRecord, type MyAttendanceSummary } from '@/api/ess'

const { t, locale } = useI18n()
const toast = useToast()

const records = ref<MyAttendanceRecord[]>([])
const summary = ref<MyAttendanceSummary>({})
const loading = ref(false)
const available = ref(true) // تدهور آمن: إن حُجب /me/attendance تُعرَض رسالة.

// الشهر الحالي (مؤشّر) — يبدأ بالشهر الجاري.
const cursor = ref(new Date())
const monthKey = computed(() => {
  const y = cursor.value.getFullYear()
  const m = String(cursor.value.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
})
const monthLabel = computed(() =>
  new Intl.DateTimeFormat(locale.value === 'ar' ? 'ar' : 'en', { year: 'numeric', month: 'long' }).format(cursor.value),
)

const time = (v?: string | null) => (v ? new Date(v).toLocaleTimeString(locale.value === 'ar' ? 'ar' : 'en', { hour: '2-digit', minute: '2-digit' }) : '—')

function statusSeverity(s?: string | null): 'success' | 'danger' | 'warn' | 'secondary' {
  if (s === 'present' || s === 'checked_out') return 'success'
  if (s === 'absent' || s === 'no_show' || s === 'missing_checkout') return 'danger'
  if (s === 'late') return 'warn'
  return 'secondary'
}
function statusLabel(s?: string | null): string {
  if (!s) return '—'
  const key = 'myAttendance.st.' + s
  const tr = t(key)
  return tr === key ? s : tr
}

const cards = computed(() => [
  { key: 'present', value: summary.value.present_days, icon: 'pi pi-check-circle', cls: 'text-emerald-600 dark:text-emerald-400' },
  { key: 'absent', value: summary.value.absent_days, icon: 'pi pi-times-circle', cls: 'text-red-600 dark:text-red-400' },
  { key: 'late', value: summary.value.late_count, icon: 'pi pi-clock', cls: 'text-amber-600 dark:text-amber-400' },
  { key: 'hours', value: summary.value.worked_hours, icon: 'pi pi-hourglass', cls: 'text-indigo-600 dark:text-indigo-400' },
])
const hasSummary = computed(() => cards.value.some((c) => c.value !== undefined && c.value !== null))

async function load(): Promise<void> {
  loading.value = true
  try {
    const res = await myAttendanceApi.list(monthKey.value)
    records.value = res.records
    summary.value = res.summary
    available.value = true
  } catch (e) {
    if (e instanceof ApiException && (e.status === 403 || e.status === 404 || e.status === 405)) {
      available.value = false
      records.value = []
      summary.value = {}
    } else {
      toast.add({ severity: 'error', summary: t('common.error'), detail: t('common.loadError'), life: 4000 })
    }
  } finally {
    loading.value = false
  }
}

function shift(delta: number): void {
  const d = new Date(cursor.value)
  d.setDate(1) // التثبيت على أول الشهر يمنع تجاوز setMonth في الأيام 29–31 (تخطّي شهر).
  d.setMonth(d.getMonth() + delta)
  cursor.value = d
  load()
}
function thisMonth(): void {
  cursor.value = new Date()
  load()
}

onMounted(load)
</script>

<template>
  <div class="mx-auto max-w-4xl">
    <PageHeader :title="t('myAttendance.title')" :subtitle="t('myAttendance.subtitle')" />

    <!-- شريط التنقّل الشهري -->
    <div class="mb-5 flex items-center justify-between rounded-2xl border border-surface-200 bg-white px-4 py-3 dark:border-surface-800 dark:bg-surface-900">
      <Button icon="pi pi-chevron-right" severity="secondary" text rounded :aria-label="t('myAttendance.prev')" @click="shift(-1)" />
      <div class="flex items-center gap-3">
        <span class="text-base font-semibold text-surface-900 dark:text-white">{{ monthLabel }}</span>
        <Button :label="t('myAttendance.thisMonth')" size="small" severity="secondary" outlined @click="thisMonth" />
      </div>
      <Button icon="pi pi-chevron-left" severity="secondary" text rounded :aria-label="t('myAttendance.next')" @click="shift(1)" />
    </div>

    <!-- محجوب (تدهور آمن) -->
    <Message v-if="!available" severity="info" :closable="false" class="mb-5">
      {{ t('myAttendance.unavailable') }}
    </Message>

    <template v-else>
      <!-- بطاقات الملخّص -->
      <div v-if="hasSummary" class="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div
          v-for="c in cards"
          :key="c.key"
          class="rounded-2xl border border-surface-200 bg-white p-4 dark:border-surface-800 dark:bg-surface-900"
        >
          <div class="flex items-center gap-2">
            <i :class="[c.icon, c.cls]" />
            <p class="text-xs text-surface-500">{{ t('myAttendance.' + c.key) }}</p>
          </div>
          <p class="mt-1 text-2xl font-semibold text-surface-900 dark:text-white" dir="ltr">{{ c.value ?? '—' }}</p>
        </div>
      </div>

      <!-- جدول السجلات -->
      <div class="overflow-hidden rounded-2xl border border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
        <div class="border-b border-surface-100 px-4 py-3 dark:border-surface-800">
          <h2 class="text-sm font-semibold text-surface-700 dark:text-surface-200">{{ t('myAttendance.recordsTitle') }}</h2>
        </div>
        <DataTable :value="records" :loading="loading" paginator :rows="15" :rows-per-page-options="[15, 31]" data-key="date" striped-rows removable-sort>
          <template #empty>
            <p class="py-6 text-center text-sm text-surface-500">{{ t('myAttendance.empty') }}</p>
          </template>
          <Column field="date" :header="t('myAttendance.date')" sortable>
            <template #body="{ data }"><span class="font-medium text-surface-900 dark:text-white" dir="ltr">{{ (data.date || '').slice(0, 10) }}</span></template>
          </Column>
          <Column :header="t('myAttendance.checkIn')">
            <template #body="{ data }"><span class="text-surface-500" dir="ltr">{{ time(data.check_in_at) }}</span></template>
          </Column>
          <Column :header="t('myAttendance.checkOut')">
            <template #body="{ data }"><span class="text-surface-500" dir="ltr">{{ time(data.check_out_at) }}</span></template>
          </Column>
          <Column :header="t('myAttendance.shift')">
            <template #body="{ data }"><span class="text-surface-500">{{ data.shift_name ?? '—' }}</span></template>
          </Column>
          <Column :header="t('myAttendance.lateMinutes')">
            <template #body="{ data }"><span class="text-surface-500" dir="ltr">{{ data.late_minutes ?? '—' }}</span></template>
          </Column>
          <Column :header="t('myAttendance.status')">
            <template #body="{ data }"><Tag :value="statusLabel(data.status)" :severity="statusSeverity(data.status)" /></template>
          </Column>
        </DataTable>
      </div>
    </template>
  </div>
</template>
