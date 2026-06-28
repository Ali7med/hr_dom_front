<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Select from 'primevue/select'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import ProgressBar from 'primevue/progressbar'
import Tag from 'primevue/tag'
import Dialog from '@/components/AppDialog.vue'
import PageHeader from '@/components/PageHeader.vue'
import { ApiException } from '@/api/client'
import {
  onboardingTemplatesApi,
  onboardingProcessesApi,
  onboardingTasksApi,
  type OnboardingTemplate,
  type OnboardingProcess,
  type OnboardingType,
  type ProcessStatus,
} from '@/api/onboarding'
import { usersApi, type User } from '@/api/users'

const { t } = useI18n()
const confirm = useConfirm()
const toast = useToast()

function notifyError(e: unknown, fallback: string): void {
  const msg = e instanceof ApiException ? e.message : fallback
  toast.add({ severity: 'error', summary: t('common.error'), detail: msg, life: 4000 })
}
const ymd = (d?: string | null) => (d ? d.slice(0, 10) : '—')

const typeOptions: { value: OnboardingType; key: string }[] = [
  { value: 'onboarding', key: 'onboarding.typeOnboarding' },
  { value: 'offboarding', key: 'onboarding.typeOffboarding' },
]
const typeLabel = (v: OnboardingType) => t(v === 'onboarding' ? 'onboarding.typeOnboarding' : 'onboarding.typeOffboarding')
const typeSeverity = (v: OnboardingType) => (v === 'onboarding' ? 'success' : 'warn')

const users = ref<User[]>([])
const templates = ref<OnboardingTemplate[]>([])

// ===== السير =====
const procFilters = reactive({ type: '' as '' | OnboardingType, status: '' as '' | ProcessStatus })
const procStatusOptions = [
  { value: '', label: 'onboarding.allStatuses' },
  { value: 'in_progress', label: 'onboarding.statusInProgress' },
  { value: 'completed', label: 'onboarding.statusCompleted' },
]
const procTypeOptions = [{ value: '', key: 'onboarding.allTypes' }, ...typeOptions]
const processes = ref<OnboardingProcess[]>([])
const procLoading = ref(false)

async function loadProcesses(): Promise<void> {
  procLoading.value = true
  try {
    const p: Record<string, unknown> = {}
    if (procFilters.type) p.type = procFilters.type
    if (procFilters.status) p.status = procFilters.status
    processes.value = (await onboardingProcessesApi.list(p)).data
  } catch (e) {
    notifyError(e, t('common.loadError'))
  } finally {
    procLoading.value = false
  }
}

// بدء سير
const startForm = reactive({ open: false, user_id: 0, type: 'onboarding' as OnboardingType, template_id: 0, start_date: '' })
const starting = ref(false)
const startFormTemplates = computed(() => templates.value.filter((tp) => tp.type === startForm.type))
function openStart(): void {
  startForm.open = true
  startForm.user_id = users.value[0]?.id ?? 0
  startForm.type = 'onboarding'
  startForm.template_id = 0
  startForm.start_date = ''
}
async function submitStart(): Promise<void> {
  if (!startForm.user_id || !startForm.start_date) return
  starting.value = true
  try {
    await onboardingProcessesApi.create({
      user_id: startForm.user_id,
      type: startForm.type,
      template_id: startForm.template_id || null,
      start_date: startForm.start_date,
    })
    startForm.open = false
    toast.add({ severity: 'success', summary: t('onboarding.started'), life: 2500 })
    await loadProcesses()
  } catch (e) {
    notifyError(e, t('common.saveError'))
  } finally {
    starting.value = false
  }
}

// تفاصيل سير + مهامه
const detail = reactive({ open: false, loading: false, process: null as OnboardingProcess | null })
const completingTask = ref<number | null>(null)
async function openDetail(p: OnboardingProcess): Promise<void> {
  detail.open = true
  detail.loading = true
  detail.process = p
  try {
    detail.process = await onboardingProcessesApi.get(p.id)
  } catch {
    // نبقي صفّ القائمة كحدّ أدنى.
  } finally {
    detail.loading = false
  }
}
async function completeTask(taskId: number): Promise<void> {
  completingTask.value = taskId
  try {
    await onboardingTasksApi.complete(taskId)
    if (detail.process) detail.process = await onboardingProcessesApi.get(detail.process.id)
    await loadProcesses()
  } catch (e) {
    notifyError(e, t('common.saveError'))
  } finally {
    completingTask.value = null
  }
}

