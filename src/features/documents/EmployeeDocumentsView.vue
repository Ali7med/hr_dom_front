<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Select from 'primevue/select'
import InputText from 'primevue/inputtext'
import Tag from 'primevue/tag'
import Dialog from '@/components/AppDialog.vue'
import PageHeader from '@/components/PageHeader.vue'
import { ApiException } from '@/api/client'
import { saveBlob } from '@/api/reports'
import { documentsApi, type EmployeeDocument } from '@/api/documents'
import { usersApi, type User } from '@/api/users'

const { t } = useI18n()
const confirm = useConfirm()
const toast = useToast()

function messageFor(e: unknown, fallback: string): string {
  return e instanceof ApiException ? e.message : fallback
}
function notifyError(e: unknown, fallback: string): void {
  toast.add({ severity: 'error', summary: t('common.error'), detail: messageFor(e, fallback), life: 4000 })
}

const ymd = (d?: string | null) => (d ? d.slice(0, 10) : '—')
function humanSize(bytes?: number | null): string {
  if (bytes === null || bytes === undefined) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// حالة انتهاء الصلاحية: منتهٍ (danger) / قريب ≤30 يوماً (warn) / ساري (success) / بلا (—).
function expiryDays(d?: string | null): number | null {
  if (!d) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const exp = new Date(d.slice(0, 10) + 'T00:00:00')
  return Math.round((exp.getTime() - today.getTime()) / 86_400_000)
}
function expirySeverity(d?: string | null): 'danger' | 'warn' | 'success' | null {
  const days = expiryDays(d)
  if (days === null) return null
  if (days < 0) return 'danger'
  if (days <= 30) return 'warn'
  return 'success'
}
function expiryLabel(d?: string | null): string {
  const days = expiryDays(d)
  if (days === null) return '—'
  if (days < 0) return t('documents.expired')
  if (days <= 30) return t('documents.expiringSoon', { n: days })
  return ymd(d)
}

const users = ref<User[]>([])
const selectedUserId = ref<number | null>(null)
const docs = ref<EmployeeDocument[]>([])
const loading = ref(false)
const downloadingId = ref<number | null>(null)

async function loadDocs(): Promise<void> {
  if (!selectedUserId.value) {
    docs.value = []
    return
  }
  loading.value = true
  try {
    docs.value = await documentsApi.listForUser(selectedUserId.value)
  } catch (e) {
    notifyError(e, t('common.loadError'))
  } finally {
    loading.value = false
  }
}
watch(selectedUserId, loadDocs)

async function download(d: EmployeeDocument): Promise<void> {
  downloadingId.value = d.id
  try {
    const blob = await documentsApi.download(d.id)
    saveBlob(blob, d.title || `document-${d.id}`)
  } catch (e) {
    notifyError(e, t('common.loadError'))
  } finally {
    downloadingId.value = null
  }
}

function remove(d: EmployeeDocument): void {
  confirm.require({
    message: t('documents.confirmDelete', { title: d.title || d.type }),
    header: t('common.delete'),
    icon: 'pi pi-exclamation-triangle',
    acceptProps: { severity: 'danger', label: t('common.delete') },
    rejectProps: { severity: 'secondary', outlined: true, label: t('common.cancel') },
    accept: async () => {
      try {
        await documentsApi.remove(d.id)
        toast.add({ severity: 'success', summary: t('common.deleted'), life: 2500 })
        await loadDocs()
      } catch (e) {
        notifyError(e, t('common.saveError'))
      }
    },
  })
}

// ===== رفع مستند =====
const form = reactive({
  open: false,
  type: '',
  title: '',
  expiry_date: '',
  file: null as File | null,
})
const uploading = ref(false)
function openForm(): void {
  form.open = true
  form.type = ''
  form.title = ''
  form.expiry_date = ''
  form.file = null
}
function onFileChange(e: Event): void {
  const input = e.target as HTMLInputElement
  form.file = input.files?.[0] ?? null
}
async function submit(): Promise<void> {
  if (!selectedUserId.value || !form.type.trim() || !form.file) return
  uploading.value = true
  try {
    await documentsApi.upload(selectedUserId.value, {
      type: form.type.trim(),
      title: form.title.trim() || null,
      expiry_date: form.expiry_date || null,
      file: form.file,
    })
    form.open = false
    toast.add({ severity: 'success', summary: t('documents.uploaded'), life: 2500 })
    await loadDocs()
  } catch (e) {
    notifyError(e, t('common.saveError'))
  } finally {
    uploading.value = false
  }
}

const selectedUser = computed(() => users.value.find((u) => u.id === selectedUserId.value) ?? null)

onMounted(async () => {
  try {
    const us = await usersApi.list({ per_page: 100 })
    users.value = us.data
  } catch (e) {
    notifyError(e, t('common.loadError'))
  }
})
</script>

<template>
  <div class="mx-auto max-w-5xl">
    <PageHeader :title="t('documents.title')" :subtitle="t('documents.subtitle')">
      <template #actions>
        <Button
          v-can="'documents.manage'"
          icon="pi pi-upload"
          :label="t('documents.upload')"
          :disabled="!selectedUserId"
          @click="openForm"
        />
      </template>
    </PageHeader>

    <!-- اختيار الموظف -->
    <div class="mb-6 rounded-2xl border border-surface-200 bg-white p-4 dark:border-surface-800 dark:bg-surface-900">
      <label class="block text-sm">
        <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('documents.employee') }}</span>
        <Select
          v-model.number="selectedUserId"
          :options="users"
          option-label="name"
          option-value="id"
          filter
          :placeholder="t('documents.selectEmployee')"
          class="w-full sm:w-80"
        />
      </label>
    </div>

    <!-- قائمة المستندات -->
    <div v-if="selectedUserId" class="overflow-hidden rounded-2xl border border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
      <div class="flex items-center justify-between border-b border-surface-100 px-4 py-3 dark:border-surface-800">
        <h2 class="text-sm font-semibold text-surface-700 dark:text-surface-200">
          {{ t('documents.recordTitle', { name: selectedUser?.name ?? '' }) }}
        </h2>
        <span class="text-xs text-surface-500">{{ t('reports.rowsCount', { n: docs.length }) }}</span>
      </div>
      <DataTable :value="docs" :loading="loading" paginator :rows="15" :rows-per-page-options="[15, 30, 50]" data-key="id" striped-rows>
        <template #empty>
          <p class="py-6 text-center text-sm text-surface-500">{{ t('documents.empty') }}</p>
        </template>

        <Column field="type" :header="t('documents.type')">
          <template #body="{ data }"><span class="font-medium text-surface-900 dark:text-white">{{ data.type }}</span></template>
        </Column>
        <Column :header="t('documents.docTitle')">
          <template #body="{ data }"><span class="text-surface-500">{{ data.title || '—' }}</span></template>
        </Column>
        <Column :header="t('documents.size')">
          <template #body="{ data }"><span class="text-surface-500" dir="ltr">{{ humanSize(data.size_bytes) }}</span></template>
        </Column>
        <Column :header="t('documents.expiry')">
          <template #body="{ data }">
            <Tag v-if="expirySeverity(data.expiry_date)" :value="expiryLabel(data.expiry_date)" :severity="expirySeverity(data.expiry_date)!" />
            <span v-else class="text-surface-400">—</span>
          </template>
        </Column>
        <Column :header="t('documents.uploadedAt')">
          <template #body="{ data }"><span class="text-surface-500" dir="ltr">{{ ymd(data.created_at) }}</span></template>
        </Column>
        <Column :header="t('companies.actions')" class="text-end">
          <template #body="{ data }">
            <div class="flex justify-end gap-1">
              <Button
                v-can="'documents.view'"
                v-tooltip.top="t('documents.download')"
                icon="pi pi-download"
                severity="secondary"
                text
                rounded
                :loading="downloadingId === data.id"
                @click="download(data)"
              />
              <Button
                v-can="'documents.manage'"
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
    <div v-else class="rounded-2xl border border-dashed border-surface-300 bg-surface-50 p-8 text-center text-sm text-surface-500 dark:border-surface-700 dark:bg-surface-900">
      {{ t('documents.pickEmployeeHint') }}
    </div>

    <!-- رفع مستند -->
    <Dialog
      v-model:visible="form.open"
      modal
      :header="t('documents.upload')"
      :style="{ width: '34rem' }"
      :breakpoints="{ '640px': '95vw' }"
    >
      <form class="grid gap-4 pt-2 sm:grid-cols-2" @submit.prevent="submit">
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('documents.type') }}</span>
          <InputText v-model="form.type" :placeholder="t('documents.typePlaceholder')" fluid />
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('documents.docTitle') }}</span>
          <InputText v-model="form.title" :maxlength="150" fluid />
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('documents.expiry') }}</span>
          <input v-model="form.expiry_date" type="date" class="field" />
          <span class="mt-1 block text-xs text-surface-500">{{ t('documents.expiryHint') }}</span>
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('documents.file') }}</span>
          <input type="file" required class="field" @change="onFileChange" />
        </label>
        <div class="mt-2 flex justify-end gap-2 sm:col-span-2">
          <Button type="button" :label="t('common.cancel')" severity="secondary" text @click="form.open = false" />
          <Button type="submit" :label="uploading ? t('common.saving') : t('documents.upload')" icon="pi pi-upload" :loading="uploading" :disabled="!form.type.trim() || !form.file" />
        </div>
      </form>
    </Dialog>
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
