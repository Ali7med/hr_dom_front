<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import MultiSelect from 'primevue/multiselect'
import Tag from 'primevue/tag'
import { ApiException } from '@/api/client'
import { alertsApi, type Alert, type AlertTargetType } from '@/api/alerts'
import { usersApi, departmentsApi, type User, type Department } from '@/api/users'
import PageHeader from '@/components/PageHeader.vue'

const { t } = useI18n()
const toast = useToast()

const alerts = ref<Alert[]>([])
const departments = ref<Department[]>([])
const users = ref<User[]>([])
const loading = ref(false)
const saving = ref(false)

const showForm = ref(false)
const form = reactive({
  title: '',
  body: '',
  target_type: 'all' as AlertTargetType,
  department_ids: [] as number[],
  user_ids: [] as number[],
})

const targetOptions = computed(() => [
  { label: t('alerts.target.all'), value: 'all' },
  { label: t('alerts.target.department'), value: 'department' },
  { label: t('alerts.target.users'), value: 'users' },
])

function messageFor(e: unknown, fallback: string): string {
  return e instanceof ApiException ? e.message : fallback
}
function notifyError(e: unknown, fallback: string): void {
  toast.add({ severity: 'error', summary: t('common.error'), detail: messageFor(e, fallback), life: 4000 })
}

function targetLabel(a: Alert): string {
  return t(`alerts.target.${a.target_type}`)
}

async function load(): Promise<void> {
  loading.value = true
  try {
    const res = await alertsApi.list({ per_page: 100 })
    alerts.value = res.data
  } catch (e) {
    notifyError(e, t('common.loadError'))
  } finally {
    loading.value = false
  }
}

// الأقسام والمستخدمون لاستهداف التنبيه (لا تُعطّل الصفحة عند نقص الصلاحية).
async function loadTargets(): Promise<void> {
  try {
    departments.value = await departmentsApi.list()
  } catch { /* تجاهل */ }
  try {
    const res = await usersApi.list({ per_page: 100 })
    users.value = res.data
  } catch { /* تجاهل */ }
}

function openCreate(): void {
  form.title = ''
  form.body = ''
  form.target_type = 'all'
  form.department_ids = []
  form.user_ids = []
  showForm.value = true
}

async function submit(): Promise<void> {
  // تحقّق محلّي من اختيار المستلمين حسب نوع الاستهداف.
  if (form.target_type === 'department' && !form.department_ids.length) {
    toast.add({ severity: 'warn', summary: t('alerts.targetRequired'), life: 3000 })
    return
  }
  if (form.target_type === 'users' && !form.user_ids.length) {
    toast.add({ severity: 'warn', summary: t('alerts.targetRequired'), life: 3000 })
    return
  }
  saving.value = true
  try {
    await alertsApi.create({
      title: form.title,
      body: form.body,
      target_type: form.target_type,
      department_ids: form.target_type === 'department' ? form.department_ids : null,
      user_ids: form.target_type === 'users' ? form.user_ids : null,
    })
    showForm.value = false
    toast.add({ severity: 'success', summary: t('alerts.sent'), life: 2500 })
    await load()
  } catch (e) {
    // استهداف لم يطابق أحداً → رسالة ودّية، وإلا رسالة الخطأ العامة.
    if (e instanceof ApiException && e.first?.code === 'no_recipients') {
      toast.add({ severity: 'warn', summary: t('alerts.noRecipients'), life: 4000 })
    } else {
      notifyError(e, t('common.saveError'))
    }
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  void load()
  void loadTargets()
})
</script>

<template>
  <div class="mx-auto max-w-5xl">
    <PageHeader :title="t('alerts.title')" :subtitle="t('alerts.subtitle')">
      <template #actions>
        <Button v-can="'alerts.send'" :label="t('alerts.create')" icon="pi pi-send" @click="openCreate" />
      </template>
    </PageHeader>

    <div class="overflow-hidden rounded-2xl border border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
      <DataTable
        :value="alerts"
        :loading="loading"
        paginator
        :rows="10"
        :rows-per-page-options="[10, 20, 50]"
        data-key="id"
        striped-rows
        removable-sort
      >
        <template #empty>
          <p class="py-6 text-center text-sm text-surface-500">{{ t('alerts.empty') }}</p>
        </template>

        <Column field="title" :header="t('alerts.colTitle')" sortable>
          <template #body="{ data }">
            <div class="min-w-0">
              <div class="font-medium text-surface-900 dark:text-white">{{ data.title }}</div>
              <div class="truncate text-xs text-surface-500">{{ data.body }}</div>
            </div>
          </template>
        </Column>
        <Column :header="t('alerts.colTarget')">
          <template #body="{ data }">
            <Tag :value="targetLabel(data)" severity="info" />
          </template>
        </Column>
        <Column field="recipients_count" :header="t('alerts.colRecipients')" sortable>
          <template #body="{ data }">{{ data.recipients_count ?? 0 }}</template>
        </Column>
        <Column field="read_count" :header="t('alerts.colRead')" sortable>
          <template #body="{ data }">
            <span class="text-surface-600 dark:text-surface-300">
              {{ data.read_count ?? 0 }} / {{ data.recipients_count ?? 0 }}
            </span>
          </template>
        </Column>
        <Column :header="t('alerts.colCreator')">
          <template #body="{ data }">
            <span class="text-sm text-surface-600 dark:text-surface-300">{{ data.creator?.name || '—' }}</span>
          </template>
        </Column>
        <Column field="created_at" :header="t('alerts.colDate')" sortable>
          <template #body="{ data }">
            <span class="font-mono text-xs text-surface-500" dir="ltr">{{ (data.created_at || '').slice(0, 16).replace('T', ' ') }}</span>
          </template>
        </Column>
      </DataTable>
    </div>

    <!-- نموذج إنشاء تنبيه -->
    <Dialog
      v-model:visible="showForm"
      modal
      :header="t('alerts.create')"
      :style="{ width: '34rem' }"
      :breakpoints="{ '640px': '95vw' }"
    >
      <form class="space-y-4 pt-2" @submit.prevent="submit">
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('alerts.titleField') }}</span>
          <InputText v-model="form.title" required maxlength="255" fluid />
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('alerts.bodyField') }}</span>
          <Textarea v-model="form.body" required rows="4" maxlength="5000" auto-resize fluid />
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('alerts.targetType') }}</span>
          <Select v-model="form.target_type" :options="targetOptions" option-label="label" option-value="value" fluid />
        </label>

        <label v-if="form.target_type === 'department'" class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('alerts.departments') }}</span>
          <MultiSelect
            v-model="form.department_ids"
            :options="departments"
            option-label="name"
            option-value="id"
            filter
            :filter-placeholder="t('common.search')"
            :placeholder="t('alerts.departments')"
            fluid
          />
        </label>
        <label v-else-if="form.target_type === 'users'" class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('alerts.users') }}</span>
          <MultiSelect
            v-model="form.user_ids"
            :options="users"
            option-label="name"
            option-value="id"
            filter
            :filter-placeholder="t('common.search')"
            :placeholder="t('alerts.users')"
            fluid
          />
        </label>

        <div class="mt-2 flex justify-end gap-2">
          <Button type="button" :label="t('common.cancel')" severity="secondary" text @click="showForm = false" />
          <Button type="submit" :label="saving ? t('common.saving') : t('alerts.send')" icon="pi pi-send" :loading="saving" />
        </div>
      </form>
    </Dialog>
  </div>
</template>
