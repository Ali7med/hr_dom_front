<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Select from 'primevue/select'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import ToggleSwitch from 'primevue/toggleswitch'
import Tag from 'primevue/tag'
import Dialog from '@/components/AppDialog.vue'
import PageHeader from '@/components/PageHeader.vue'
import { ApiException } from '@/api/client'
import {
  absencesApi,
  absenceResolutionTypesApi,
  type Absence,
  type AbsenceResolutionType,
  type AbsenceStatus,
} from '@/api/absences'
import { departmentsApi, type Department } from '@/api/users'

const { t } = useI18n()
const confirm = useConfirm()
const toast = useToast()

function messageFor(e: unknown, fallback: string): string {
  return e instanceof ApiException ? e.message : fallback
}
function notifyError(e: unknown, fallback: string): void {
  toast.add({ severity: 'error', summary: t('common.error'), detail: messageFor(e, fallback), life: 4000 })
}

// الباك قد يُرجع التاريخ بصيغة ISO كاملة؛ نعرض جزء YYYY-MM-DD فقط.
const ymd = (date?: string | null) => (date ? date.slice(0, 10) : '—')

// ===== الفلاتر + السجل =====
const filters = reactive({
  from: '',
  to: '',
  department_id: 0,
  status: '' as '' | AbsenceStatus,
})
const statusOptions = [
  { value: '', label: 'absences.allStatuses' },
  { value: 'unresolved', label: 'absences.statusUnresolved' },
  { value: 'resolved', label: 'absences.statusResolved' },
]

const departments = ref<Department[]>([])
const types = ref<AbsenceResolutionType[]>([])
const activeTypes = computed(() => types.value.filter((ty) => ty.is_active))

const absences = ref<Absence[]>([])
const total = ref(0)
const loading = ref(false)
const loaded = ref(false)

const employeeName = (a: Absence) => a.user?.name ?? `#${a.user_id}`
const departmentName = (a: Absence) =>
  a.department?.name ?? departments.value.find((d) => d.id === a.department_id)?.name ?? '—'
const shiftName = (a: Absence) => a.shift?.name ?? (a.shift_id ? `#${a.shift_id}` : '—')
const typeName = (a: Absence) =>
  a.resolution_type?.name ?? types.value.find((ty) => ty.id === a.resolution_type_id)?.name ?? '—'

function buildParams(): Record<string, unknown> {
  const p: Record<string, unknown> = {}
  if (filters.from) p.from = filters.from
  if (filters.to) p.to = filters.to
  if (filters.department_id) p.department_id = filters.department_id
  if (filters.status) p.status = filters.status
  return p
}

async function run(): Promise<void> {
  loading.value = true
  try {
    const res = await absencesApi.list(buildParams())
    absences.value = res.data
    total.value = res.pagination?.total ?? res.data.length
    loaded.value = true
  } catch (e) {
    notifyError(e, t('common.loadError'))
  } finally {
    loading.value = false
  }
}

// ===== معالجة غياب =====
const resolveForm = reactive({
  open: false,
  absence: null as Absence | null,
  resolution_type_id: 0,
  note: '',
})
const savingResolve = ref(false)
function openResolve(a: Absence): void {
  resolveForm.open = true
  resolveForm.absence = a
  resolveForm.resolution_type_id = a.resolution_type_id ?? activeTypes.value[0]?.id ?? 0
  resolveForm.note = a.note ?? ''
}
async function submitResolve(): Promise<void> {
  if (!resolveForm.absence || !resolveForm.resolution_type_id) return
  savingResolve.value = true
  try {
    await absencesApi.resolve(resolveForm.absence.id, {
      resolution_type_id: resolveForm.resolution_type_id,
      note: resolveForm.note || null,
    })
    resolveForm.open = false
    toast.add({ severity: 'success', summary: t('absences.resolved'), life: 2500 })
    await run()
  } catch (e) {
    notifyError(e, t('common.saveError'))
  } finally {
    savingResolve.value = false
  }
}

