<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ApiException } from '@/api/client'
import {
  workSitesApi,
  centroidPoint,
  type WorkSite,
  type GeoPolygon,
} from '@/api/worksites'
import GeofenceMap from '@/components/GeofenceMap.vue'

const { t } = useI18n()

const sites = ref<WorkSite[]>([])
const loading = ref(false)
const saving = ref(false)
const error = ref('')

const showForm = ref(false)
const editingId = ref<number | null>(null)
const mapKey = ref(0)
const area = ref<GeoPolygon | null>(null)
const form = reactive({ name: '', address: '', buffer_meters: 50, is_active: true })

function messageFor(e: unknown, fallback: string): string {
  return e instanceof ApiException ? e.message : fallback
}

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    sites.value = await workSitesApi.list()
  } catch (e) {
    error.value = messageFor(e, t('common.loadError'))
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
    error.value = t('worksites.areaRequired')
    return
  }
  saving.value = true
  error.value = ''
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
    await load()
  } catch (e) {
    error.value = messageFor(e, t('common.saveError'))
  } finally {
    saving.value = false
  }
}

async function remove(s: WorkSite): Promise<void> {
  if (!window.confirm(t('worksites.confirmDelete', { name: s.name }))) return
  error.value = ''
  try {
    await workSitesApi.remove(s.id)
    await load()
  } catch (e) {
    error.value = messageFor(e, t('common.saveError'))
  }
}

onMounted(load)
</script>

<template>
  <div class="mx-auto max-w-4xl">
    <div class="mb-6 flex items-center justify-between gap-4">
      <h1 class="text-2xl font-bold text-slate-900 dark:text-white">{{ t('worksites.title') }}</h1>
      <button v-can="'work_sites.create'" type="button" class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700" @click="openCreate">
        {{ t('worksites.create') }}
      </button>
    </div>

    <p v-if="error" class="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300" role="alert">{{ error }}</p>

    <form v-if="showForm" class="mb-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900" @submit.prevent="submit">
      <h2 class="font-semibold">{{ editingId === null ? t('worksites.create') : t('worksites.edit') }}</h2>
      <div class="grid gap-4 sm:grid-cols-2">
        <label class="block text-sm"><span class="lbl">{{ t('worksites.name') }}</span><input v-model="form.name" type="text" required class="field" /></label>
        <label class="block text-sm"><span class="lbl">{{ t('worksites.address') }}</span><input v-model="form.address" type="text" class="field" /></label>
        <label class="block text-sm"><span class="lbl">{{ t('worksites.buffer') }}</span><input v-model.number="form.buffer_meters" type="number" min="0" max="500" class="field" /></label>
        <label class="flex items-center gap-2 text-sm"><input v-model="form.is_active" type="checkbox" class="size-4" /><span class="font-medium text-slate-700 dark:text-slate-300">{{ t('worksites.active') }}</span></label>
      </div>
      <GeofenceMap :key="mapKey" v-model="area" />
      <div class="flex gap-3">
        <button type="submit" :disabled="saving" class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60">{{ saving ? t('common.saving') : t('common.save') }}</button>
        <button type="button" class="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400" @click="showForm = false">{{ t('common.cancel') }}</button>
      </div>
    </form>

    <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <p v-if="loading" class="p-6 text-sm text-slate-500">{{ t('common.loading') }}</p>
      <p v-else-if="!sites.length" class="p-6 text-sm text-slate-500">{{ t('worksites.empty') }}</p>
      <table v-else class="w-full text-start text-sm">
        <thead class="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          <tr>
            <th class="px-4 py-3 text-start">{{ t('worksites.name') }}</th>
            <th class="px-4 py-3 text-start">{{ t('worksites.address') }}</th>
            <th class="px-4 py-3 text-start">{{ t('worksites.buffer') }}</th>
            <th class="px-4 py-3 text-start">{{ t('companies.status') }}</th>
            <th class="px-4 py-3 text-end">{{ t('companies.actions') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
          <tr v-for="s in sites" :key="s.id">
            <td class="px-4 py-3 font-medium text-slate-900 dark:text-white">{{ s.name }}</td>
            <td class="px-4 py-3 text-slate-500">{{ s.address || '—' }}</td>
            <td class="px-4 py-3 text-slate-500">{{ s.buffer_meters }} m</td>
            <td class="px-4 py-3">
              <span class="rounded-full px-2 py-0.5 text-xs" :class="s.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'">
                {{ s.is_active ? t('companies.active') : t('companies.inactive') }}
              </span>
            </td>
            <td class="px-4 py-3">
              <div class="flex justify-end gap-3">
                <button v-can="'work_sites.update'" type="button" class="text-slate-600 hover:underline dark:text-slate-300" @click="openEdit(s)">{{ t('common.edit') }}</button>
                <button v-can="'work_sites.delete'" type="button" class="text-rose-600 hover:underline dark:text-rose-400" @click="remove(s)">{{ t('common.delete') }}</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
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
</style>
