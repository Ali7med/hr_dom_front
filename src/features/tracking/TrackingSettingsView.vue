<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import MultiSelect from 'primevue/multiselect'
import InputNumber from 'primevue/inputnumber'
import ToggleSwitch from 'primevue/toggleswitch'
import Message from 'primevue/message'
import Tag from 'primevue/tag'
import PageHeader from '@/components/PageHeader.vue'
import { ApiException } from '@/api/client'
import { trackingApi, type TrackingEnrollment } from '@/api/tracking'
import { usersApi, departmentsApi, type User, type Department } from '@/api/users'

// ضبط إعدادات التتبّع + تفعيل/إيقاف الموظفين (tracking.manage) — تبويب إعدادات.
// العرض/تقرير المسير في صفحة منفصلة (/tracking، tracking.view).
const { t } = useI18n()
const toast = useToast()
const confirm = useConfirm()

const loading = ref(false)
const unavailable = ref(false)

const enrollments = ref<TrackingEnrollment[]>([])
const departments = ref<Department[]>([])
const users = ref<User[]>([])

const deptName = (id: number | null): string =>
  (id != null && departments.value.find((d) => d.id === id)?.name) || '—'

function notifyError(e: unknown, fallback: string): void {
  const msg = e instanceof ApiException ? e.message : fallback
  toast.add({ severity: 'error', summary: t('common.error'), detail: msg, life: 4000 })
}

const ymd = (d?: string | null) => (d ? d.slice(0, 19).replace('T', ' ') : '—')

// ===== الإعدادات =====
const settings = reactive({ interval_minutes: 5, working_hours_only: false, retention_days: 30 })
const savingSettings = ref(false)

async function saveSettings(): Promise<void> {
  savingSettings.value = true
  try {
    const s = await trackingApi.updateSettings({
      interval_minutes: settings.interval_minutes,
      working_hours_only: settings.working_hours_only,
      retention_days: settings.retention_days,
    })
    settings.interval_minutes = s.interval_minutes
    settings.working_hours_only = s.working_hours_only
    settings.retention_days = s.retention_days
    toast.add({ severity: 'success', summary: t('common.saved'), life: 2500 })
  } catch (e) {
    notifyError(e, t('common.saveError'))
  } finally {
    savingSettings.value = false
  }
}

// ===== التفعيل =====
const enrollForm = reactive({ user_ids: [] as number[], department_ids: [] as number[] })
const enrolling = ref(false)

async function submitEnroll(): Promise<void> {
  if (!enrollForm.user_ids.length && !enrollForm.department_ids.length) {
    toast.add({ severity: 'warn', summary: t('tracking.enrollTargetRequired'), life: 3000 })
    return
  }
  enrolling.value = true
  try {
    const r = await trackingApi.enroll({
      user_ids: enrollForm.user_ids.length ? enrollForm.user_ids : undefined,
      department_ids: enrollForm.department_ids.length ? enrollForm.department_ids : undefined,
    })
    const skipped = Math.max(0, r.total_targeted - r.enrolled)
    if (r.enrolled > 0) {
      // نجاح — مع تنبيه إن كان بعض المحدَّدين مُفعّلين مسبقاً (فلا يُضافون ثانيةً).
      toast.add({
        severity: 'success',
        summary: skipped > 0 ? t('tracking.enrolledSome', { n: r.enrolled, skipped }) : t('tracking.enrolled', { n: r.enrolled }),
        life: 3000,
      })
    } else {
      // enrolled=0: المحدَّدون كلهم مُفعّلون مسبقاً — رسالة معلوماتية واضحة بدل «نجاح 0» المضلِّل.
      toast.add({ severity: 'info', summary: t('tracking.enrolledNone'), life: 3500 })
    }
    enrollForm.user_ids = []
    enrollForm.department_ids = []
    await loadEnrollments()
  } catch (e) {
    notifyError(e, t('common.saveError'))
  } finally {
    enrolling.value = false
  }
}

function confirmUnenroll(row: TrackingEnrollment): void {
  confirm.require({
    message: t('tracking.confirmUnenroll', { name: row.name }),
    header: t('tracking.unenroll'),
    icon: 'pi pi-exclamation-triangle',
    acceptProps: { severity: 'danger', label: t('tracking.unenroll') },
    rejectProps: { severity: 'secondary', outlined: true, label: t('common.cancel') },
    accept: async () => {
      try {
        await trackingApi.unenroll(row.user_id)
        toast.add({ severity: 'success', summary: t('tracking.unenrolled'), life: 2500 })
        await loadEnrollments()
      } catch (e) {
        notifyError(e, t('common.saveError'))
      }
    },
  })
}

async function loadEnrollments(): Promise<void> {
  enrollments.value = await trackingApi.listEnrollments()
}