// ===== إدارة أنواع المعالجة (CRUD) =====
const typesDialog = ref(false)
const typeForm = reactive({
  id: null as number | null,
  name: '',
  is_active: true,
})
const savingType = ref(false)
function resetTypeForm(): void {
  typeForm.id = null
  typeForm.name = ''
  typeForm.is_active = true
}
function editType(ty: AbsenceResolutionType): void {
  typeForm.id = ty.id
  typeForm.name = ty.name
  typeForm.is_active = ty.is_active
}
async function loadTypes(): Promise<void> {
  try {
    types.value = await absenceResolutionTypesApi.list()
  } catch {
    // قائمة الأنواع اختيارية — تجاهل فشل التحميل.
  }
}
async function submitType(): Promise<void> {
  if (!typeForm.name.trim()) return
  savingType.value = true
  try {
    const payload = { name: typeForm.name.trim(), is_active: typeForm.is_active }
    if (typeForm.id === null) await absenceResolutionTypesApi.create(payload)
    else await absenceResolutionTypesApi.update(typeForm.id, payload)
    toast.add({ severity: 'success', summary: t('common.saved'), life: 2000 })
    resetTypeForm()
    await loadTypes()
  } catch (e) {
    notifyError(e, t('common.saveError'))
  } finally {
    savingType.value = false
  }
}
function removeType(ty: AbsenceResolutionType): void {
  confirm.require({
    message: t('absences.confirmDeleteType', { name: ty.name }),
    header: t('common.delete'),
    icon: 'pi pi-exclamation-triangle',
    acceptProps: { severity: 'danger', label: t('common.delete') },
    rejectProps: { severity: 'secondary', outlined: true, label: t('common.cancel') },
    accept: async () => {
      try {
        await absenceResolutionTypesApi.remove(ty.id)
        toast.add({ severity: 'success', summary: t('common.deleted'), life: 2000 })
        if (typeForm.id === ty.id) resetTypeForm()
        await loadTypes()
      } catch (e) {
        notifyError(e, t('common.saveError'))
      }
    },
  })
}
function openTypes(): void {
  resetTypeForm()
  typesDialog.value = true
}

onMounted(async () => {
  try {
    departments.value = await departmentsApi.list()
  } catch {
    // الفلاتر اختيارية.
  }
  await loadTypes()
  await run()
})
</script>

