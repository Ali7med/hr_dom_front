<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Select from 'primevue/select'
import MultiSelect from 'primevue/multiselect'
import InputChips from 'primevue/inputchips'
import ToggleSwitch from 'primevue/toggleswitch'
import Tag from 'primevue/tag'
import Dialog from '@/components/AppDialog.vue'
import PageHeader from '@/components/PageHeader.vue'
import { ApiException } from '@/api/client'
import {
  reportSubscriptionsApi,
  type ReportSubscription,
  type ReportFrequency,
  type ReportFormat,
  type ReportChannel,
} from '@/api/reportSubscriptions'

const { t } = useI18n()
const confirm = useConfirm()
const toast = useToast()

function messageFor(e: unknown, fallback: string): string {
  return e instanceof ApiException ? e.message : fallback
}
function notifyError(e: unknown, fallback: string): void {
  toast.add({ severity: 'error', summary: t('common.error'), detail: messageFor(e, fallback), life: 4000 })
}

const REPORT_TYPES = ['attendance', 'late-absence', 'timesheet', 'leave-balances', 'leaves'] as const
const reportTypeOptions = REPORT_TYPES.map((v) => ({ value: v, key: `reportSubs.type.${v}` }))
const frequencyOptions: { value: ReportFrequency; key: string }[] = [
  { value: 'daily', key: 'reportSubs.freq.daily' },
  { value: 'weekly', key: 'reportSubs.freq.weekly' },
  { value: 'monthly', key: 'reportSubs.freq.monthly' },
]
const formatOptions: { value: ReportFormat; label: string }[] = [
  { value: 'excel', label: 'Excel' },
  { value: 'pdf', label: 'PDF' },
]
const channelOptions: { value: ReportChannel; key: string }[] = [
  { value: 'email', key: 'channels.email' },
  { value: 'telegram', key: 'channels.telegram' },
]

const reportTypeLabel = (v: string) => {
  const k = `reportSubs.type.${v}`
  const tr = t(k)
  return tr === k ? v : tr
}

const rows = ref<ReportSubscription[]>([])
const loading = ref(false)
const saving = ref(false)

async function load(): Promise<void> {
  loading.value = true
  try {
    rows.value = await reportSubscriptionsApi.list()
  } catch (e) {
    notifyError(e, t('common.loadError'))
  } finally {
    loading.value = false
  }
}

// ===== نموذج إنشاء/تعديل =====
const form = reactive({
  open: false,
  id: null as number | null,
  report_type: 'attendance' as string,
  frequency: 'daily' as ReportFrequency,
  format: 'excel' as ReportFormat,
  channels: [] as ReportChannel[],
  recipients: [] as string[],
  is_active: true,
})
function openForm(s?: ReportSubscription): void {
  form.open = true
  form.id = s?.id ?? null
  form.report_type = s?.report_type ?? 'attendance'
  form.frequency = s?.frequency ?? 'daily'
  form.format = s?.format ?? 'excel'
  form.channels = s?.channels ? [...s.channels] : []
  form.recipients = s?.recipients ? [...s.recipients] : []
  form.is_active = s?.is_active ?? true
}
async function submit(): Promise<void> {
  if (form.channels.length === 0) {
    toast.add({ severity: 'warn', summary: t('common.error'), detail: t('reportSubs.channelsRequired'), life: 4000 })
    return
  }
  if (form.recipients.length === 0) {
    toast.add({ severity: 'warn', summary: t('common.error'), detail: t('reportSubs.recipientsRequired'), life: 4000 })
    return
  }
  saving.value = true
  try {
    const payload = {
      report_type: form.report_type,
      frequency: form.frequency,
      format: form.format,
      channels: form.channels,
      recipients: form.recipients,
      is_active: form.is_active,
    }
    if (form.id === null) await reportSubscriptionsApi.create(payload)
    else await reportSubscriptionsApi.update(form.id, payload)
    form.open = false
    toast.add({ severity: 'success', summary: t('common.saved'), life: 2500 })
    await load()
  } catch (e) {
    notifyError(e, t('common.saveError'))
  } finally {
    saving.value = false
  }
}
function remove(s: ReportSubscription): void {
  confirm.require({
    message: t('reportSubs.confirmDelete', { type: reportTypeLabel(s.report_type) }),
    header: t('common.delete'),
    icon: 'pi pi-exclamation-triangle',
    acceptProps: { severity: 'danger', label: t('common.delete') },
    rejectProps: { severity: 'secondary', outlined: true, label: t('common.cancel') },
    accept: async () => {
      try {
        await reportSubscriptionsApi.remove(s.id)
        toast.add({ severity: 'success', summary: t('common.deleted'), life: 2500 })
        await load()
      } catch (e) {
        notifyError(e, t('common.saveError'))
      }
    },
  })
}

onMounted(load)
</script>

