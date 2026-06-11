<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Select from 'primevue/select'
import InputNumber from 'primevue/inputnumber'
import ToggleSwitch from 'primevue/toggleswitch'
import InputChips from 'primevue/inputchips'
import Tag from 'primevue/tag'
import PageHeader from '@/components/PageHeader.vue'
import { ApiException } from '@/api/client'
import { saveBlob } from '@/api/reports'
import {
  backupsApi,
  type Backup,
  type BackupSettings,
  type BackupFrequency,
} from '@/api/backups'

const { t } = useI18n()
const confirm = useConfirm()
const toast = useToast()

function messageFor(e: unknown, fallback: string): string {
  return e instanceof ApiException ? e.message : fallback
}
function notifyError(e: unknown, fallback: string): void {
  toast.add({ severity: 'error', summary: t('common.error'), detail: messageFor(e, fallback), life: 4000 })
}

// ===== السجلّ =====
const backups = ref<Backup[]>([])
const total = ref(0)
const loading = ref(false)
const creating = ref(false)
const downloadingId = ref<number | null>(null)

const ymd = (d?: string | null) => (d ? d.slice(0, 19).replace('T', ' ') : '—')

function humanSize(b: Backup): string {
  if (b.size_human) return b.size_human
  const bytes = b.size_bytes ?? b.size
  if (bytes == null) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let n = bytes
  let i = 0
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024
    i++
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

function statusSeverity(s: string): 'success' | 'danger' | 'warn' | 'info' {
  if (s === 'success') return 'success'
  if (s === 'failed') return 'danger'
  if (s === 'running' || s === 'pending') return 'warn'
  return 'info'
}
function statusLabel(s: string): string {
  const known = ['success', 'failed', 'running', 'pending']
  return known.includes(s) ? t('backups.status.' + s) : s
}

async function loadBackups(): Promise<void> {
  loading.value = true
  try {
    const res = await backupsApi.list({ per_page: 50 })
    backups.value = res.data
    total.value = res.pagination?.total ?? res.data.length
  } catch (e) {
    notifyError(e, t('common.loadError'))
  } finally {
    loading.value = false
  }
}

async function runBackupNow(): Promise<void> {
  creating.value = true
  try {
    await backupsApi.create()
    toast.add({ severity: 'success', summary: t('backups.startedTitle'), detail: t('backups.startedBody'), life: 4000 })
    await loadBackups()
  } catch (e) {
    notifyError(e, t('common.saveError'))
  } finally {
    creating.value = false
  }
}

async function download(b: Backup): Promise<void> {
  downloadingId.value = b.id
  try {
    const blob = await backupsApi.download(b.id)
    saveBlob(blob, b.filename ?? `backup-${b.id}.sql.gz`)
  } catch (e) {
    notifyError(e, t('backups.downloadError'))
  } finally {
    downloadingId.value = null
  }
}

function removeBackup(b: Backup): void {
  confirm.require({
    message: t('backups.confirmDelete', { date: ymd(b.created_at) }),
    header: t('common.delete'),
    icon: 'pi pi-exclamation-triangle',
    acceptProps: { severity: 'danger', label: t('common.delete') },
    rejectProps: { severity: 'secondary', outlined: true, label: t('common.cancel') },
    accept: async () => {
      try {
        await backupsApi.remove(b.id)
        toast.add({ severity: 'success', summary: t('common.deleted'), life: 2500 })
        await loadBackups()
      } catch (e) {
        notifyError(e, t('common.saveError'))
      }
    },
  })
}

// ===== الإعدادات =====
const settings = reactive<BackupSettings>({
  scheduled_enabled: false,
  frequency: 'daily',
  run_at: '02:00',
  retention_count: 14,
  attach_to_message: false,
  notify_telegram_chat_ids: [],
  notify_emails: [],
})
const savingSettings = ref(false)

const frequencyOptions: { value: BackupFrequency; label: string }[] = [
  { value: 'daily', label: 'backups.freq.daily' },
  { value: 'weekly', label: 'backups.freq.weekly' },
  { value: 'monthly', label: 'backups.freq.monthly' },
]

async function loadSettings(): Promise<void> {
  try {
    const s = await backupsApi.getSettings()
    Object.assign(settings, {
      scheduled_enabled: s.scheduled_enabled ?? false,
      frequency: s.frequency ?? 'daily',
      run_at: (s.run_at ?? '02:00').slice(0, 5),
      retention_count: s.retention_count ?? null,
      attach_to_message: s.attach_to_message ?? false,
      notify_telegram_chat_ids: s.notify_telegram_chat_ids ?? [],
      notify_emails: s.notify_emails ?? [],
    })
  } catch {
    // الإعدادات اختيارية — قد لا تكون مهيّأة بعد.
  }
}

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
async function saveSettings(): Promise<void> {
  const bad = settings.notify_emails.find((e) => !emailRe.test(e))
  if (bad) {
    toast.add({ severity: 'warn', summary: t('common.error'), detail: t('backups.invalidEmail', { email: bad }), life: 4000 })
    return
  }
  savingSettings.value = true
  try {
    await backupsApi.updateSettings({
      scheduled_enabled: settings.scheduled_enabled,
      frequency: settings.frequency,
      run_at: settings.run_at,
      retention_count: settings.retention_count,
      attach_to_message: settings.attach_to_message,
      notify_telegram_chat_ids: settings.notify_telegram_chat_ids,
      notify_emails: settings.notify_emails,
    })
    toast.add({ severity: 'success', summary: t('common.saved'), life: 2500 })
  } catch (e) {
    notifyError(e, t('common.saveError'))
  } finally {
    savingSettings.value = false
  }
}

onMounted(async () => {
  await Promise.all([loadBackups(), loadSettings()])
})
</script>

<template>
  <div class="mx-auto max-w-5xl">
    <PageHeader :title="t('backups.title')" :subtitle="t('backups.subtitle')">
      <template #actions>
        <Button
          v-can="'backups.manage'"
          icon="pi pi-database"
          :label="creating ? t('backups.running') : t('backups.runNow')"
          :loading="creating"
          :disabled="creating"
          @click="runBackupNow"
        />
      </template>
    </PageHeader>

    <!-- تنبيه أمني -->
    <div
      class="mb-6 flex items-start gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300"
    >
      <i class="pi pi-exclamation-triangle mt-0.5 shrink-0" />
      <p>{{ t('backups.securityWarning') }}</p>
    </div>

    <!-- سجلّ النسخ -->
    <div class="mb-8 overflow-hidden rounded-2xl border border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
      <div class="flex items-center justify-between border-b border-surface-100 px-4 py-3 dark:border-surface-800">
        <h2 class="text-sm font-semibold text-surface-700 dark:text-surface-200">{{ t('backups.historyTitle') }}</h2>
        <span class="text-xs text-surface-500">{{ t('reports.rowsCount', { n: total }) }}</span>
      </div>
      <DataTable
        :value="backups"
        :loading="loading"
        paginator
        :rows="10"
        :rows-per-page-options="[10, 20, 50]"
        data-key="id"
        striped-rows
        removable-sort
      >
        <template #empty>
          <p class="py-6 text-center text-sm text-surface-500">{{ t('backups.empty') }}</p>
        </template>

        <Column field="created_at" :header="t('backups.date')" sortable>
          <template #body="{ data }"><span class="text-surface-700 dark:text-surface-200" dir="ltr">{{ ymd(data.created_at) }}</span></template>
        </Column>
        <Column :header="t('backups.size')">
          <template #body="{ data }"><span class="text-surface-500" dir="ltr">{{ humanSize(data) }}</span></template>
        </Column>
        <Column :header="t('backups.statusCol')">
          <template #body="{ data }">
            <Tag :value="statusLabel(data.status)" :severity="statusSeverity(data.status)" />
          </template>
        </Column>
        <Column :header="t('companies.actions')" class="text-end">
          <template #body="{ data }">
            <div class="flex justify-end gap-1">
              <Button
                v-tooltip.top="t('backups.download')"
                icon="pi pi-download"
                severity="secondary"
                text
                rounded
                :loading="downloadingId === data.id"
                :disabled="data.status !== 'success'"
                @click="download(data)"
              />
              <Button
                v-tooltip.top="t('common.delete')"
                icon="pi pi-trash"
                severity="danger"
                text
                rounded
                @click="removeBackup(data)"
              />
            </div>
          </template>
        </Column>
      </DataTable>
    </div>

    <!-- الإعدادات: الجدولة + الإشعارات -->
    <div class="grid gap-6 lg:grid-cols-2">
      <!-- الجدولة -->
      <div class="rounded-2xl border border-surface-200 bg-white p-5 dark:border-surface-800 dark:bg-surface-900">
        <h2 class="mb-4 text-sm font-semibold text-surface-700 dark:text-surface-200">{{ t('backups.scheduleTitle') }}</h2>
        <div class="grid gap-4">
          <label class="flex items-center justify-between gap-3 text-sm">
            <span class="font-medium text-surface-700 dark:text-surface-300">{{ t('backups.scheduledEnabled') }}</span>
            <ToggleSwitch v-model="settings.scheduled_enabled" />
          </label>
          <label class="block text-sm">
            <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('backups.frequency') }}</span>
            <Select
              v-model="settings.frequency"
              :options="frequencyOptions"
              option-value="value"
              :disabled="!settings.scheduled_enabled"
              fluid
            >
              <template #value="{ value }">{{ t(frequencyOptions.find((o) => o.value === value)?.label ?? '') }}</template>
              <template #option="{ option }">{{ t(option.label) }}</template>
            </Select>
          </label>
          <label class="block text-sm">
            <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('backups.runAt') }}</span>
            <input
              v-model="settings.run_at"
              type="time"
              :disabled="!settings.scheduled_enabled"
              class="field"
            />
            <span class="mt-1 block text-xs text-surface-500">{{ t('backups.runAtHint') }}</span>
          </label>
          <label class="block text-sm">
            <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('backups.retention') }}</span>
            <InputNumber
              v-model="settings.retention_count"
              :min="1"
              :max="999"
              show-clear
              :placeholder="t('backups.retentionUnlimited')"
              fluid
            />
            <span class="mt-1 block text-xs text-surface-500">{{ t('backups.retentionHint') }}</span>
          </label>
        </div>
      </div>

      <!-- الإشعارات -->
      <div class="rounded-2xl border border-surface-200 bg-white p-5 dark:border-surface-800 dark:bg-surface-900">
        <h2 class="mb-4 text-sm font-semibold text-surface-700 dark:text-surface-200">{{ t('backups.notifyTitle') }}</h2>
        <div class="grid gap-4">
          <label class="flex items-center justify-between gap-3 text-sm">
            <span class="font-medium text-surface-700 dark:text-surface-300">{{ t('backups.attach') }}</span>
            <ToggleSwitch v-model="settings.attach_to_message" />
          </label>
          <p class="-mt-2 text-xs text-surface-500">{{ t('backups.attachHint') }}</p>
          <label class="block text-sm">
            <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('backups.telegram') }}</span>
            <InputChips v-model="settings.notify_telegram_chat_ids" :placeholder="t('backups.telegramPlaceholder')" separator="," fluid />
            <span class="mt-1 block text-xs text-surface-500">{{ t('backups.chipsHint') }}</span>
          </label>
          <label class="block text-sm">
            <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('backups.emails') }}</span>
            <InputChips v-model="settings.notify_emails" :placeholder="t('backups.emailsPlaceholder')" separator="," fluid />
            <span class="mt-1 block text-xs text-surface-500">{{ t('backups.chipsHint') }}</span>
          </label>
        </div>
      </div>
    </div>

    <div class="mt-6 flex justify-end">
      <Button
        v-can="'backups.manage'"
        icon="pi pi-check"
        :label="savingSettings ? t('common.saving') : t('backups.saveSettings')"
        :loading="savingSettings"
        @click="saveSettings"
      />
    </div>
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
.field:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
:global(.dark) .field {
  border-color: rgb(51 65 85);
  background: rgb(30 41 59);
  color: #fff;
}
</style>