<template>
  <div class="mx-auto max-w-5xl">
    <PageHeader :title="t('absences.title')" :subtitle="t('absences.subtitle')">
      <template #actions>
        <Button
          v-can="'absences.manage'"
          outlined
          icon="pi pi-tags"
          :label="t('absences.manageTypes')"
          @click="openTypes"
        />
      </template>
    </PageHeader>

    <!-- الفلاتر -->
    <div class="mb-6 rounded-2xl border border-surface-200 bg-white p-4 dark:border-surface-800 dark:bg-surface-900">
      <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('reports.from') }}</span>
          <input v-model="filters.from" type="date" class="field" />
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('reports.to') }}</span>
          <input v-model="filters.to" type="date" class="field" />
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('reports.department') }}</span>
          <Select
            v-model.number="filters.department_id"
            :options="[{ id: 0, name: t('reports.allDepartments') }, ...departments]"
            option-label="name"
            option-value="id"
            fluid
          />
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('absences.status') }}</span>
          <Select v-model="filters.status" :options="statusOptions" option-value="value" fluid>
            <template #value="{ value }">{{ t(statusOptions.find((o) => o.value === value)?.label ?? '') }}</template>
            <template #option="{ option }">{{ t(option.label) }}</template>
          </Select>
        </label>
      </div>

      <div class="mt-4 flex flex-wrap gap-3">
        <Button
          icon="pi pi-search"
          :label="loading ? t('common.loading') : t('absences.search')"
          :loading="loading"
          :disabled="loading"
          @click="run"
        />
      </div>
    </div>

    <!-- سجل الغيابات -->
    <div v-if="loaded" class="overflow-hidden rounded-2xl border border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
      <div class="flex items-center justify-between border-b border-surface-100 px-4 py-3 dark:border-surface-800">
        <h2 class="text-sm font-semibold text-surface-700 dark:text-surface-200">{{ t('absences.recordTitle') }}</h2>
        <span class="text-xs text-surface-500">{{ t('reports.rowsCount', { n: total }) }}</span>
      </div>
      <DataTable
        :value="absences"
        paginator
        :rows="15"
        :rows-per-page-options="[15, 30, 50]"
        data-key="id"
        striped-rows
        removable-sort
      >
        <template #empty>
          <p class="py-6 text-center text-sm text-surface-500">{{ t('absences.empty') }}</p>
        </template>

        <Column :header="t('absences.employee')">
          <template #body="{ data }">
            <span class="font-medium text-surface-900 dark:text-white">{{ employeeName(data) }}</span>
          </template>
        </Column>
        <Column :header="t('absences.department')">
          <template #body="{ data }"><span class="text-surface-500">{{ departmentName(data) }}</span></template>
        </Column>
        <Column field="date" :header="t('absences.date')" sortable>
          <template #body="{ data }"><span class="text-surface-500" dir="ltr">{{ ymd(data.date) }}</span></template>
        </Column>
        <Column :header="t('absences.shift')">
          <template #body="{ data }"><span class="text-surface-500">{{ shiftName(data) }}</span></template>
        </Column>
        <Column :header="t('absences.reason')">
          <template #body="{ data }"><span class="text-surface-500">{{ data.reason ?? '—' }}</span></template>
        </Column>
        <Column :header="t('absences.statusCol')">
          <template #body="{ data }">
            <Tag
              :value="data.status === 'resolved' ? t('absences.statusResolved') : t('absences.statusUnresolved')"
              :severity="data.status === 'resolved' ? 'success' : 'warn'"
            />
          </template>
        </Column>
        <Column :header="t('absences.resolutionType')">
          <template #body="{ data }"><span class="text-surface-500">{{ typeName(data) }}</span></template>
        </Column>
        <Column :header="t('companies.actions')" class="text-end">
          <template #body="{ data }">
            <div class="flex justify-end">
              <Button
                v-can="'absences.resolve'"
                :label="data.status === 'resolved' ? t('absences.update') : t('absences.resolve')"
                :icon="data.status === 'resolved' ? 'pi pi-pencil' : 'pi pi-check-circle'"
                size="small"
                :severity="data.status === 'resolved' ? 'secondary' : undefined"
                :outlined="data.status === 'resolved'"
                @click="openResolve(data)"
              />
            </div>
          </template>
        </Column>
      </DataTable>
    </div>

    <!-- حوار معالجة غياب -->
    <Dialog
      v-model:visible="resolveForm.open"
      modal
      :header="t('absences.resolveTitle')"
      :style="{ width: '32rem' }"
      :breakpoints="{ '640px': '95vw' }"
    >
      <div v-if="resolveForm.absence" class="grid gap-4 pt-2">
        <p class="text-sm text-surface-500">
          {{ employeeName(resolveForm.absence) }} — <span dir="ltr">{{ ymd(resolveForm.absence.date) }}</span>
        </p>
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('absences.resolutionType') }}</span>
          <Select
            v-model.number="resolveForm.resolution_type_id"
            :options="activeTypes"
            option-label="name"
            option-value="id"
            :placeholder="t('absences.pickType')"
            fluid
          />
          <span v-if="activeTypes.length === 0" class="mt-1 block text-xs text-amber-600">{{ t('absences.noTypesHint') }}</span>
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('absences.note') }}</span>
          <Textarea v-model="resolveForm.note" rows="3" :maxlength="500" auto-resize fluid />
        </label>
        <div class="mt-2 flex justify-end gap-2">
          <Button type="button" :label="t('common.cancel')" severity="secondary" text @click="resolveForm.open = false" />
          <Button
            type="button"
            :label="savingResolve ? t('common.saving') : t('absences.confirmResolve')"
            icon="pi pi-check"
            :loading="savingResolve"
            :disabled="!resolveForm.resolution_type_id"
            @click="submitResolve"
          />
        </div>
      </div>
    </Dialog>

    <!-- حوار إدارة أنواع المعالجة -->
    <Dialog
      v-model:visible="typesDialog"
      modal
      :header="t('absences.manageTypes')"
      :style="{ width: '36rem' }"
      :breakpoints="{ '640px': '95vw' }"
    >
      <div class="pt-2">
        <!-- نموذج إضافة/تعديل نوع -->
        <form class="mb-4 grid items-end gap-3 sm:grid-cols-[1fr_auto_auto]" @submit.prevent="submitType">
          <label class="block text-sm">
            <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('absences.typeName') }}</span>
            <InputText v-model="typeForm.name" required maxlength="100" :placeholder="t('absences.typeNamePlaceholder')" fluid />
          </label>
          <label class="flex items-center gap-2 pb-2 text-sm">
            <ToggleSwitch v-model="typeForm.is_active" />
            <span class="text-surface-700 dark:text-surface-300">{{ t('absences.active') }}</span>
          </label>
          <div class="flex gap-2 pb-1">
            <Button
              type="submit"
              :label="typeForm.id === null ? t('absences.addType') : t('common.save')"
              :icon="typeForm.id === null ? 'pi pi-plus' : 'pi pi-check'"
              :loading="savingType"
            />
            <Button
              v-if="typeForm.id !== null"
              type="button"
              :label="t('common.cancel')"
              severity="secondary"
              text
              @click="resetTypeForm"
            />
          </div>
        </form>

        <!-- قائمة الأنواع -->
        <div class="overflow-hidden rounded-xl border border-surface-200 dark:border-surface-800">
          <DataTable :value="types" data-key="id" striped-rows>
            <template #empty>
              <p class="py-5 text-center text-sm text-surface-500">{{ t('absences.noTypes') }}</p>
            </template>
            <Column field="name" :header="t('absences.typeName')">
              <template #body="{ data }"><span class="font-medium text-surface-900 dark:text-white">{{ data.name }}</span></template>
            </Column>
            <Column :header="t('absences.active')">
              <template #body="{ data }">
                <Tag
                  :value="data.is_active ? t('absences.activeYes') : t('absences.activeNo')"
                  :severity="data.is_active ? 'success' : 'secondary'"
                />
              </template>
            </Column>
            <Column :header="t('companies.actions')" class="text-end">
              <template #body="{ data }">
                <div class="flex justify-end gap-1">
                  <Button
                    v-tooltip.top="t('common.edit')"
                    icon="pi pi-pencil"
                    severity="secondary"
                    text
                    rounded
                    @click="editType(data)"
                  />
                  <Button
                    v-tooltip.top="t('common.delete')"
                    icon="pi pi-trash"
                    severity="danger"
                    text
                    rounded
                    @click="removeType(data)"
                  />
                </div>
              </template>
            </Column>
          </DataTable>
        </div>
      </div>
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
