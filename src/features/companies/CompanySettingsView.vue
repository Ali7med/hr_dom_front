<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { useToast } from 'primevue/usetoast'
import InputNumber from 'primevue/inputnumber'
import MultiSelect from 'primevue/multiselect'
import Select from 'primevue/select'
import ToggleSwitch from 'primevue/toggleswitch'
import Button from 'primevue/button'
import { ApiException } from '@/api/client'
import { companiesApi, type Company, type CompanySettings } from '@/api/companies'
import { useAuthStore } from '@/stores/auth'
import PageHeader from '@/components/PageHeader.vue'

const { t } = useI18n()
const route = useRoute()
const auth = useAuthStore()
const toast = useToast()

const companyId = Number(route.params.id)
const WEEKEND_DAYS = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'] as const
const CHANNELS = ['email', 'telegram', 'fcm'] as const

const weekendOptions = WEEKEND_DAYS.map((d) => ({ value: d, label: t('days.' + d) }))
const channelOptions = CHANNELS.map((ch) => ({ value: ch, label: t('channels.' + ch) }))

const canManage = auth.can('companies.update')
const loading = ref(false)
const saving = ref(false)
const otherCompanies = ref<Company[]>([])
const importSourceId = ref<number | null>(null)

const form = reactive<CompanySettings>({
  day_hours: 8,
  default_grace_minutes: 15,
  weekend_days: [],
  hourly_leave_hours_per_day: 8,
  hourly_leave_needs_approval: true,
  hourly_leave_monthly_cap: null,
  notify_channels: [],
  settings: {},
})

// تذكيرات البصمة (BE-19) — تُخزَّن ضمن جسم settings الحرّ (لا تغيير على العقد).
const reminders = reactive({
  checkin_reminder_enabled: false,
  checkin_reminder_offset_minutes: 0,
  checkout_reminder_enabled: false,
  checkout_reminder_offset_minutes: 0,
})

function messageFor(e: unknown, fallback: string): string {
  return e instanceof ApiException ? e.message : fallback
}
function notifyError(e: unknown, fallback: string): void {
  toast.add({ severity: 'error', summary: t('common.error'), detail: messageFor(e, fallback), life: 4000 })
}

function applySettings(s: CompanySettings | null): void {
  if (!s) return
  form.day_hours = Number(s.day_hours)
  form.default_grace_minutes = s.default_grace_minutes
  form.weekend_days = s.weekend_days ?? []
  form.hourly_leave_hours_per_day = Number(s.hourly_leave_hours_per_day)
  form.hourly_leave_needs_approval = s.hourly_leave_needs_approval
  form.hourly_leave_monthly_cap = s.hourly_leave_monthly_cap
  form.notify_channels = s.notify_channels ?? []
  form.settings = s.settings ?? {}
  // تذكيرات البصمة من جسم settings الحرّ.
  const st = form.settings as Record<string, unknown>
  reminders.checkin_reminder_enabled = Boolean(st.checkin_reminder_enabled)
  reminders.checkin_reminder_offset_minutes = Number(st.checkin_reminder_offset_minutes ?? 0)
  reminders.checkout_reminder_enabled = Boolean(st.checkout_reminder_enabled)
  reminders.checkout_reminder_offset_minutes = Number(st.checkout_reminder_offset_minutes ?? 0)
}

async function load(): Promise<void> {
  loading.value = true
  try {
    const [settings, list] = await Promise.all([
      companiesApi.getSettings(companyId),
      companiesApi.list(),
    ])
    applySettings(settings)
    otherCompanies.value = list.filter((c) => c.id !== companyId)
  } catch (e) {
    notifyError(e, t('common.loadError'))
  } finally {
    loading.value = false
  }
}

async function save(): Promise<void> {
  saving.value = true
  try {
    const updated = await companiesApi.updateSettings(companyId, {
      day_hours: Number(form.day_hours),
      default_grace_minutes: form.default_grace_minutes,
      weekend_days: form.weekend_days,
      hourly_leave_hours_per_day: Number(form.hourly_leave_hours_per_day),
      hourly_leave_needs_approval: form.hourly_leave_needs_approval,
      hourly_leave_monthly_cap: form.hourly_leave_monthly_cap,
      notify_channels: form.notify_channels,
      // دمج تذكيرات البصمة مع بقية إعدادات settings الحرّة.
      settings: {
        ...form.settings,
        checkin_reminder_enabled: reminders.checkin_reminder_enabled,
        checkin_reminder_offset_minutes: reminders.checkin_reminder_offset_minutes,
        checkout_reminder_enabled: reminders.checkout_reminder_enabled,
        checkout_reminder_offset_minutes: reminders.checkout_reminder_offset_minutes,
      },
    })
    applySettings(updated)
    toast.add({ severity: 'success', summary: t('common.saved'), life: 2500 })
  } catch (e) {
    notifyError(e, t('common.saveError'))
  } finally {
    saving.value = false
  }
}

