<script setup lang="ts">
import { onMounted, reactive, ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import DatePicker from 'primevue/datepicker'
import ToggleSwitch from 'primevue/toggleswitch'
import Tag from 'primevue/tag'
import AppDialog from '@/components/AppDialog.vue'
import PageHeader from '@/components/PageHeader.vue'
import { ApiException } from '@/api/client'
import { releasesApi, type ReleaseItem, type ReleasePlatform, type ReleaseInput, type LocalizedText } from '@/api/releases'

const { t } = useI18n()
const toast = useToast()
const confirm = useConfirm()

type EntryKind = 'new' | 'improved' | 'fixed'
const KINDS: EntryKind[] = ['new', 'improved', 'fixed']

const rows = ref<ReleaseItem[]>([])
const loading = ref(false)
const saving = ref(false)
const dialogOpen = ref(false)
const editingId = ref<number | null>(null)

const platformOptions = computed(() => [
  { label: t('releasesAdmin.platformPanel'), value: 'panel' as ReleasePlatform },
  { label: t('releasesAdmin.platformApp'), value: 'app' as ReleasePlatform },
  { label: t('releasesAdmin.platformAll'), value: 'all' as ReleasePlatform },
])

const blankForm = () => ({
  platform: 'panel' as ReleasePlatform,
  version: '',
  released_at: new Date() as Date | null,
  is_published: false,
  titleAr: '',
  titleEn: '',
  entries: { new: [] as LocalizedText[], improved: [] as LocalizedText[], fixed: [] as LocalizedText[] },
})
const form = reactive(blankForm())

function resetForm(): void {
  Object.assign(form, blankForm())
}

async function load(): Promise<void> {
  loading.value = true
  try {
    rows.value = await releasesApi.list({ include_unpublished: true, per_page: 100 })
  } catch (e) {
    rows.value = []
    if (e instanceof ApiException && e.status !== 404) notifyError(e)
  } finally {
    loading.value = false
  }
}

function notifyError(e: unknown): void {
  const msg = e instanceof ApiException ? e.message : t('releasesAdmin.saveError')
  toast.add({ severity: 'error', summary: t('common.error'), detail: msg, life: 4000 })
}

function openCreate(): void {
  resetForm()
  editingId.value = null
  dialogOpen.value = true
}

function openEdit(r: ReleaseItem): void {
  resetForm()
  editingId.value = r.id
  form.platform = r.platform
  form.version = r.version
  form.released_at = r.released_at ? new Date(r.released_at) : null
  form.is_published = r.is_published
  form.titleAr = r.title?.ar ?? ''
  form.titleEn = r.title?.en ?? ''
  KINDS.forEach((k) => {
    form.entries[k] = (r.entries?.[k] ?? []).map((i) => ({ ar: i.ar, en: i.en }))
  })
  dialogOpen.value = true
}

function addItem(kind: EntryKind): void {
  form.entries[kind].push({ ar: '', en: '' })
}
function removeItem(kind: EntryKind, idx: number): void {
  form.entries[kind].splice(idx, 1)
}

function ymd(d: Date | null): string {
  if (!d) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

async function save(): Promise<void> {
  if (!form.version.trim()) {
    toast.add({ severity: 'warn', summary: t('common.error'), detail: t('releasesAdmin.versionRequired'), life: 4000 })
    return
  }
  if (!form.released_at) {
    toast.add({ severity: 'warn', summary: t('common.error'), detail: t('releasesAdmin.dateRequired'), life: 4000 })
    return
  }
  // بناء البنود: حذف الصفوف الفارغة كلياً، والتحقّق أن كل صفّ متبقٍّ كامل (ar+en).
  const entries: ReleaseInput['entries'] = {}
  let hasAny = false
  for (const k of KINDS) {
    const cleaned: LocalizedText[] = []
    for (const it of form.entries[k]) {
      const ar = it.ar.trim()
      const en = it.en.trim()
      if (!ar && !en) continue
      if (!ar || !en) {
        toast.add({ severity: 'warn', summary: t('common.error'), detail: t('releasesAdmin.bilingualRequired'), life: 4000 })
        return
      }
      cleaned.push({ ar, en })
    }
    if (cleaned.length) {
      entries[k] = cleaned
      hasAny = true
    }
  }
  if (!hasAny) {
    toast.add({ severity: 'warn', summary: t('common.error'), detail: t('releasesAdmin.entriesRequired'), life: 4000 })
    return
  }

  const titleAr = form.titleAr.trim()
  const titleEn = form.titleEn.trim()
  const payload: ReleaseInput = {
    platform: form.platform,
    version: form.version.trim(),
    released_at: ymd(form.released_at),
    is_published: form.is_published,
    title: titleAr || titleEn ? { ar: titleAr || titleEn, en: titleEn || titleAr } : null,
    entries,
  }

  saving.value = true
  try {
    if (editingId.value) await releasesApi.update(editingId.value, payload)
    else await releasesApi.create(payload)
    toast.add({ severity: 'success', summary: t('releasesAdmin.saved'), life: 2500 })
    dialogOpen.value = false
    await load()
  } catch (e) {
    notifyError(e)
  } finally {
    saving.value = false
  }
}

function confirmDelete(r: ReleaseItem): void {
  confirm.require({
    message: t('releasesAdmin.confirmDelete', { v: r.version }),
    header: t('releasesAdmin.deleteTitle'),
    icon: 'pi pi-exclamation-triangle',
    rejectProps: { label: t('common.cancel'), severity: 'secondary', outlined: true },
    acceptProps: { label: t('common.delete'), severity: 'danger' },
    accept: async () => {
      try {
        await releasesApi.remove(r.id)
        toast.add({ severity: 'success', summary: t('releasesAdmin.deleted'), life: 2500 })
        await load()
      } catch (e) {
        notifyError(e)
      }
    },
  })
}

const platformLabel = (p: ReleasePlatform) =>
  ({ panel: t('releasesAdmin.platformPanel'), app: t('releasesAdmin.platformApp'), all: t('releasesAdmin.platformAll') })[p] ?? p

onMounted(load)
</script>

<template>
  <div>
    <PageHeader :title="t('releasesAdmin.title')">
      <template #actions>
        <Button :label="t('releasesAdmin.add')" icon="pi pi-plus" @click="openCreate" />
      </template>
    </PageHeader>

    <DataTable :value="rows" :loading="loading" data-key="id" paginator :rows="10" striped-rows class="text-sm">
      <template #empty>
        <p class="py-6 text-center text-sm text-surface-500">{{ t('releasesAdmin.empty') }}</p>
      </template>
      <Column :header="t('releasesAdmin.platform')">
        <template #body="{ data }"><span class="text-surface-600 dark:text-surface-300">{{ platformLabel(data.platform) }}</span></template>
      </Column>
      <Column :header="t('releasesAdmin.version')">
        <template #body="{ data }"><span class="font-mono" dir="ltr">v{{ data.version }}</span></template>
      </Column>
      <Column field="released_at" :header="t('releasesAdmin.releasedAt')" sortable />
      <Column :header="t('releasesAdmin.status')">
        <template #body="{ data }">
          <Tag
            :value="data.is_published ? t('releasesAdmin.published') : t('releasesAdmin.draft')"
            :severity="data.is_published ? 'success' : 'secondary'"
          />
        </template>
      </Column>
      <Column :header="t('companies.actions')" class="text-end">
        <template #body="{ data }">
          <div class="flex justify-end gap-1">
            <Button v-tooltip.top="t('common.edit')" icon="pi pi-pencil" text rounded @click="openEdit(data)" />
            <Button v-tooltip.top="t('common.delete')" icon="pi pi-trash" severity="danger" text rounded @click="confirmDelete(data)" />
          </div>
        </template>
      </Column>
    </DataTable>

    <!-- حوار الإنشاء/التعديل -->
    <AppDialog
      v-model:visible="dialogOpen"
      modal
      :header="editingId ? t('releasesAdmin.editTitle') : t('releasesAdmin.add')"
      :style="{ width: '44rem' }"
      :breakpoints="{ '640px': '95vw' }"
    >
      <div class="grid gap-4">
        <div class="grid gap-4 sm:grid-cols-3">
          <label class="block text-sm">
            <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('releasesAdmin.platform') }}</span>
            <Select v-model="form.platform" :options="platformOptions" option-label="label" option-value="value" fluid />
          </label>
          <label class="block text-sm">
            <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('releasesAdmin.version') }}</span>
            <InputText v-model="form.version" placeholder="1.4.0" fluid dir="ltr" />
          </label>
          <label class="block text-sm">
            <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('releasesAdmin.releasedAt') }}</span>
            <DatePicker v-model="form.released_at" date-format="yy-mm-dd" show-icon fluid />
          </label>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <label class="block text-sm">
            <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('releasesAdmin.titleAr') }}</span>
            <InputText v-model="form.titleAr" fluid />
          </label>
          <label class="block text-sm">
            <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('releasesAdmin.titleEn') }}</span>
            <InputText v-model="form.titleEn" fluid dir="ltr" />
          </label>
        </div>

        <label class="flex items-center gap-2 text-sm">
          <ToggleSwitch v-model="form.is_published" />
          <span class="font-medium text-surface-700 dark:text-surface-300">{{ t('releasesAdmin.isPublished') }}</span>
        </label>

        <!-- محرّر البنود الديناميكي -->
        <div v-for="kind in KINDS" :key="kind" class="rounded-xl border border-surface-200 p-3 dark:border-surface-700">
          <div class="mb-2 flex items-center justify-between">
            <span class="text-sm font-semibold text-surface-800 dark:text-surface-100">{{ t('whatsNew.' + kind) }}</span>
            <Button :label="t('releasesAdmin.addItem')" icon="pi pi-plus" size="small" text @click="addItem(kind)" />
          </div>
          <p v-if="!form.entries[kind].length" class="py-2 text-center text-xs text-surface-400">{{ t('releasesAdmin.noItems') }}</p>
          <div v-for="(item, idx) in form.entries[kind]" :key="idx" class="mb-2 flex items-start gap-2 last:mb-0">
            <InputText v-model="item.ar" :placeholder="t('releasesAdmin.itemAr')" fluid class="flex-1" />
            <InputText v-model="item.en" :placeholder="t('releasesAdmin.itemEn')" fluid class="flex-1" dir="ltr" />
            <Button
              v-tooltip.top="t('common.delete')"
              icon="pi pi-times"
              severity="danger"
              text
              rounded
              @click="removeItem(kind, idx)"
            />
          </div>
        </div>
      </div>

      <template #footer>
        <Button :label="t('common.cancel')" severity="secondary" outlined :disabled="saving" @click="dialogOpen = false" />
        <Button :label="t('common.save')" icon="pi pi-check" :loading="saving" @click="save" />
      </template>
    </AppDialog>
  </div>
</template>
