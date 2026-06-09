<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ApiException } from '@/api/client'
import {
  shiftsApi,
  schedulesApi,
  holidaysApi,
  type Shift,
  type Schedule,
  type Holiday,
} from '@/api/schedule'
import { usersApi, type User } from '@/api/users'

const { t } = useI18n()

type Tab = 'shifts' | 'schedules' | 'holidays'
const tab = ref<Tab>('shifts')

const error = ref('')
const saving = ref(false)

const shifts = ref<Shift[]>([])
const schedules = ref<Schedule[]>([])
const holidays = ref<Holiday[]>([])
const users = ref<User[]>([])

// weekday باصطلاح Carbon: 0=الأحد … 6=السبت.
const weekdayKeys = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
const weekdays = weekdayKeys.map((key, value) => ({ value, key }))

function messageFor(e: unknown, fallback: string): string {
  return e instanceof ApiException ? e.message : fallback
}

const userName = (id: number) => users.value.find((u) => u.id === id)?.name ?? `#${id}`
const shiftName = (id: number) => shifts.value.find((s) => s.id === id)?.name ?? `#${id}`
const hhmm = (time: string) => time.slice(0, 5)
// الباك قد يُرجع التاريخ بصيغة ISO كاملة؛ نعرض/نحرّر جزء YYYY-MM-DD فقط.
const ymd = (date: string) => date.slice(0, 10)

async function loadAll(): Promise<void> {
  error.value = ''
  try {
    const [sh, sc, ho, us] = await Promise.all([
      shiftsApi.list(),
      schedulesApi.list(),
      holidaysApi.list(),
      usersApi.list({ per_page: 100 }),
    ])
    shifts.value = sh
    schedules.value = sc
    holidays.value = ho
    users.value = us.data
  } catch (e) {
    error.value = messageFor(e, t('common.loadError'))
  }
}

// ===== الورديات =====
const shiftForm = reactive({
  open: false,
  id: null as number | null,
  name: '',
  start_time: '08:00',
  end_time: '16:00',
  hours: 8,
  grace_minutes: 0,
})
function openShift(s?: Shift): void {
  shiftForm.open = true
  shiftForm.id = s?.id ?? null
  shiftForm.name = s?.name ?? ''
  shiftForm.start_time = s ? hhmm(s.start_time) : '08:00'
  shiftForm.end_time = s ? hhmm(s.end_time) : '16:00'
  shiftForm.hours = s?.hours ?? 8
  shiftForm.grace_minutes = s?.grace_minutes ?? 0
}
async function submitShift(): Promise<void> {
  saving.value = true
  error.value = ''
  try {
    const payload = {
      name: shiftForm.name,
      start_time: shiftForm.start_time,
      end_time: shiftForm.end_time,
      hours: shiftForm.hours,
      grace_minutes: shiftForm.grace_minutes,
    }
    if (shiftForm.id === null) await shiftsApi.create(payload)
    else await shiftsApi.update(shiftForm.id, payload)
    shiftForm.open = false
    await loadAll()
  } catch (e) {
    error.value = messageFor(e, t('common.saveError'))
  } finally {
    saving.value = false
  }
}
async function removeShift(s: Shift): Promise<void> {
  if (!window.confirm(t('schedule.confirmDeleteShift', { name: s.name }))) return
  error.value = ''
  try {
    await shiftsApi.remove(s.id)
    await loadAll()
  } catch (e) {
    error.value = messageFor(e, t('common.saveError'))
  }
}

// ===== الجداول =====
const scheduleForm = reactive({
  open: false,
  id: null as number | null,
  user_id: 0,
  shift_id: 0,
  mode: 'weekday' as 'weekday' | 'date',
  weekday: 0,
  work_date: '',
})
function openSchedule(s?: Schedule): void {
  scheduleForm.open = true
  scheduleForm.id = s?.id ?? null
  scheduleForm.user_id = s?.user_id ?? users.value[0]?.id ?? 0
  scheduleForm.shift_id = s?.shift_id ?? shifts.value[0]?.id ?? 0
  scheduleForm.mode = s?.work_date ? 'date' : 'weekday'
  scheduleForm.weekday = s?.weekday ?? 0
  scheduleForm.work_date = s?.work_date ? ymd(s.work_date) : ''
}
async function submitSchedule(): Promise<void> {
  saving.value = true
  error.value = ''
  try {
    const payload = {
      user_id: scheduleForm.user_id,
      shift_id: scheduleForm.shift_id,
      work_date: scheduleForm.mode === 'date' ? scheduleForm.work_date : null,
      weekday: scheduleForm.mode === 'weekday' ? scheduleForm.weekday : null,
    }
    if (scheduleForm.id === null) await schedulesApi.create(payload)
    else await schedulesApi.update(scheduleForm.id, payload)
    scheduleForm.open = false
    await loadAll()
  } catch (e) {
    error.value = messageFor(e, t('common.saveError'))
  } finally {
    saving.value = false
  }
}
async function removeSchedule(s: Schedule): Promise<void> {
  if (!window.confirm(t('schedule.confirmDeleteSchedule'))) return
  error.value = ''
  try {
    await schedulesApi.remove(s.id)
    await loadAll()
  } catch (e) {
    error.value = messageFor(e, t('common.saveError'))
  }
}