async function importFromTemplate(): Promise<void> {
  if (importSourceId.value === null) return
  saving.value = true
  try {
    applySettings(await companiesApi.importSettings(companyId, importSourceId.value))
    toast.add({ severity: 'success', summary: t('companies.imported'), life: 2500 })
  } catch (e) {
    notifyError(e, t('common.saveError'))
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="mx-auto max-w-3xl">
    <PageHeader :title="t('companies.settings')">
      <template #actions>
        <RouterLink :to="{ name: 'companies' }" class="text-sm text-primary-600 hover:underline dark:text-primary-400">
          ← {{ t('companies.title') }}
        </RouterLink>
      </template>
    </PageHeader>

    <p v-if="loading" class="text-sm text-surface-500">{{ t('common.loading') }}</p>

    <form v-else class="space-y-6" @submit.prevent="save">
      <fieldset :disabled="!canManage" class="space-y-6 disabled:opacity-70">
        <div class="grid gap-4 rounded-2xl border border-surface-200 bg-white p-6 sm:grid-cols-2 dark:border-surface-800 dark:bg-surface-900">
          <label class="block text-sm">
            <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('settings.dayHours') }}</span>
            <InputNumber :model-value="Number(form.day_hours)" @update:model-value="form.day_hours = $event" :step="0.5" :min="1" :max="24" :max-fraction-digits="2" :use-grouping="false" fluid />
          </label>
          <label class="block text-sm">
            <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('settings.graceMinutes') }}</span>
            <InputNumber v-model="form.default_grace_minutes" :min="0" :max="240" :use-grouping="false" fluid />
          </label>
          <label class="block text-sm">
            <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('settings.hourlyLeaveHours') }}</span>
            <InputNumber :model-value="Number(form.hourly_leave_hours_per_day)" @update:model-value="form.hourly_leave_hours_per_day = $event" :step="0.5" :min="1" :max="24" :max-fraction-digits="2" :use-grouping="false" fluid />
          </label>
          <label class="block text-sm">
            <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('settings.hourlyLeaveCap') }}</span>
            <InputNumber v-model="form.hourly_leave_monthly_cap" :min="0" :max="1000" :use-grouping="false" fluid />
          </label>
          <label class="flex items-center gap-2 text-sm sm:col-span-2">
            <ToggleSwitch v-model="form.hourly_leave_needs_approval" />
            <span class="font-medium text-surface-700 dark:text-surface-300">{{ t('settings.hourlyLeaveApproval') }}</span>
          </label>
        </div>

        <div class="rounded-2xl border border-surface-200 bg-white p-6 dark:border-surface-800 dark:bg-surface-900">
          <p class="mb-3 font-medium text-surface-700 dark:text-surface-300">{{ t('settings.weekendDays') }}</p>
          <MultiSelect
            v-model="form.weekend_days"
            :options="weekendOptions"
            option-label="label"
            option-value="value"
            display="chip"
            fluid
          />
        </div>

        <div class="rounded-2xl border border-surface-200 bg-white p-6 dark:border-surface-800 dark:bg-surface-900">
          <p class="mb-3 font-medium text-surface-700 dark:text-surface-300">{{ t('settings.notifyChannels') }}</p>
          <MultiSelect
            v-model="form.notify_channels"
            :options="channelOptions"
            option-label="label"
            option-value="value"
            display="chip"
            fluid
          />
        </div>

        <!-- تذكيرات البصمة (BE-19) -->
        <div class="rounded-2xl border border-surface-200 bg-white p-6 dark:border-surface-800 dark:bg-surface-900">
          <p class="mb-1 font-medium text-surface-700 dark:text-surface-300">{{ t('settings.remindersTitle') }}</p>
          <p class="mb-4 text-xs leading-relaxed text-surface-500">{{ t('settings.remindersHelp') }}</p>

          <div class="space-y-5">
            <!-- تذكير الدخول -->
            <div class="grid items-end gap-4 sm:grid-cols-[auto_1fr]">
              <label class="flex items-center gap-2 text-sm">
                <ToggleSwitch v-model="reminders.checkin_reminder_enabled" />
                <span class="font-medium text-surface-700 dark:text-surface-300">{{ t('settings.checkinReminder') }}</span>
              </label>
              <label class="block text-sm">
                <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('settings.checkinReminderOffset') }}</span>
                <InputNumber
                  v-model="reminders.checkin_reminder_offset_minutes"
                  :min="0"
                  :max="240"
                  :disabled="!reminders.checkin_reminder_enabled"
                  :use-grouping="false"
                  fluid
                />
                <span class="mt-1 block text-xs text-surface-500">{{ t('settings.checkinReminderHelp') }}</span>
              </label>
            </div>

            <!-- تذكير الخروج -->
            <div class="grid items-end gap-4 sm:grid-cols-[auto_1fr]">
              <label class="flex items-center gap-2 text-sm">
                <ToggleSwitch v-model="reminders.checkout_reminder_enabled" />
                <span class="font-medium text-surface-700 dark:text-surface-300">{{ t('settings.checkoutReminder') }}</span>
              </label>
              <label class="block text-sm">
                <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('settings.checkoutReminderOffset') }}</span>
                <InputNumber
                  v-model="reminders.checkout_reminder_offset_minutes"
                  :min="0"
                  :max="240"
                  :disabled="!reminders.checkout_reminder_enabled"
                  :use-grouping="false"
                  fluid
                />
                <span class="mt-1 block text-xs text-surface-500">{{ t('settings.checkoutReminderHelp') }}</span>
              </label>
            </div>
          </div>
        </div>

        <Button
          v-can="'companies.update'"
          type="submit"
          :label="saving ? t('common.saving') : t('common.save')"
          icon="pi pi-check"
          :loading="saving"
        />
      </fieldset>

      <!-- استيراد من قالب -->
      <div v-can="'companies.update'" class="rounded-2xl border border-surface-200 bg-white p-6 dark:border-surface-800 dark:bg-surface-900">
        <p class="mb-3 font-medium text-surface-700 dark:text-surface-300">{{ t('companies.importSettings') }}</p>
        <div class="flex flex-wrap items-center gap-3">
          <Select
            v-model="importSourceId"
            :options="otherCompanies"
            option-label="name"
            option-value="id"
            :placeholder="t('companies.chooseSource')"
            show-clear
            class="max-w-xs"
            fluid
          />
          <Button
            type="button"
            :label="t('companies.import')"
            icon="pi pi-download"
            outlined
            :disabled="saving || importSourceId === null"
            @click="importFromTemplate"
          />
        </div>
      </div>
    </form>
  </div>
</template>