// ===== القوالب =====
const tmplLoading = ref(false)
async function loadTemplates(): Promise<void> {
  tmplLoading.value = true
  try {
    templates.value = await onboardingTemplatesApi.list()
  } catch (e) {
    notifyError(e, t('common.loadError'))
  } finally {
    tmplLoading.value = false
  }
}
const templateName = (id?: number | null) => templates.value.find((tp) => tp.id === id)?.name ?? '—'

const tmplForm = reactive({
  open: false,
  id: null as number | null,
  type: 'onboarding' as OnboardingType,
  name: '',
  items: [] as { title: string; assignee_role: string; due_offset_days: number | null }[],
})
const tmplSaving = ref(false)
function openTemplate(tp?: OnboardingTemplate): void {
  tmplForm.open = true
  tmplForm.id = tp?.id ?? null
  tmplForm.type = tp?.type ?? 'onboarding'
  tmplForm.name = tp?.name ?? ''
  tmplForm.items = tp?.items?.length
    ? tp.items.map((it) => ({ title: it.title, assignee_role: it.assignee_role ?? '', due_offset_days: it.due_offset_days ?? null }))
    : [{ title: '', assignee_role: '', due_offset_days: null }]
}
function addItem(): void {
  tmplForm.items.push({ title: '', assignee_role: '', due_offset_days: null })
}
function removeItem(i: number): void {
  tmplForm.items.splice(i, 1)
}
async function submitTemplate(): Promise<void> {
  const items = tmplForm.items.filter((it) => it.title.trim())
  if (!tmplForm.name.trim() || items.length === 0) {
    toast.add({ severity: 'warn', summary: t('common.error'), detail: t('onboarding.needNameItems'), life: 4000 })
    return
  }
  tmplSaving.value = true
  try {
    const payload = {
      type: tmplForm.type,
      name: tmplForm.name.trim(),
      items: items.map((it) => ({ title: it.title.trim(), assignee_role: it.assignee_role.trim() || null, due_offset_days: it.due_offset_days })),
    }
    if (tmplForm.id === null) await onboardingTemplatesApi.create(payload)
    else await onboardingTemplatesApi.update(tmplForm.id, payload)
    tmplForm.open = false
    toast.add({ severity: 'success', summary: t('common.saved'), life: 2500 })
    await loadTemplates()
  } catch (e) {
    notifyError(e, t('common.saveError'))
  } finally {
    tmplSaving.value = false
  }
}
function removeTemplate(tp: OnboardingTemplate): void {
  confirm.require({
    message: t('onboarding.confirmDeleteTemplate', { name: tp.name }),
    header: t('common.delete'),
    icon: 'pi pi-exclamation-triangle',
    acceptProps: { severity: 'danger', label: t('common.delete') },
    rejectProps: { severity: 'secondary', outlined: true, label: t('common.cancel') },
    accept: async () => {
      try {
        await onboardingTemplatesApi.remove(tp.id)
        toast.add({ severity: 'success', summary: t('common.deleted'), life: 2500 })
        await loadTemplates()
      } catch (e) {
        notifyError(e, t('common.saveError'))
      }
    },
  })
}

onMounted(async () => {
  try {
    users.value = (await usersApi.list({ per_page: 200 })).data
  } catch {
    // قائمة الموظفين اختيارية.
  }
  await Promise.all([loadProcesses(), loadTemplates()])
})
</script>