onMounted(async () => {
  loading.value = true
  try {
    const [s, u, depts] = await Promise.all([
      trackingApi.getSettings(),
      usersApi.list({ per_page: 200 }).then((r) => r.data).catch(() => [] as User[]),
      departmentsApi.list().catch(() => [] as Department[]),
    ])
    settings.interval_minutes = s.interval_minutes
    settings.working_hours_only = s.working_hours_only
    settings.retention_days = s.retention_days
    users.value = u
    departments.value = depts
    await loadEnrollments()
    unavailable.value = false
  } catch (e) {
    if (e instanceof ApiException && (e.status === 403 || e.status === 404)) unavailable.value = true
    else notifyError(e, t('common.loadError'))
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div>
    <PageHeader :title="t('tracking.settingsTitle')" :subtitle="t('tracking.settingsSubtitle')" />

    <Message v-if="unavailable" severity="info" :closable="false">{{ t('tracking.unavailable') }}</Message>

    <template v-else>
      <div class="grid gap-4 lg:grid-cols-2">
        <!-- بطاقة الإعدادات -->
        <div class="rounded-2xl border border-surface-200 bg-white p-5 dark:border-surface-800 dark:bg-surface-900">
          <h2 class="mb-1 text-sm font-semibold text-surface-700 dark:text-surface-200">{{ t('tracking.settingsTitle') }}</h2>
          <Message severity="warn" :closable="false" class="mb-4">{{ t('tracking.privacyNote') }}</Message>
          <div class="space-y-4">
            <div>
              <label class="mb-1 block text-sm text-surface-600 dark:text-surface-300">{{ t('tracking.interval') }}</label>
              <InputNumber v-model="settings.interval_minutes" :min="1" :max="60" :suffix="' ' + t('tracking.minutes')" fluid showButtons />
            </div>
            <div>
              <label class="mb-1 block text-sm text-surface-600 dark:text-surface-300">{{ t('tracking.retention') }}</label>
              <InputNumber v-model="settings.retention_days" :min="1" :suffix="' ' + t('tracking.days')" fluid showButtons />
            </div>
            <div class="flex items-center justify-between rounded-xl bg-surface-50 px-3 py-2.5 dark:bg-surface-800/50">
              <div>
                <p class="text-sm font-medium text-surface-700 dark:text-surface-200">{{ t('tracking.workingHoursOnly') }}</p>
                <p class="text-xs text-surface-500">{{ t('tracking.workingHoursHint') }}</p>
              </div>
              <ToggleSwitch v-model="settings.working_hours_only" />
            </div>
            <Button :label="t('common.save')" icon="pi pi-check" :loading="savingSettings" @click="saveSettings" />
          </div>
        </div>

        <!-- بطاقة التفعيل -->
        <div class="rounded-2xl border border-surface-200 bg-white p-5 dark:border-surface-800 dark:bg-surface-900">
          <h2 class="mb-1 text-sm font-semibold text-surface-700 dark:text-surface-200">{{ t('tracking.enrollTitle') }}</h2>
          <p class="mb-4 text-xs text-surface-500">{{ t('tracking.enrollHint') }}</p>
          <div class="space-y-4">
            <div>
              <label class="mb-1 block text-sm text-surface-600 dark:text-surface-300">{{ t('tracking.byDepartment') }}</label>
              <MultiSelect
                v-model="enrollForm.department_ids"
                :options="departments"
                option-label="name"
                option-value="id"
                :placeholder="t('tracking.selectDepartments')"
                filter
                fluid
              />
            </div>
            <div>
              <label class="mb-1 block text-sm text-surface-600 dark:text-surface-300">{{ t('tracking.byEmployee') }}</label>
              <MultiSelect
                v-model="enrollForm.user_ids"
                :options="users"
                option-label="name"
                option-value="id"
                :placeholder="t('tracking.selectEmployees')"
                filter
                fluid
              />
            </div>
            <Button :label="t('tracking.enroll')" icon="pi pi-map-marker" :loading="enrolling" @click="submitEnroll" />
          </div>
        </div>
      </div>

      <!-- قائمة المُفعّلين (مع الإيقاف) -->
      <div class="mt-5 overflow-hidden rounded-2xl border border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
        <div class="border-b border-surface-100 px-4 py-3 dark:border-surface-800">
          <h2 class="text-sm font-semibold text-surface-700 dark:text-surface-200">{{ t('tracking.enrolledTitle') }}</h2>
        </div>
        <DataTable :value="enrollments" :loading="loading" paginator :rows="10" :rows-per-page-options="[10, 25, 50]" data-key="user_id" striped-rows>
          <template #empty>
            <p class="py-6 text-center text-sm text-surface-500">{{ t('tracking.noEnrollments') }}</p>
          </template>
          <Column field="name" :header="t('tracking.employee')" sortable>
            <template #body="{ data }">
              <div class="font-medium text-surface-900 dark:text-white">{{ data.name }}</div>
              <div class="text-xs text-surface-500" dir="ltr">{{ data.employee_no || '—' }}</div>
            </template>
          </Column>
          <Column :header="t('tracking.department')"><template #body="{ data }">{{ deptName(data.department_id) }}</template></Column>
          <Column :header="t('tracking.enabledAt')"><template #body="{ data }"><span class="font-mono text-xs text-surface-500" dir="ltr">{{ ymd(data.enabled_at) }}</span></template></Column>
          <Column :header="t('tracking.lastSeen')">
            <template #body="{ data }">
              <Tag v-if="!data.last_seen_at" :value="t('tracking.neverSeen')" severity="secondary" />
              <span v-else class="font-mono text-xs text-surface-600 dark:text-surface-300" dir="ltr">{{ ymd(data.last_seen_at) }}</span>
            </template>
          </Column>
          <Column class="text-end">
            <template #body="{ data }">
              <Button v-tooltip.top="t('tracking.unenroll')" icon="pi pi-times" severity="danger" text rounded @click="confirmUnenroll(data)" />
            </template>
          </Column>
        </DataTable>
      </div>
    </template>
  </div>
</template>
