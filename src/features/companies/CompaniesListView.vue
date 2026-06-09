<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import { ApiException } from '@/api/client'
import { companiesApi, type Company } from '@/api/companies'
import PageHeader from '@/components/PageHeader.vue'

const { t } = useI18n()
const router = useRouter()
const confirm = useConfirm()
const toast = useToast()

const companies = ref<Company[]>([])
const loading = ref(false)
const saving = ref(false)

// نموذج الإنشاء/التعديل.
const showForm = ref(false)
const editingId = ref<number | null>(null)
const form = reactive({
  name: '',
  slug: '',
  timezone: '',
  base_currency_id: null as number | null,
  source_company_id: null as number | null,
})

function messageFor(e: unknown, fallback: string): string {
  return e instanceof ApiException ? e.message : fallback
}
function notifyError(e: unknown, fallback: string): void {
  toast.add({ severity: 'error', summary: t('common.error'), detail: messageFor(e, fallback), life: 4000 })
}

async function load(): Promise<void> {
  loading.value = true
  try {
    companies.value = await companiesApi.list()
  } catch (e) {
    notifyError(e, t('common.loadError'))
  } finally {
    loading.value = false
  }
}

function openCreate(): void {
  editingId.value = null
  form.name = ''
  form.slug = ''
  form.timezone = ''
  form.base_currency_id = null
  form.source_company_id = null
  showForm.value = true
}

function openEdit(c: Company): void {
  editingId.value = c.id
  form.name = c.name
  form.slug = c.slug
  form.timezone = c.timezone ?? ''
  form.base_currency_id = c.base_currency_id
  form.source_company_id = null
  showForm.value = true
}

async function submit(): Promise<void> {
  saving.value = true
  try {
    if (editingId.value === null) {
      await companiesApi.create({
        name: form.name,
        slug: form.slug,
        timezone: form.timezone || null,
        base_currency_id: form.base_currency_id,
        source_company_id: form.source_company_id,
      })
    } else {
      await companiesApi.update(editingId.value, {
        name: form.name,
        slug: form.slug,
        timezone: form.timezone || null,
        base_currency_id: form.base_currency_id,
      })
    }
    showForm.value = false
    toast.add({ severity: 'success', summary: t('common.saved'), life: 2500 })
    await load()
  } catch (e) {
    notifyError(e, t('common.saveError'))
  } finally {
    saving.value = false
  }
}

function confirmRemove(c: Company): void {
  confirm.require({
    message: t('companies.confirmDelete', { name: c.name }),
    header: t('common.delete'),
    icon: 'pi pi-exclamation-triangle',
    rejectlabel: t('common.cancel'),
    acceptlabel: t('common.delete'),
    acceptProps: { severity: 'danger', label: t('common.delete') },
    rejectProps: { severity: 'secondary', outlined: true, label: t('common.cancel') },
    accept: async () => {
      try {
        await companiesApi.remove(c.id)
        toast.add({ severity: 'success', summary: t('common.deleted'), life: 2500 })
        await load()
      } catch (e) {
        notifyError(e, t('common.saveError'))
      }
    },
  })
}

function openSettings(c: Company): void {
  router.push({ name: 'company-settings', params: { id: c.id } })
}

onMounted(load)
</script>

<template>
  <div class="mx-auto max-w-5xl">
    <PageHeader :title="t('companies.title')">
      <template #actions>
        <Button v-can="'companies.create'" :label="t('companies.create')" icon="pi pi-plus" @click="openCreate" />
      </template>
    </PageHeader>

    <div class="overflow-hidden rounded-2xl border border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
      <DataTable
        :value="companies"
        :loading="loading"
        paginator
        :rows="10"
        :rows-per-page-options="[10, 20, 50]"
        data-key="id"
        striped-rows
        removable-sort
      >
        <template #empty>
          <p class="py-6 text-center text-sm text-surface-500">{{ t('companies.empty') }}</p>
        </template>

        <Column field="name" :header="t('companies.name')" sortable>
          <template #body="{ data }">
            <span class="font-medium text-surface-900 dark:text-white">{{ data.name }}</span>
          </template>
        </Column>
        <Column field="slug" :header="t('companies.slug')" sortable>
          <template #body="{ data }">
            <span class="font-mono text-xs text-surface-500">{{ data.slug }}</span>
          </template>
        </Column>
        <Column field="timezone" :header="t('companies.timezone')">
          <template #body="{ data }">{{ data.timezone || '—' }}</template>
        </Column>
        <Column field="is_active" :header="t('companies.status')" sortable>
          <template #body="{ data }">
            <Tag
              :value="data.is_active ? t('companies.active') : t('companies.inactive')"
              :severity="data.is_active ? 'success' : 'secondary'"
            />
          </template>
        </Column>
        <Column :header="t('companies.actions')" class="text-end">
          <template #body="{ data }">
            <div class="flex justify-end gap-1">
              <Button
                v-tooltip.top="t('companies.settings')"
                icon="pi pi-cog"
                severity="secondary"
                text
                rounded
                @click="openSettings(data)"
              />
              <Button
                v-can="'companies.update'"
                v-tooltip.top="t('common.edit')"
                icon="pi pi-pencil"
                severity="secondary"
                text
                rounded
                @click="openEdit(data)"
              />
              <Button
                v-can="'companies.delete'"
                v-tooltip.top="t('common.delete')"
                icon="pi pi-trash"
                severity="danger"
                text
                rounded
                @click="confirmRemove(data)"
              />
            </div>
          </template>
        </Column>
      </DataTable>
    </div>

    <!-- نموذج الإنشاء/التعديل -->
    <Dialog
      v-model:visible="showForm"
      modal
      :header="editingId === null ? t('companies.create') : t('companies.edit')"
      :style="{ width: '32rem' }"
      :breakpoints="{ '640px': '95vw' }"
    >
      <form class="grid gap-4 pt-2 sm:grid-cols-2" @submit.prevent="submit">
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('companies.name') }}</span>
          <InputText v-model="form.name" required fluid />
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('companies.slug') }}</span>
          <InputText v-model="form.slug" required fluid />
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('companies.timezone') }}</span>
          <InputText v-model="form.timezone" placeholder="Asia/Baghdad" fluid />
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('companies.baseCurrencyId') }}</span>
          <InputNumber v-model="form.base_currency_id" :min="1" :use-grouping="false" fluid />
        </label>
        <label v-if="editingId === null && companies.length" class="block text-sm sm:col-span-2">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('companies.fromTemplate') }}</span>
          <Select
            v-model="form.source_company_id"
            :options="companies"
            option-label="name"
            option-value="id"
            :placeholder="t('companies.noTemplate')"
            show-clear
            fluid
          />
        </label>

        <div class="mt-2 flex justify-end gap-2 sm:col-span-2">
          <Button type="button" :label="t('common.cancel')" severity="secondary" text @click="showForm = false" />
          <Button type="submit" :label="saving ? t('common.saving') : t('common.save')" icon="pi pi-check" :loading="saving" />
        </div>
      </form>
    </Dialog>
  </div>
</template>