// ===== العطل =====
const holidayForm = reactive({ open: false, id: null as number | null, date: '', name: '' })
function openHoliday(h?: Holiday): void {
  holidayForm.open = true
  holidayForm.id = h?.id ?? null
  holidayForm.date = h?.date ? ymd(h.date) : ''
  holidayForm.name = h?.name ?? ''
}
async function submitHoliday(): Promise<void> {
  saving.value = true
  error.value = ''
  try {
    const payload = { date: holidayForm.date, name: holidayForm.name }
    if (holidayForm.id === null) await holidaysApi.create(payload)
    else await holidaysApi.update(holidayForm.id, payload)
    holidayForm.open = false
    await loadAll()
  } catch (e) {
    error.value = messageFor(e, t('common.saveError'))
  } finally {
    saving.value = false
  }
}
async function removeHoliday(h: Holiday): Promise<void> {
  if (!window.confirm(t('schedule.confirmDeleteHoliday', { name: h.name }))) return
  error.value = ''
  try {
    await holidaysApi.remove(h.id)
    await loadAll()
  } catch (e) {
    error.value = messageFor(e, t('common.saveError'))
  }
}

const tabs: { key: Tab; label: string }[] = [
  { key: 'shifts', label: 'schedule.tabShifts' },
  { key: 'schedules', label: 'schedule.tabSchedules' },
  { key: 'holidays', label: 'schedule.tabHolidays' },
]

const canPickSchedule = computed(() => users.value.length > 0 && shifts.value.length > 0)

onMounted(loadAll)
</script>