<template>
  <div class="mx-auto max-w-5xl">
    <PageHeader :title="t('reportSubs.title')" :subtitle="t('reportSubs.subtitle')">
      <template #actions>
        <Button v-can="'reports.export'" icon="pi pi-plus" :label="t('reportSubs.create')" @click="openForm()" />
      </template>
    </PageHeader>

    <div class="overflow-hidden rounded-2xl border border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
      <DataTable :value="rows" :loading="loading" paginator :rows="15" :rows-per-page-options="[15, 30, 50]" data-key="id" striped-rows removable-sort>
        <template #empty>
          <p class="py-6 text-center text-sm text-surface-500">{{ t('reportSubs.empty') }}</p>
        </template>

        <Column :header="t('reportSubs.reportType')">
          <template #body="{ data }"><span class="font-medium text-surface-900 dark:text-white">{{ reportTypeLabel(data.report_type) }}</span></template>
        </Column>
        <Column :header="t('reportSubs.frequency')">
          <template #body="{ data }"><span class="text-surface-500">{{ t('reportSubs.freq.' + data.frequency) }}</span></template>
        </Column>
        <Column :header="t('reportSubs.format')">
          <template #body="{ data }"><span class="text-surface-500 uppercase">{{ data.format }}</span></template>
        </Column>
        <Column :header="t('reportSubs.channels')">
          <template #body="{ data }">
            <span class="text-surface-500">{{ (data.channels ?? []).map((c: string) => t('channels.' + c)).join('، ') || '—' }}</span>
          </template>
        </Column>
        <Column :header="t('reportSubs.recipients')">
          <template #body="{ data }"><span class="text-surface-500">{{ (data.recipients ?? []).length }}</span></template>
        </Column>
        <Column :header="t('reportSubs.active')">
          <template #body="{ data }">
            <Tag :value="data.is_active ? t('reportSubs.activeYes') : t('reportSubs.activeNo')" :severity="data.is_active ? 'success' : 'secondary'" />
          </template>
        </Column>
        <Column :header="t('companies.actions')" class="text-end">
          <template #body="{ data }">
            <div class="flex justify-end gap-1">
              <Button
                v-can="'reports.export'"
                v-tooltip.top="t('common.edit')"
                icon="pi pi-pencil"
                severity="secondary"
                text
                rounded
                @click="openForm(data)"
              />
              <Button
                v-can="'reports.export'"
                v-tooltip.top="t('common.delete')"
                icon="pi pi-trash"
                severity="danger"
                text
                rounded
                @click="remove(data)"
              />
            </div>
          </template>
        </Column>
      </DataTable>
    </div>

    <!-- إنشاء/تعديل اشتراك -->
    <Dialog
      v-model:visible="form.open"
      modal
      :header="form.id === null ? t('reportSubs.create') : t('reportSubs.edit')"
      :style="{ width: '36rem' }"
      :breakpoints="{ '640px': '95vw' }"
    >
      <form class="grid gap-4 pt-2 sm:grid-cols-2" @submit.prevent="submit">
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('reportSubs.reportType') }}</span>
          <Select v-model="form.report_type" :options="reportTypeOptions" option-value="value" fluid>
            <template #value="{ value }">{{ reportTypeLabel(value) }}</template>
            <template #option="{ option }">{{ t(option.key) }}</template>
          </Select>
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('reportSubs.frequency') }}</span>
          <Select v-model="form.frequency" :options="frequencyOptions" option-value="value" fluid>
            <template #value="{ value }">{{ t('reportSubs.freq.' + value) }}</template>
            <template #option="{ option }">{{ t(option.key) }}</template>
          </Select>
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('reportSubs.format') }}</span>
          <Select v-model="form.format" :options="formatOptions" option-label="label" option-value="value" fluid />
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('reportSubs.channels') }}</span>
          <MultiSelect v-model="form.channels" :options="channelOptions" option-value="value" display="chip" fluid>
            <template #option="{ option }">{{ t(option.key) }}</template>
          </MultiSelect>
        </label>
        <label class="block text-sm sm:col-span-2">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('reportSubs.recipients') }}</span>
          <InputChips v-model="form.recipients" :placeholder="t('reportSubs.recipientsPlaceholder')" separator="," fluid />
          <span class="mt-1 block text-xs text-surface-500">{{ t('reportSubs.recipientsHint') }}</span>
        </label>
        <label class="flex items-center gap-2 text-sm sm:col-span-2">
          <ToggleSwitch v-model="form.is_active" />
          <span class="font-medium text-surface-700 dark:text-surface-300">{{ t('reportSubs.activeLabel') }}</span>
        </label>

        <div class="mt-2 flex justify-end gap-2 sm:col-span-2">
          <Button type="button" :label="t('common.cancel')" severity="secondary" text @click="form.open = false" />
          <Button type="submit" :label="saving ? t('common.saving') : t('common.save')" icon="pi pi-check" :loading="saving" />
        </div>
      </form>
    </Dialog>
  </div>
</template>
