<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Checkbox from 'primevue/checkbox'
import Tag from 'primevue/tag'
import { ApiException } from '@/api/client'
import {
  workSitesApi,
  centroidPoint,
  type WorkSite,
  type GeoPolygon,
} from '@/api/worksites'
import GeofenceMap from '@/components/GeofenceMap.vue'
import PageHeader from '@/components/PageHeader.vue'

const { t } = useI18n()
const confirm = useConfirm()
const toast = useToast()

const sites = ref<WorkSite[]>([])
const loading = ref(false)
const saving = ref(false)

const showForm = ref(false)
const editingId = ref<number | null>(null)
const mapKey = ref(0)
const area = ref<GeoPolygon | null>(null)
const form = reactive({ name: '', address: '', buffer_meters: 50, is_active: true })

function messageFor(e: unknown, fallback: string): string {
  return e instanceof ApiException ? e.message : fallback
}
function notifyError(e: unknown, fallback: string): void {
  toast.add({ severity: 'error', summary: t('common.error'), detail: messageFor(e, fallback), life: 4000 })
}

async function load(): Promise<void> {
  loading.value = true
  try {
    sites.value = await workSitesApi.list()
  } catch (e) {
    notifyError(e, t('common.loadError'))
  } finally {
    loading.value = false
  }
}

function openCreate(): void {
  editingId.value = null
  form.name = ''
  form.address = ''
  form.buffer_meters = 50
  form.is_active = true
  area.value = null
  mapKey.value++
  showForm.value = true
}

function openEdit(s: WorkSite): void {
  editingId.value = s.id
  form.name = s.name
  form.address = s.address ?? ''
  form.buffer_meters = s.buffer_meters
  form.is_active = s.is_active
  area.value = s.area
  mapKey.value++
  showForm.value = true
}

async function submit(): Promise<void> {
  if (!area.value) {
    toast.add({ severity: 'error', summary: t('common.error'), detail: t('worksites.areaRequired'), life: 4000 })
    return
  }
  saving.value = true
  try {
    const ring = area.value.coordinates[0].slice(0, -1)
    const payload = {
      name: form.name,
      address: form.address || null,
      buffer_meters: form.buffer_meters,
      is_active: form.is_active,
      area: area.value,
      center: centroidPoint(ring),
    }
    if (editingId.value === null) await workSitesApi.create(payload)
    else await workSitesApi.update(editingId.value, payload)
    showForm.value = false
    toast.add({ severity: 'success', summary: t('common.saved'), life: 2500 })
    await load()
  } catch (e) {
    notifyError(e, t('common.saveError'))
  } finally {
    saving.value = false
  }
}

function confirmRemove(s: WorkSite): void {
  confirm.require({
    message: t('worksites.confirmDelete', { name: s.name }),
    header: t('common.delete'),
    icon: 'pi pi-exclamation-triangle',
    acceptProps: { severity: 'danger', label: t('common.delete') },
    rejectProps: { severity: 'secondary', outlined: true, label: t('common.cancel') },
    accept: async () => {
      try {
        await workSitesApi.remove(s.id)
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
  <div class="mx-auto max-w-4xl">
    <PageHeader :title="t('worksites.title')">
      <template #actions>
        <Button v-can="'work_sites.create'" :label="t('worksites.create')" icon="pi pi-plus" @click="openCreate" />
      </template>
    </PageHeader>

    <div class="overflow-hidden rounded-2xl border border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
      <DataTable
        :value="sites"
        :loading="loading"
        paginator
        :rows="10"
        :rows-per-page-options="[10, 20, 50]"
        data-key="id"
        striped-rows
        removable-sort
      >
        <template #empty>
          <p class="py-6 text-center text-sm text-surface-500">{{ t('worksites.empty') }}</p>
        </template>

        <Column field="name" :header="t('worksites.name')" sortable>
          <template #body="{ data }">
            <span class="font-medium text-surface-900 dark:text-white">{{ data.name }}</span>
          </template>
        </Column>
        <Column field="address" :header="t('worksites.address')" sortable>
          <template #body="{ data }">
            <span class="text-surface-500">{{ data.address || '—' }}</span>
          </template>
        </Column>
        <Column field="buffer_meters" :header="t('worksites.buffer')" sortable>
          <template #body="{ data }">
            <span class="text-surface-500">{{ data.buffer_meters }} m</span>
          </template>
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
                v-can="'work_sites.update'"
                v-tooltip.top="t('common.edit')"
                icon="pi pi-pencil"
                severity="secondary"
                text
                rounded
                @click="openEdit(data)"
              />
              <Button
                v-can="'work_sites.delete'"
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
      :header="editingId === null ? t('worksites.create') : t('worksites.edit')"
      :style="{ width: '56rem' }"
      :breakpoints="{ '960px': '95vw' }"
    >
      <form class="space-y-4 pt-2" @submit.prevent="submit">
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="block text-sm">
            <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('worksites.name') }}</span>
            <InputText v-model="form.name" required fluid />
          </label>
          <label class="block text-sm">
            <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('worksites.address') }}</span>
            <InputText v-model="form.address" fluid />
          </label>
          <label class="block text-sm">
            <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('worksites.buffer') }}</span>
            <InputNumber v-model="form.buffer_meters" :min="0" :max="500" :use-grouping="false" fluid />
          </label>
          <label class="flex items-center gap-2 text-sm">
            <Checkbox v-model="form.is_active" binary input-id="site-active" />
            <span class="font-medium text-surface-700 dark:text-surface-300">{{ t('worksites.active') }}</span>
          </label>
        </div>

        <GeofenceMap :key="mapKey" v-model="area" @update:address="form.address = $event" />

        <div class="mt-2 flex justify-end gap-2">
          <Button type="button" :label="t('common.cancel')" severity="secondary" text @click="showForm = false" />
          <Button type="submit" :label="saving ? t('common.saving') : t('common.save')" icon="pi pi-check" :loading="saving" />
        </div>
      </form>
    </Dialog>
  </div>
</template>