<template>
  <div class="mx-auto max-w-4xl">
    <h1 class="mb-6 text-2xl font-bold text-slate-900 dark:text-white">{{ t('schedule.title') }}</h1>

    <div class="mb-6 flex gap-1 border-b border-slate-200 dark:border-slate-800">
      <button
        v-for="tb in tabs"
        :key="tb.key"
        type="button"
        class="-mb-px border-b-2 px-4 py-2 text-sm font-medium transition"
        :class="
          tab === tb.key
            ? 'border-indigo-600 text-indigo-700 dark:text-indigo-300'
            : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
        "
        @click="tab = tb.key"
      >
        {{ t(tb.label) }}
      </button>
    </div>

    <p v-if="error" class="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300" role="alert">{{ error }}</p>

    <!-- ===== الورديات ===== -->
    <section v-if="tab === 'shifts'">
      <div class="mb-4 flex justify-end">
        <button v-can="'shifts.create'" type="button" class="btn-primary" @click="openShift()">{{ t('schedule.addShift') }}</button>
      </div>

      <form v-if="shiftForm.open" class="mb-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900" @submit.prevent="submitShift">
        <h2 class="font-semibold">{{ shiftForm.id === null ? t('schedule.addShift') : t('schedule.editShift') }}</h2>
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="block text-sm"><span class="lbl">{{ t('schedule.shiftName') }}</span><input v-model="shiftForm.name" type="text" required maxlength="100" class="field" /></label>
          <label class="block text-sm"><span class="lbl">{{ t('schedule.hours') }}</span><input v-model.number="shiftForm.hours" type="number" min="0" max="24" step="0.5" required class="field" /></label>
          <label class="block text-sm"><span class="lbl">{{ t('schedule.startTime') }}</span><input v-model="shiftForm.start_time" type="time" required class="field" /></label>
          <label class="block text-sm"><span class="lbl">{{ t('schedule.endTime') }}</span><input v-model="shiftForm.end_time" type="time" required class="field" /></label>
          <label class="block text-sm"><span class="lbl">{{ t('schedule.graceMinutes') }}</span><input v-model.number="shiftForm.grace_minutes" type="number" min="0" max="240" class="field" /></label>
        </div>
        <div class="flex gap-3">
          <button type="submit" :disabled="saving" class="btn-primary disabled:opacity-60">{{ saving ? t('common.saving') : t('common.save') }}</button>
          <button type="button" class="btn-ghost" @click="shiftForm.open = false">{{ t('common.cancel') }}</button>
        </div>
      </form>

      <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <p v-if="!shifts.length" class="p-6 text-sm text-slate-500">{{ t('schedule.emptyShifts') }}</p>
        <table v-else class="w-full text-start text-sm">
          <thead class="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            <tr>
              <th class="px-4 py-3 text-start">{{ t('schedule.shiftName') }}</th>
              <th class="px-4 py-3 text-start">{{ t('schedule.timeRange') }}</th>
              <th class="px-4 py-3 text-start">{{ t('schedule.hours') }}</th>
              <th class="px-4 py-3 text-start">{{ t('schedule.graceMinutes') }}</th>
              <th class="px-4 py-3 text-end">{{ t('companies.actions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            <tr v-for="s in shifts" :key="s.id">
              <td class="px-4 py-3 font-medium text-slate-900 dark:text-white">
                {{ s.name }}
                <span v-if="s.crosses_midnight" class="ms-1 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-700 dark:bg-amber-900 dark:text-amber-200">{{ t('schedule.overnight') }}</span>
              </td>
              <td class="px-4 py-3 text-slate-500" dir="ltr">{{ hhmm(s.start_time) }} – {{ hhmm(s.end_time) }}</td>
              <td class="px-4 py-3 text-slate-500">{{ s.hours }}</td>
              <td class="px-4 py-3 text-slate-500">{{ s.grace_minutes }}</td>
              <td class="px-4 py-3">
                <div class="flex justify-end gap-3">
                  <button v-can="'shifts.update'" type="button" class="text-slate-600 hover:underline dark:text-slate-300" @click="openShift(s)">{{ t('common.edit') }}</button>
                  <button v-can="'shifts.delete'" type="button" class="text-rose-600 hover:underline dark:text-rose-400" @click="removeShift(s)">{{ t('common.delete') }}</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- ===== الجداول ===== -->
    <section v-else-if="tab === 'schedules'">
      <div class="mb-4 flex justify-end">
        <button v-can="'schedules.create'" type="button" class="btn-primary disabled:opacity-60" :disabled="!canPickSchedule" @click="openSchedule()">{{ t('schedule.addSchedule') }}</button>
      </div>
      <p v-if="!canPickSchedule" class="mb-4 text-sm text-slate-500">{{ t('schedule.needShiftsAndUsers') }}</p>

      <form v-if="scheduleForm.open" class="mb-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900" @submit.prevent="submitSchedule">
        <h2 class="font-semibold">{{ scheduleForm.id === null ? t('schedule.addSchedule') : t('schedule.editSchedule') }}</h2>
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="block text-sm"><span class="lbl">{{ t('schedule.employee') }}</span>
            <select v-model.number="scheduleForm.user_id" required class="field">
              <option v-for="u in users" :key="u.id" :value="u.id">{{ u.name }}</option>
            </select>
          </label>
          <label class="block text-sm"><span class="lbl">{{ t('schedule.shift') }}</span>
            <select v-model.number="scheduleForm.shift_id" required class="field">
              <option v-for="s in shifts" :key="s.id" :value="s.id">{{ s.name }}</option>
            </select>
          </label>
          <label class="block text-sm"><span class="lbl">{{ t('schedule.recurrence') }}</span>
            <select v-model="scheduleForm.mode" class="field">
              <option value="weekday">{{ t('schedule.byWeekday') }}</option>
              <option value="date">{{ t('schedule.byDate') }}</option>
            </select>
          </label>
          <label v-if="scheduleForm.mode === 'weekday'" class="block text-sm"><span class="lbl">{{ t('schedule.weekday') }}</span>
            <select v-model.number="scheduleForm.weekday" class="field">
              <option v-for="d in weekdays" :key="d.value" :value="d.value">{{ t('days.' + d.key) }}</option>
            </select>
          </label>
          <label v-else class="block text-sm"><span class="lbl">{{ t('schedule.workDate') }}</span><input v-model="scheduleForm.work_date" type="date" required class="field" /></label>
        </div>
        <div class="flex gap-3">
          <button type="submit" :disabled="saving" class="btn-primary disabled:opacity-60">{{ saving ? t('common.saving') : t('common.save') }}</button>
          <button type="button" class="btn-ghost" @click="scheduleForm.open = false">{{ t('common.cancel') }}</button>
        </div>
      </form>

      <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <p v-if="!schedules.length" class="p-6 text-sm text-slate-500">{{ t('schedule.emptySchedules') }}</p>
        <table v-else class="w-full text-start text-sm">
          <thead class="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            <tr>
              <th class="px-4 py-3 text-start">{{ t('schedule.employee') }}</th>
              <th class="px-4 py-3 text-start">{{ t('schedule.shift') }}</th>
              <th class="px-4 py-3 text-start">{{ t('schedule.when') }}</th>
              <th class="px-4 py-3 text-end">{{ t('companies.actions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            <tr v-for="s in schedules" :key="s.id">
              <td class="px-4 py-3 font-medium text-slate-900 dark:text-white">{{ userName(s.user_id) }}</td>
              <td class="px-4 py-3 text-slate-500">{{ s.shift?.name ?? shiftName(s.shift_id) }}</td>
              <td class="px-4 py-3 text-slate-500">
                <span v-if="s.work_date">{{ ymd(s.work_date) }}</span>
                <span v-else-if="s.weekday !== null">{{ t('schedule.everyWeekday', { day: t('days.' + weekdayKeys[s.weekday]) }) }}</span>
                <span v-else>—</span>
              </td>
              <td class="px-4 py-3">
                <div class="flex justify-end gap-3">
                  <button v-can="'schedules.update'" type="button" class="text-slate-600 hover:underline dark:text-slate-300" @click="openSchedule(s)">{{ t('common.edit') }}</button>
                  <button v-can="'schedules.delete'" type="button" class="text-rose-600 hover:underline dark:text-rose-400" @click="removeSchedule(s)">{{ t('common.delete') }}</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- ===== العطل ===== -->
    <section v-else>
      <div class="mb-4 flex justify-end">
        <button v-can="'holidays.create'" type="button" class="btn-primary" @click="openHoliday()">{{ t('schedule.addHoliday') }}</button>
      </div>

      <form v-if="holidayForm.open" class="mb-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900" @submit.prevent="submitHoliday">
        <h2 class="font-semibold">{{ holidayForm.id === null ? t('schedule.addHoliday') : t('schedule.editHoliday') }}</h2>
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="block text-sm"><span class="lbl">{{ t('schedule.date') }}</span><input v-model="holidayForm.date" type="date" required class="field" /></label>
          <label class="block text-sm"><span class="lbl">{{ t('schedule.holidayName') }}</span><input v-model="holidayForm.name" type="text" required maxlength="150" class="field" /></label>
        </div>
        <div class="flex gap-3">
          <button type="submit" :disabled="saving" class="btn-primary disabled:opacity-60">{{ saving ? t('common.saving') : t('common.save') }}</button>
          <button type="button" class="btn-ghost" @click="holidayForm.open = false">{{ t('common.cancel') }}</button>
        </div>
      </form>

      <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <p v-if="!holidays.length" class="p-6 text-sm text-slate-500">{{ t('schedule.emptyHolidays') }}</p>
        <table v-else class="w-full text-start text-sm">
          <thead class="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            <tr>
              <th class="px-4 py-3 text-start">{{ t('schedule.date') }}</th>
              <th class="px-4 py-3 text-start">{{ t('schedule.holidayName') }}</th>
              <th class="px-4 py-3 text-end">{{ t('companies.actions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            <tr v-for="h in holidays" :key="h.id">
              <td class="px-4 py-3 font-medium text-slate-900 dark:text-white" dir="ltr">{{ ymd(h.date) }}</td>
              <td class="px-4 py-3 text-slate-500">{{ h.name }}</td>
              <td class="px-4 py-3">
                <div class="flex justify-end gap-3">
                  <button v-can="'holidays.update'" type="button" class="text-slate-600 hover:underline dark:text-slate-300" @click="openHoliday(h)">{{ t('common.edit') }}</button>
                  <button v-can="'holidays.delete'" type="button" class="text-rose-600 hover:underline dark:text-rose-400" @click="removeHoliday(h)">{{ t('common.delete') }}</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
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
.btn-ghost {
  border-radius: 0.5rem;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: rgb(71 85 105);
}
:global(.dark) .btn-ghost {
  color: rgb(148 163 184);
}
</style>
