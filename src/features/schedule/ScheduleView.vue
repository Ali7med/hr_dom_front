<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
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
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import PageHeader from '@/components/PageHeader.vue'
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
const confirm = useConfirm()
const toast = useToast()

type Tab = 'shifts' | 'schedules' | 'holidays'
const tab = ref<Tab>('shifts')

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
function notifyError(e: unknown, fallback: string): void {
  toast.add({ severity: 'error', summary: t('common.error'), detail: messageFor(e, fallback), life: 4000 })
}

const userName = (id: number) => users.value.find((u) => u.id === id)?.name ?? `#${id}`
const shiftName = (id: number) => shifts.value.find((s) => s.id === id)?.name ?? `#${id}`
const hhmm = (time: string) => time.slice(0, 5)
// الباك قد يُرجع التاريخ بصيغة ISO كاملة؛ نعرض/نحرّر جزء YYYY-MM-DD فقط.
const ymd = (date: string) => date.slice(0, 10)

async function loadAll(): Promise<void> {
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
    notifyError(e, t('common.loadError'))
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
    toast.add({ severity: 'success', summary: t('common.saved'), life: 2500 })
    await loadAll()
  } catch (e) {
    notifyError(e, t('common.saveError'))
  } finally {
    saving.value = false
  }
}
function removeShift(s: Shift): void {
  confirm.require({
    message: t('schedule.confirmDeleteShift', { name: s.name }),
    header: t('common.delete'),
    icon: 'pi pi-exclamation-triangle',
    acceptProps: { severity: 'danger', label: t('common.delete') },
    rejectProps: { severity: 'secondary', outlined: true, label: t('common.cancel') },
    accept: async () => {
      try {
        await shiftsApi.remove(s.id)
        toast.add({ severity: 'success', summary: t('common.deleted'), life: 2500 })
        await loadAll()
      } catch (e) {
        notifyError(e, t('common.saveError'))
      }
    },
  })
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
    toast.add({ severity: 'success', summary: t('common.saved'), life: 2500 })
    await loadAll()
  } catch (e) {
    notifyError(e, t('common.saveError'))
  } finally {
    saving.value = false
  }
}
function removeSchedule(s: Schedule): void {
  confirm.require({
    message: t('schedule.confirmDeleteSchedule'),
    header: t('common.delete'),
    icon: 'pi pi-exclamation-triangle',
    acceptProps: { severity: 'danger', label: t('common.delete') },
    rejectProps: { severity: 'secondary', outlined: true, label: t('common.cancel') },
    accept: async () => {
      try {
        await schedulesApi.remove(s.id)
        toast.add({ severity: 'success', summary: t('common.deleted'), life: 2500 })
        await loadAll()
      } catch (e) {
        notifyError(e, t('common.saveError'))
      }
    },
  })
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
  try {
    const payload = { date: holidayForm.date, name: holidayForm.name }
    if (holidayForm.id === null) await holidaysApi.create(payload)
    else await holidaysApi.update(holidayForm.id, payload)
    holidayForm.open = false
    toast.add({ severity: 'success', summary: t('common.saved'), life: 2500 })
    await loadAll()
  } catch (e) {
    notifyError(e, t('common.saveError'))
  } finally {
    saving.value = false
  }
}
function removeHoliday(h: Holiday): void {
  confirm.require({
    message: t('schedule.confirmDeleteHoliday', { name: h.name }),
    header: t('common.delete'),
    icon: 'pi pi-exclamation-triangle',
    acceptProps: { severity: 'danger', label: t('common.delete') },
    rejectProps: { severity: 'secondary', outlined: true, label: t('common.cancel') },
    accept: async () => {
      try {
        await holidaysApi.remove(h.id)
        toast.add({ severity: 'success', summary: t('common.deleted'), life: 2500 })
        await loadAll()
      } catch (e) {
        notifyError(e, t('common.saveError'))
      }
    },
  })
}

const canPickSchedule = computed(() => users.value.length > 0 && shifts.value.length > 0)

onMounted(loadAll)
</script>

