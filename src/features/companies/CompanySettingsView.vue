<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'
import { ApiException } from '@/api/client'
import { companiesApi, type Company, type CompanySettings } from '@/api/companies'
import { useAuthStore } from '@/stores/auth'

const { t } = useI18n()
const route = useRoute()
const auth = useAuthStore()

const companyId = Number(route.params.id)
const WEEKEND_DAYS = ['sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri'] as const
const CHANNELS = ['email', 'telegram', 'fcm'] as const

const canManage = auth.can('companies.update')
const loading = ref(false)
const saving = ref(false)
const error = ref('')
const notice = ref('')
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

function messageFor(e: unknown, fallback: string): string {
  return e instanceof ApiException ? e.message : fallback
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
}

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const [settings, list] = await Promise.all([
      companiesApi.getSettings(companyId),
      companiesApi.list(),
    ])
    applySettings(settings)
    otherCompanies.value = list.filter((c) => c.id !== companyId)
  } catch (e) {
    error.value = messageFor(e, t('common.loadError'))
  } finally {
    loading.value = false
  }
}

function toggle(list: string[], value: string): void {
  const i = list.indexOf(value)
  if (i === -1) list.push(value)
  else list.splice(i, 1)
}

async function save(): Promise<void> {
  saving.value = true
  error.value = ''
  notice.value = ''
  try {
    const updated = await companiesApi.updateSettings(companyId, {
      day_hours: Number(form.day_hours),
      default_grace_minutes: form.default_grace_minutes,
      weekend_days: form.weekend_days,
      hourly_leave_hours_per_day: Number(form.hourly_leave_hours_per_day),
      hourly_leave_needs_approval: form.hourly_leave_needs_approval,
      hourly_leave_monthly_cap: form.hourly_leave_monthly_cap,
      notify_channels: form.notify_channels,
    })
    applySettings(updated)
    notice.value = t('common.saved')
  } catch (e) {
    error.value = messageFor(e, t('common.saveError'))
  } finally {
    saving.value = false
  }
}

async function importFromTemplate(): Promise<void> {
  if (importSourceId.value === null) return
  saving.value = true
  error.value = ''
  notice.value = ''
  try {
    applySettings(await companiesApi.importSettings(companyId, importSourceId.value))
    notice.value = t('companies.imported')
  } catch (e) {
    error.value = messageFor(e, t('common.saveError'))
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="mx-auto max-w-3xl">
    <div class="mb-6 flex items-center gap-3">
      <RouterLink :to="{ name: 'companies' }" class="text-sm text-indigo-600 hover:underline dark:text-indigo-400">
        ← {{ t('companies.title') }}
      </RouterLink>
      <h1 class="text-2xl font-bold text-slate-900 dark:text-white">{{ t('companies.settings') }}</h1>
    </div>

    <p v-if="error" class="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300" role="alert">{{ error }}</p>
    <p v-if="notice" class="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">{{ notice }}</p>
    <p v-if="loading" class="text-sm text-slate-500">{{ t('common.loading') }}</p>

    <form v-else class="space-y-6" @submit.prevent="save">
      <fieldset :disabled="!canManage" class="space-y-6 disabled:opacity-70">
        <div class="grid gap-4 rounded-2xl border border-slate-200 bg-white p-6 sm:grid-cols-2 dark:border-slate-800 dark:bg-slate-900">
          <label class="block text-sm">
            <span class="mb-1 block font-medium text-slate-700 dark:text-slate-300">{{ t('settings.dayHours') }}</span>
            <input v-model.number="form.day_hours" type="number" step="0.5" min="1" max="24" class="field" />
          </label>
          <label class="block text-sm">
            <span class="mb-1 block font-medium text-slate-700 dark:text-slate-300">{{ t('settings.graceMinutes') }}</span>
            <input v-model.number="form.default_grace_minutes" type="number" min="0" max="240" class="field" />
          </label>
          <label class="block text-sm">
            <span class="mb-1 block font-medium text-slate-700 dark:text-slate-300">{{ t('settings.hourlyLeaveHours') }}</span>
            <input v-model.number="form.hourly_leave_hours_per_day" type="number" step="0.5" min="1" max="24" class="field" />
          </label>
          <label class="block text-sm">
            <span class="mb-1 block font-medium text-slate-700 dark:text-slate-300">{{ t('settings.hourlyLeaveCap') }}</span>
            <input v-model.number="form.hourly_leave_monthly_cap" type="number" min="0" max="1000" class="field" />
          </label>
          <label class="flex items-center gap-2 text-sm sm:col-span-2">
            <input v-model="form.hourly_leave_needs_approval" type="checkbox" class="size-4" />
            <span class="font-medium text-slate-700 dark:text-slate-300">{{ t('settings.hourlyLeaveApproval') }}</span>
          </label>
        </div>

        <div class="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <p class="mb-3 font-medium text-slate-700 dark:text-slate-300">{{ t('settings.weekendDays') }}</p>
          <div class="flex flex-wrap gap-3">
            <label v-for="d in WEEKEND_DAYS" :key="d" class="flex items-center gap-2 text-sm">
              <input type="checkbox" class="size-4" :checked="form.weekend_days.includes(d)" @change="toggle(form.weekend_days, d)" />
              {{ t('days.' + d) }}
            </label>
          </div>
        </div>

        <div class="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <p class="mb-3 font-medium text-slate-700 dark:text-slate-300">{{ t('settings.notifyChannels') }}</p>
          <div class="flex flex-wrap gap-3">
            <label v-for="ch in CHANNELS" :key="ch" class="flex items-center gap-2 text-sm">
              <input type="checkbox" class="size-4" :checked="form.notify_channels.includes(ch)" @change="toggle(form.notify_channels, ch)" />
              {{ t('channels.' + ch) }}
            </label>
          </div>
        </div>

        <button
          v-can="'companies.update'"
          type="submit"
          :disabled="saving"
          class="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
        >
          {{ saving ? t('common.saving') : t('common.save') }}
        </button>
      </fieldset>

      <!-- استيراد من قالب -->
      <div v-can="'companies.update'" class="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <p class="mb-3 font-medium text-slate-700 dark:text-slate-300">{{ t('companies.importSettings') }}</p>
        <div class="flex flex-wrap items-center gap-3">
          <select v-model.number="importSourceId" class="field max-w-xs">
            <option :value="null">{{ t('companies.chooseSource') }}</option>
            <option v-for="c in otherCompanies" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
          <button
            type="button"
            :disabled="saving || importSourceId === null"
            class="rounded-lg border border-indigo-600 px-4 py-2 text-sm font-medium text-indigo-600 transition hover:bg-indigo-50 disabled:opacity-50 dark:hover:bg-indigo-950"
            @click="importFromTemplate"
          >
            {{ t('companies.import') }}
          </button>
        </div>
      </div>
    </form>
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
</style>