<template>
  <div class="mx-auto max-w-5xl">
    <PageHeader :title="t('onboarding.title')" :subtitle="t('onboarding.subtitle')" />

    <Tabs value="processes">
      <TabList>
        <Tab value="processes">{{ t('onboarding.tabProcesses') }}</Tab>
        <Tab value="templates">{{ t('onboarding.tabTemplates') }}</Tab>
      </TabList>
      <TabPanels>
        <!-- ===== السير ===== -->
        <TabPanel value="processes">
          <div class="mb-4 flex flex-wrap items-end gap-4">
            <label class="block text-sm">
              <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('onboarding.type') }}</span>
              <Select v-model="procFilters.type" :options="procTypeOptions" option-value="value" class="w-48" @change="loadProcesses">
                <template #value="{ value }">{{ t(procTypeOptions.find((o) => o.value === value)?.key ?? '') }}</template>
                <template #option="{ option }">{{ t(option.key) }}</template>
              </Select>
            </label>
            <label class="block text-sm">
              <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('onboarding.status') }}</span>
              <Select v-model="procFilters.status" :options="procStatusOptions" option-value="value" class="w-48" @change="loadProcesses">
                <template #value="{ value }">{{ t(procStatusOptions.find((o) => o.value === value)?.label ?? '') }}</template>
                <template #option="{ option }">{{ t(option.label) }}</template>
              </Select>
            </label>
            <Button v-can="'onboarding.manage'" icon="pi pi-plus" :label="t('onboarding.start')" class="ms-auto" @click="openStart" />
          </div>

          <div class="overflow-hidden rounded-2xl border border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
            <DataTable :value="processes" :loading="procLoading" paginator :rows="15" :rows-per-page-options="[15, 30, 50]" data-key="id" striped-rows>
              <template #empty><p class="py-6 text-center text-sm text-surface-500">{{ t('onboarding.emptyProcesses') }}</p></template>
              <Column :header="t('onboarding.employee')">
                <template #body="{ data }">
                  <div class="font-medium text-surface-900 dark:text-white">{{ data.user_name ?? '#' + data.user_id }}</div>
                  <div v-if="data.employee_no" class="text-xs text-surface-500" dir="ltr">{{ data.employee_no }}</div>
                </template>
              </Column>
              <Column :header="t('onboarding.type')">
                <template #body="{ data }"><Tag :value="typeLabel(data.type)" :severity="typeSeverity(data.type)" /></template>
              </Column>
              <Column :header="t('onboarding.startDate')">
                <template #body="{ data }"><span class="text-surface-500" dir="ltr">{{ ymd(data.start_date) }}</span></template>
              </Column>
              <Column :header="t('onboarding.progress')" style="min-width: 11rem">
                <template #body="{ data }">
                  <div class="flex items-center gap-2">
                    <ProgressBar :value="data.progress ?? 0" :show-value="false" class="h-2 flex-1" />
                    <span class="w-20 text-xs text-surface-500" dir="ltr">{{ data.tasks_done }}/{{ data.tasks_total }}</span>
                  </div>
                </template>
              </Column>
              <Column :header="t('onboarding.statusCol')">
                <template #body="{ data }">
                  <Tag
                    :value="data.status === 'completed' ? t('onboarding.statusCompleted') : t('onboarding.statusInProgress')"
                    :severity="data.status === 'completed' ? 'success' : 'info'"
                  />
                </template>
              </Column>
              <Column :header="t('companies.actions')" class="text-end">
                <template #body="{ data }">
                  <Button v-tooltip.top="t('onboarding.details')" icon="pi pi-list-check" severity="secondary" text rounded @click="openDetail(data)" />
                </template>
              </Column>
            </DataTable>
          </div>
        </TabPanel>

        <!-- ===== القوالب ===== -->
        <TabPanel value="templates">
          <div class="mb-4 flex justify-end">
            <Button v-can="'onboarding.manage'" icon="pi pi-plus" :label="t('onboarding.newTemplate')" @click="openTemplate()" />
          </div>
          <div class="overflow-hidden rounded-2xl border border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
            <DataTable :value="templates" :loading="tmplLoading" paginator :rows="15" data-key="id" striped-rows>
              <template #empty><p class="py-6 text-center text-sm text-surface-500">{{ t('onboarding.emptyTemplates') }}</p></template>
              <Column :header="t('onboarding.templateName')">
                <template #body="{ data }"><span class="font-medium text-surface-900 dark:text-white">{{ data.name }}</span></template>
              </Column>
              <Column :header="t('onboarding.type')">
                <template #body="{ data }"><Tag :value="typeLabel(data.type)" :severity="typeSeverity(data.type)" /></template>
              </Column>
              <Column :header="t('onboarding.itemsCount')">
                <template #body="{ data }"><span class="text-surface-500" dir="ltr">{{ data.items?.length ?? 0 }}</span></template>
              </Column>
              <Column :header="t('companies.actions')" class="text-end">
                <template #body="{ data }">
                  <div class="flex justify-end gap-1">
                    <Button v-can="'onboarding.manage'" v-tooltip.top="t('common.edit')" icon="pi pi-pencil" severity="secondary" text rounded @click="openTemplate(data)" />
                    <Button v-can="'onboarding.manage'" v-tooltip.top="t('common.delete')" icon="pi pi-trash" severity="danger" text rounded @click="removeTemplate(data)" />
                  </div>
                </template>
              </Column>
            </DataTable>
          </div>
        </TabPanel>
      </TabPanels>
    </Tabs>

    <!-- بدء سير -->
    <Dialog v-model:visible="startForm.open" modal :header="t('onboarding.start')" :style="{ width: '34rem' }" :breakpoints="{ '640px': '95vw' }">
      <form class="grid gap-4 pt-2 sm:grid-cols-2" @submit.prevent="submitStart">
        <label class="block text-sm sm:col-span-2">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('onboarding.employee') }}</span>
          <Select v-model.number="startForm.user_id" :options="users" option-label="name" option-value="id" filter fluid />
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('onboarding.type') }}</span>
          <Select v-model="startForm.type" :options="typeOptions" option-value="value" fluid @change="startForm.template_id = 0">
            <template #value="{ value }">{{ typeLabel(value) }}</template>
            <template #option="{ option }">{{ t(option.key) }}</template>
          </Select>
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('onboarding.startDate') }}</span>
          <input v-model="startForm.start_date" type="date" required class="field" />
        </label>
        <label class="block text-sm sm:col-span-2">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('onboarding.template') }}</span>
          <Select
            v-model.number="startForm.template_id"
            :options="[{ id: 0, name: t('onboarding.defaultTemplate') }, ...startFormTemplates]"
            option-label="name"
            option-value="id"
            fluid
          />
        </label>
        <div class="mt-2 flex justify-end gap-2 sm:col-span-2">
          <Button type="button" :label="t('common.cancel')" severity="secondary" text @click="startForm.open = false" />
          <Button type="submit" :label="starting ? t('common.saving') : t('onboarding.start')" icon="pi pi-check" :loading="starting" :disabled="!startForm.user_id || !startForm.start_date" />
        </div>
      </form>
    </Dialog>

    <!-- تفاصيل سير + المهام -->
    <Dialog v-model:visible="detail.open" modal :header="t('onboarding.details')" :style="{ width: '40rem' }" :breakpoints="{ '640px': '95vw' }">
      <div v-if="detail.process" class="pt-2">
        <div class="mb-4 flex flex-wrap items-center gap-3">
          <span class="font-semibold text-surface-900 dark:text-white">{{ detail.process.user_name ?? '#' + detail.process.user_id }}</span>
          <Tag :value="typeLabel(detail.process.type)" :severity="typeSeverity(detail.process.type)" />
          <span class="text-sm text-surface-500" dir="ltr">{{ ymd(detail.process.start_date) }}</span>
          <span class="text-sm text-surface-500">· {{ templateName(detail.process.template_id) }}</span>
        </div>
        <div class="mb-4 flex items-center gap-2">
          <ProgressBar :value="detail.process.progress ?? 0" class="h-2.5 flex-1" />
          <span class="w-16 text-sm text-surface-600 dark:text-surface-300" dir="ltr">{{ detail.process.progress ?? 0 }}%</span>
        </div>
        <ul class="space-y-2">
          <li
            v-for="task in detail.process.tasks ?? []"
            :key="task.id"
            class="flex items-center justify-between gap-3 rounded-lg border border-surface-200 px-3 py-2.5 dark:border-surface-700"
            :class="task.status === 'done' ? 'bg-success-50/40 dark:bg-surface-800/40' : ''"
          >
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <i :class="task.status === 'done' ? 'pi pi-check-circle text-green-500' : 'pi pi-circle text-surface-400'" />
                <span class="truncate text-sm font-medium" :class="task.status === 'done' ? 'text-surface-400 line-through' : 'text-surface-800 dark:text-surface-100'">{{ task.title }}</span>
              </div>
              <div class="mt-0.5 ps-6 text-xs text-surface-500">
                <span v-if="task.assignee_role">{{ task.assignee_role }}</span>
                <span v-if="task.due_date" dir="ltr"> · {{ t('onboarding.due') }} {{ ymd(task.due_date) }}</span>
              </div>
            </div>
            <Button
              v-if="task.status !== 'done'"
              v-can="'onboarding.manage'"
              :label="t('onboarding.markDone')"
              icon="pi pi-check"
              size="small"
              severity="success"
              outlined
              :loading="completingTask === task.id"
              @click="completeTask(task.id)"
            />
            <span v-else class="shrink-0 text-xs text-green-600 dark:text-green-400">{{ t('onboarding.done') }}</span>
          </li>
        </ul>
        <p v-if="!detail.loading && !(detail.process.tasks ?? []).length" class="py-4 text-center text-sm text-surface-500">{{ t('onboarding.noTasks') }}</p>
      </div>
      <div class="mt-4 flex justify-end">
        <Button :label="t('common.cancel')" severity="secondary" text @click="detail.open = false" />
      </div>
    </Dialog>

    <!-- إنشاء/تعديل قالب -->
    <Dialog v-model:visible="tmplForm.open" modal :header="tmplForm.id === null ? t('onboarding.newTemplate') : t('onboarding.editTemplate')" :style="{ width: '42rem' }" :breakpoints="{ '640px': '95vw' }">
      <form class="pt-2" @submit.prevent="submitTemplate">
        <div class="mb-4 grid gap-4 sm:grid-cols-2">
          <label class="block text-sm">
            <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('onboarding.templateName') }}</span>
            <InputText v-model="tmplForm.name" :maxlength="150" fluid />
          </label>
          <label class="block text-sm">
            <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('onboarding.type') }}</span>
            <Select v-model="tmplForm.type" :options="typeOptions" option-value="value" fluid>
              <template #value="{ value }">{{ typeLabel(value) }}</template>
              <template #option="{ option }">{{ t(option.key) }}</template>
            </Select>
          </label>
        </div>

        <div class="mb-2 flex items-center justify-between">
          <span class="text-sm font-semibold text-surface-700 dark:text-surface-200">{{ t('onboarding.tasks') }}</span>
          <Button type="button" icon="pi pi-plus" :label="t('onboarding.addTask')" size="small" severity="secondary" outlined @click="addItem" />
        </div>
        <div class="space-y-2">
          <div v-for="(it, i) in tmplForm.items" :key="i" class="grid grid-cols-12 items-center gap-2">
            <InputText v-model="it.title" :placeholder="t('onboarding.taskTitle')" class="col-span-6" />
            <InputText v-model="it.assignee_role" :placeholder="t('onboarding.assigneeRole')" class="col-span-3" />
            <InputNumber v-model="it.due_offset_days" :placeholder="t('onboarding.dueOffset')" :min="0" :max="365" class="col-span-2" input-class="w-full" />
            <Button type="button" v-tooltip.top="t('common.delete')" :aria-label="t('common.delete')" icon="pi pi-times" severity="danger" text rounded class="col-span-1" :disabled="tmplForm.items.length === 1" @click="removeItem(i)" />
          </div>
        </div>
        <p class="mt-1.5 text-xs text-surface-500">{{ t('onboarding.dueOffsetHint') }}</p>

        <div class="mt-4 flex justify-end gap-2">
          <Button type="button" :label="t('common.cancel')" severity="secondary" text @click="tmplForm.open = false" />
          <Button type="submit" :label="tmplSaving ? t('common.saving') : t('common.save')" icon="pi pi-check" :loading="tmplSaving" />
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