<template>
  <div class="mx-auto max-w-4xl">
    <PageHeader :title="t('schedule.title')" />

    <Tabs :value="tab" @update:value="tab = $event as Tab">
      <TabList>
        <Tab value="shifts">{{ t('schedule.tabShifts') }}</Tab>
        <Tab value="schedules">{{ t('schedule.tabSchedules') }}</Tab>
        <Tab value="holidays">{{ t('schedule.tabHolidays') }}</Tab>
      </TabList>
      <TabPanels>
        <!-- ===== الورديات ===== -->
        <TabPanel value="shifts">
          <div class="mb-4 flex justify-end">
            <Button v-can="'shifts.create'" :label="t('schedule.addShift')" icon="pi pi-plus" @click="openShift()" />
          </div>

          <div class="overflow-hidden rounded-2xl border border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
            <DataTable
              :value="shifts"
              paginator
              :rows="10"
              :rows-per-page-options="[10, 20, 50]"
              data-key="id"
              striped-rows
              removable-sort
            >
              <template #empty>
                <p class="py-6 text-center text-sm text-surface-500">{{ t('schedule.emptyShifts') }}</p>
              </template>

              <Column field="name" :header="t('schedule.shiftName')" sortable>
                <template #body="{ data }">
                  <span class="font-medium text-surface-900 dark:text-white">{{ data.name }}</span>
                  <Tag v-if="data.crosses_midnight" class="ms-1" severity="warn" :value="t('schedule.overnight')" />
                </template>
              </Column>
              <Column :header="t('schedule.timeRange')">
                <template #body="{ data }">
                  <span class="text-surface-500" dir="ltr">{{ hhmm(data.start_time) }} – {{ hhmm(data.end_time) }}</span>
                </template>
              </Column>
              <Column field="hours" :header="t('schedule.hours')" sortable>
                <template #body="{ data }"><span class="text-surface-500">{{ data.hours }}</span></template>
              </Column>
              <Column field="grace_minutes" :header="t('schedule.graceMinutes')" sortable>
                <template #body="{ data }"><span class="text-surface-500">{{ data.grace_minutes }}</span></template>
              </Column>
              <Column :header="t('companies.actions')" class="text-end">
                <template #body="{ data }">
                  <div class="flex justify-end gap-1">
                    <Button
                      v-can="'shifts.update'"
                      v-tooltip.top="t('common.edit')"
                      icon="pi pi-pencil"
                      severity="secondary"
                      text
                      rounded
                      @click="openShift(data)"
                    />
                    <Button
                      v-can="'shifts.delete'"
                      v-tooltip.top="t('common.delete')"
                      icon="pi pi-trash"
                      severity="danger"
                      text
                      rounded
                      @click="removeShift(data)"
                    />
                  </div>
                </template>
              </Column>
            </DataTable>
          </div>
        </TabPanel>

        <!-- ===== الجداول ===== -->
        <TabPanel value="schedules">
          <div class="mb-4 flex justify-end">
            <Button
              v-can="'schedules.create'"
              :label="t('schedule.addSchedule')"
              icon="pi pi-plus"
              :disabled="!canPickSchedule"
              @click="openSchedule()"
            />
          </div>
          <p v-if="!canPickSchedule" class="mb-4 text-sm text-surface-500">{{ t('schedule.needShiftsAndUsers') }}</p>

          <div class="overflow-hidden rounded-2xl border border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
            <DataTable
              :value="schedules"
              paginator
              :rows="10"
              :rows-per-page-options="[10, 20, 50]"
              data-key="id"
              striped-rows
              removable-sort
            >
              <template #empty>
                <p class="py-6 text-center text-sm text-surface-500">{{ t('schedule.emptySchedules') }}</p>
              </template>

              <Column :header="t('schedule.employee')">
                <template #body="{ data }">
                  <span class="font-medium text-surface-900 dark:text-white">{{ userName(data.user_id) }}</span>
                </template>
              </Column>
              <Column :header="t('schedule.shift')">
                <template #body="{ data }">
                  <span class="text-surface-500">{{ data.shift?.name ?? shiftName(data.shift_id) }}</span>
                </template>
              </Column>
              <Column :header="t('schedule.when')">
                <template #body="{ data }">
                  <span class="text-surface-500">
                    <span v-if="data.work_date">{{ ymd(data.work_date) }}</span>
                    <span v-else-if="data.weekday !== null">{{ t('schedule.everyWeekday', { day: t('days.' + weekdayKeys[data.weekday]) }) }}</span>
                    <span v-else>—</span>
                  </span>
                </template>
              </Column>
              <Column :header="t('companies.actions')" class="text-end">
                <template #body="{ data }">
                  <div class="flex justify-end gap-1">
                    <Button
                      v-can="'schedules.update'"
                      v-tooltip.top="t('common.edit')"
                      icon="pi pi-pencil"
                      severity="secondary"
                      text
                      rounded
                      @click="openSchedule(data)"
                    />
                    <Button
                      v-can="'schedules.delete'"
                      v-tooltip.top="t('common.delete')"
                      icon="pi pi-trash"
                      severity="danger"
                      text
                      rounded
                      @click="removeSchedule(data)"
                    />
                  </div>
                </template>
              </Column>
            </DataTable>
          </div>
        </TabPanel>

        <!-- ===== العطل ===== -->
        <TabPanel value="holidays">
          <div class="mb-4 flex justify-end">
            <Button v-can="'holidays.create'" :label="t('schedule.addHoliday')" icon="pi pi-plus" @click="openHoliday()" />
          </div>

          <div class="overflow-hidden rounded-2xl border border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
            <DataTable
              :value="holidays"
              paginator
              :rows="10"
              :rows-per-page-options="[10, 20, 50]"
              data-key="id"
              striped-rows
              removable-sort
            >
              <template #empty>
                <p class="py-6 text-center text-sm text-surface-500">{{ t('schedule.emptyHolidays') }}</p>
              </template>

              <Column field="date" :header="t('schedule.date')" sortable>
                <template #body="{ data }">
                  <span class="font-medium text-surface-900 dark:text-white" dir="ltr">{{ ymd(data.date) }}</span>
                </template>
              </Column>
              <Column field="name" :header="t('schedule.holidayName')" sortable>
                <template #body="{ data }"><span class="text-surface-500">{{ data.name }}</span></template>
              </Column>
              <Column :header="t('companies.actions')" class="text-end">
                <template #body="{ data }">
                  <div class="flex justify-end gap-1">
                    <Button
                      v-can="'holidays.update'"
                      v-tooltip.top="t('common.edit')"
                      icon="pi pi-pencil"
                      severity="secondary"
                      text
                      rounded
                      @click="openHoliday(data)"
                    />
                    <Button
                      v-can="'holidays.delete'"
                      v-tooltip.top="t('common.delete')"
                      icon="pi pi-trash"
                      severity="danger"
                      text
                      rounded
                      @click="removeHoliday(data)"
                    />
                  </div>
                </template>
              </Column>
            </DataTable>
          </div>
        </TabPanel>
      </TabPanels>
    </Tabs>

    <!-- نموذج الوردية -->
    <Dialog
      v-model:visible="shiftForm.open"
      modal
      :header="shiftForm.id === null ? t('schedule.addShift') : t('schedule.editShift')"
      :style="{ width: '34rem' }"
      :breakpoints="{ '640px': '95vw' }"
    >
      <form class="grid gap-4 pt-2 sm:grid-cols-2" @submit.prevent="submitShift">
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('schedule.shiftName') }}</span>
          <InputText v-model="shiftForm.name" required maxlength="100" fluid />
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('schedule.hours') }}</span>
          <InputNumber v-model="shiftForm.hours" :min="0" :max="24" :step="0.5" :min-fraction-digits="0" :max-fraction-digits="1" show-buttons fluid />
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('schedule.startTime') }}</span>
          <input v-model="shiftForm.start_time" type="time" required class="p-component w-full rounded-md border border-surface-300 bg-white px-3 py-2 text-sm text-surface-900 outline-none focus:border-primary-500 dark:border-surface-700 dark:bg-surface-950 dark:text-surface-0" />
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('schedule.endTime') }}</span>
          <input v-model="shiftForm.end_time" type="time" required class="p-component w-full rounded-md border border-surface-300 bg-white px-3 py-2 text-sm text-surface-900 outline-none focus:border-primary-500 dark:border-surface-700 dark:bg-surface-950 dark:text-surface-0" />
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('schedule.graceMinutes') }}</span>
          <InputNumber v-model="shiftForm.grace_minutes" :min="0" :max="240" fluid />
        </label>

        <div class="mt-2 flex justify-end gap-2 sm:col-span-2">
          <Button type="button" :label="t('common.cancel')" severity="secondary" text @click="shiftForm.open = false" />
          <Button type="submit" :label="saving ? t('common.saving') : t('common.save')" icon="pi pi-check" :loading="saving" />
        </div>
      </form>
    </Dialog>

    <!-- نموذج الجدول -->
    <Dialog
      v-model:visible="scheduleForm.open"
      modal
      :header="scheduleForm.id === null ? t('schedule.addSchedule') : t('schedule.editSchedule')"
      :style="{ width: '34rem' }"
      :breakpoints="{ '640px': '95vw' }"
    >
      <form class="grid gap-4 pt-2 sm:grid-cols-2" @submit.prevent="submitSchedule">
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('schedule.employee') }}</span>
          <Select
            v-model="scheduleForm.user_id"
            :options="users"
            option-label="name"
            option-value="id"
            fluid
          />
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('schedule.shift') }}</span>
          <Select
            v-model="scheduleForm.shift_id"
            :options="shifts"
            option-label="name"
            option-value="id"
            fluid
          />
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('schedule.recurrence') }}</span>
          <Select
            v-model="scheduleForm.mode"
            :options="[
              { value: 'weekday', label: t('schedule.byWeekday') },
              { value: 'date', label: t('schedule.byDate') },
            ]"
            option-label="label"
            option-value="value"
            fluid
          />
        </label>
        <label v-if="scheduleForm.mode === 'weekday'" class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('schedule.weekday') }}</span>
          <Select
            v-model="scheduleForm.weekday"
            :options="weekdays"
            option-value="value"
            fluid
          >
            <template #value="{ value }">{{ t('days.' + weekdayKeys[value]) }}</template>
            <template #option="{ option }">{{ t('days.' + option.key) }}</template>
          </Select>
        </label>
        <label v-else class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('schedule.workDate') }}</span>
          <input v-model="scheduleForm.work_date" type="date" required class="p-component w-full rounded-md border border-surface-300 bg-white px-3 py-2 text-sm text-surface-900 outline-none focus:border-primary-500 dark:border-surface-700 dark:bg-surface-950 dark:text-surface-0" />
        </label>

        <div class="mt-2 flex justify-end gap-2 sm:col-span-2">
          <Button type="button" :label="t('common.cancel')" severity="secondary" text @click="scheduleForm.open = false" />
          <Button type="submit" :label="saving ? t('common.saving') : t('common.save')" icon="pi pi-check" :loading="saving" />
        </div>
      </form>
    </Dialog>

    <!-- نموذج العطلة -->
    <Dialog
      v-model:visible="holidayForm.open"
      modal
      :header="holidayForm.id === null ? t('schedule.addHoliday') : t('schedule.editHoliday')"
      :style="{ width: '34rem' }"
      :breakpoints="{ '640px': '95vw' }"
    >
      <form class="grid gap-4 pt-2 sm:grid-cols-2" @submit.prevent="submitHoliday">
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('schedule.date') }}</span>
          <input v-model="holidayForm.date" type="date" required class="p-component w-full rounded-md border border-surface-300 bg-white px-3 py-2 text-sm text-surface-900 outline-none focus:border-primary-500 dark:border-surface-700 dark:bg-surface-950 dark:text-surface-0" />
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('schedule.holidayName') }}</span>
          <InputText v-model="holidayForm.name" required maxlength="150" fluid />
        </label>

        <div class="mt-2 flex justify-end gap-2 sm:col-span-2">
          <Button type="button" :label="t('common.cancel')" severity="secondary" text @click="holidayForm.open = false" />
          <Button type="submit" :label="saving ? t('common.saving') : t('common.save')" icon="pi pi-check" :loading="saving" />
        </div>
      </form>
    </Dialog>
  </div>
</template>
