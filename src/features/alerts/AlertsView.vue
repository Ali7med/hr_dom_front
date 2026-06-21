<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Dialog from '@/components/AppDialog.vue'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Select from 'primevue/select'
import MultiSelect from 'primevue/multiselect'
import ToggleSwitch from 'primevue/toggleswitch'
import Checkbox from 'primevue/checkbox'
import Tag from 'primevue/tag'
import { ApiException } from '@/api/client'
import { alertsApi, type Alert, type AlertInput, type AlertTargetType, type AlertChannel, type AlertFrequency } from '@/api/alerts'
import { usersApi, departmentsApi, type User, type Department } from '@/api/users'
import PageHeader from '@/components/PageHeader.vue'

const { t } = useI18n()
const toast = useToast()
const confirm = useConfirm()

const CHANNELS: AlertChannel[] = ['push', 'email', 'telegram']
const acting = ref<number | null>(null)

const alerts = ref<Alert[]>([])
const departments = ref<Department[]>([])
const users = ref<User[]>([])
const loading = ref(false)
const saving = ref(false)
// الباك (BE-51) قد لا يكون منشوراً بعد على الخادم → رسالة «قيد التفعيل» بدل خطأ عام.
const backendUnavailable = ref(false)

// هل الخطأ بسبب عدم نشر مسارات التنبيهات بعد (404 not_found)؟
function isBackendMissing(e: unknown): boolean {
  return e instanceof ApiException && (e.status === 404 || e.first?.code === 'not_found')
}

const showForm = ref(false)
const form = reactive({
  title: '',
  body: '',
  target_type: 'all' as AlertTargetType,
  department_ids: [] as number[],
  user_ids: [] as number[],
  requires_ack: false,
  channels: ['push'] as AlertChannel[],
  frequency: 'once' as AlertFrequency,
  repeat_until: '',
})
const isRecurring = computed(() => form.frequency !== 'once')

const frequencyOptions = computed(() => [
  { label: t('alerts.freq.once'), value: 'once' },
  { label: t('alerts.freq.daily'), value: 'daily' },
  { label: t('alerts.freq.weekly'), value: 'weekly' },
  { label: t('alerts.freq.monthly'), value: 'monthly' },
])

// تفاصيل تنبيه (مع قائمة المُقِرّين) — FE-15.
const showDetails = ref(false)
const detail = ref<Alert | null>(null)
const detailLoading = ref(false)
async function openDetails(a: Alert): Promise<void> {
  detail.value = a
  showDetails.value = true
  detailLoading.value = true
  try {
    detail.value = await alertsApi.get(a.id)
  } catch (e) {
    notifyError(e, t('common.loadError'))
  } finally {
    detailLoading.value = false
  }
}

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
function channelIcon(c: string): string {
  return c === 'email' ? 'pi pi-envelope' : c === 'telegram' ? 'pi pi-telegram' : 'pi pi-bell'
}
const alertChannels = (a: Alert): string[] => (a.channels && a.channels.length ? a.channels : ['push'])
function freqLabel(f?: string): string {
  return t('alerts.freq.' + (f || 'once'))
}

async function load(): Promise<void> {
  loading.value = true
  backendUnavailable.value = false
  try {
    const res = await alertsApi.list({ per_page: 100 })
    alerts.value = res.data
  } catch (e) {
    // مسار التنبيهات غير منشور بعد → نعرض لافتة «قيد التفعيل» (لا خطأ مزعج).
    if (isBackendMissing(e)) backendUnavailable.value = true
    else notifyError(e, t('common.loadError'))
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
  form.requires_ack = false
  form.channels = ['push']
  form.frequency = 'once'
  form.repeat_until = ''
  showForm.value = true
}

// حذف تنبيه (بتأكيد) — يزيله من السجل وصناديق الوارد.
function confirmDelete(a: Alert): void {
  confirm.require({
    message: t('alerts.confirmDelete', { title: a.title }),
    header: t('alerts.deleteTitle'),
    icon: 'pi pi-exclamation-triangle',
    acceptProps: { severity: 'danger', label: t('common.delete') },
    rejectProps: { severity: 'secondary', outlined: true, label: t('common.cancel') },
    accept: async () => {
      acting.value = a.id
      try {
        await alertsApi.remove(a.id)
        toast.add({ severity: 'success', summary: t('alerts.deleted'), life: 2500 })
        await load()
      } catch (e) {
        notifyError(e, t('common.saveError'))
      } finally {
        acting.value = null
      }
    },
  })
}

// إعادة إرسال تنبيه سابق فوراً (كتنبيه جديد).
function confirmResend(a: Alert): void {
  confirm.require({
    message: t('alerts.confirmResend', { title: a.title }),
    header: t('alerts.resend'),
    icon: 'pi pi-replay',
    acceptProps: { label: t('alerts.resend') },
    rejectProps: { severity: 'secondary', outlined: true, label: t('common.cancel') },
    accept: async () => {
      acting.value = a.id
      try {
        await alertsApi.resend(a.id)
        toast.add({ severity: 'success', summary: t('alerts.resent'), life: 2500 })
        await load()
      } catch (e) {
        notifyError(e, t('common.saveError'))
      } finally {
        acting.value = null
      }
    },
  })
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
  if (!form.channels.length) {
    toast.add({ severity: 'warn', summary: t('alerts.channelRequired'), life: 3000 })
    return
  }
  saving.value = true
  try {
    // أرسل فقط حقل الاستهداف المعنيّ — إرسال null يفشل تحقّق الباك (array).
    const payload: AlertInput = {
      title: form.title,
      body: form.body,
      target_type: form.target_type,
      channels: form.channels,
      frequency: form.frequency,
    }
    if (form.target_type === 'department') payload.department_ids = form.department_ids
    else if (form.target_type === 'users') payload.user_ids = form.user_ids
    if (form.requires_ack) payload.requires_ack = true
    if (isRecurring.value && form.repeat_until) payload.repeat_until = form.repeat_until
    await alertsApi.create(payload)
    showForm.value = false
    toast.add({ severity: 'success', summary: t('alerts.sent'), life: 2500 })
    await load()
  } catch (e) {
    // 404: الميزة غير منشورة على الخادم بعد · no_recipients: لا مستلمين · غيرها: خطأ عام.
    if (isBackendMissing(e)) {
      backendUnavailable.value = true
      toast.add({ severity: 'info', summary: t('alerts.pendingTitle'), detail: t('alerts.pendingBody'), life: 5000 })
    } else if (e instanceof ApiException && e.first?.code === 'no_recipients') {
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
          <div v-if="backendUnavailable" class="flex flex-col items-center gap-2 py-10 text-center">
            <span class="grid size-12 place-items-center rounded-2xl bg-primary-50 text-primary-600 dark:bg-primary-500/15 dark:text-primary-300">
              <i class="pi pi-clock !text-2xl" />
            </span>
            <p class="font-medium text-surface-700 dark:text-surface-200">{{ t('alerts.pendingTitle') }}</p>
            <p class="max-w-md text-sm text-surface-500">{{ t('alerts.pendingBody') }}</p>
          </div>
          <p v-else class="py-6 text-center text-sm text-surface-500">{{ t('alerts.empty') }}</p>
        </template>

        <Column field="title" :header="t('alerts.colTitle')" sortable>
          <template #body="{ data }">
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <span class="font-medium text-surface-900 dark:text-white">{{ data.title }}</span>
                <Tag
                  v-if="data.frequency && data.frequency !== 'once'"
                  :value="freqLabel(data.frequency)"
                  severity="warn"
                  icon="pi pi-replay"
                />
              </div>
              <div class="truncate text-xs text-surface-500">{{ data.body }}</div>
            </div>
          </template>
        </Column>
        <Column :header="t('alerts.colTarget')">
          <template #body="{ data }">
            <Tag :value="targetLabel(data)" severity="info" />
          </template>
        </Column>
        <Column :header="t('alerts.colChannels')">
          <template #body="{ data }">
            <div class="flex gap-1.5 text-surface-500">
              <i
                v-for="c in alertChannels(data)"
                :key="c"
                v-tooltip.top="t('alerts.channel.' + c)"
                :class="channelIcon(c)"
                class="text-sm"
              />
            </div>
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
        <Column :header="t('alerts.colAck')">
          <template #body="{ data }">
            <span v-if="data.requires_ack" class="inline-flex items-center gap-1 text-surface-700 dark:text-surface-200">
              <i class="pi pi-check-circle text-xs text-primary-600 dark:text-primary-400" />
              {{ data.ack_count ?? 0 }} / {{ data.recipients_count ?? 0 }}
            </span>
            <span v-else class="text-surface-400">—</span>
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
        <Column class="text-end">
          <template #body="{ data }">
            <div class="flex justify-end gap-1">
              <Button
                v-tooltip.top="t('alerts.details')"
                icon="pi pi-eye"
                severity="secondary"
                text
                rounded
                @click="openDetails(data)"
              />
              <Button
                v-can="'alerts.send'"
                v-tooltip.top="t('alerts.resend')"
                icon="pi pi-replay"
                severity="secondary"
                text
                rounded
                :loading="acting === data.id"
                @click="confirmResend(data)"
              />
              <Button
                v-can="'alerts.send'"
                v-tooltip.top="t('common.delete')"
                icon="pi pi-trash"
                severity="danger"
                text
                rounded
                :loading="acting === data.id"
                @click="confirmDelete(data)"
              />
            </div>
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

        <!-- قنوات الإرسال -->
        <div class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('alerts.channels') }}</span>
          <div class="flex flex-wrap gap-4">
            <label v-for="c in CHANNELS" :key="c" class="flex items-center gap-2">
              <Checkbox v-model="form.channels" :value="c" :input-id="'ch-' + c" />
              <span class="flex items-center gap-1.5 text-surface-700 dark:text-surface-200">
                <i :class="channelIcon(c)" class="text-sm text-surface-500" />{{ t('alerts.channel.' + c) }}
              </span>
            </label>
          </div>
          <span class="mt-1 block text-xs text-surface-500">{{ t('alerts.channelsHint') }}</span>
        </div>

        <!-- التكرار -->
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="block text-sm">
            <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('alerts.frequency') }}</span>
            <Select v-model="form.frequency" :options="frequencyOptions" option-label="label" option-value="value" fluid />
          </label>
          <label v-if="isRecurring" class="block text-sm">
            <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('alerts.repeatUntil') }}</span>
            <input v-model="form.repeat_until" type="date" class="field" />
            <span class="mt-1 block text-xs text-surface-500">{{ t('alerts.repeatUntilHint') }}</span>
          </label>
        </div>

        <div class="flex items-center justify-between gap-3 rounded-xl border border-surface-200 p-3 dark:border-surface-700">
          <div class="min-w-0">
            <div class="text-sm font-medium text-surface-700 dark:text-surface-200">{{ t('alerts.requiresAck') }}</div>
            <div class="text-xs text-surface-500">{{ t('alerts.requiresAckHint') }}</div>
          </div>
          <ToggleSwitch v-model="form.requires_ack" />
        </div>

        <div class="mt-2 flex justify-end gap-2">
          <Button type="button" :label="t('common.cancel')" severity="secondary" text @click="showForm = false" />
          <Button type="submit" :label="saving ? t('common.saving') : t('alerts.send')" icon="pi pi-send" :loading="saving" />
        </div>
      </form>
    </Dialog>

    <!-- تفاصيل التنبيه + المُقِرّون (FE-15) -->
    <Dialog
      v-model:visible="showDetails"
      modal
      :header="detail?.title || t('alerts.details')"
      :style="{ width: '36rem' }"
      :breakpoints="{ '640px': '95vw' }"
    >
      <div v-if="detail" class="space-y-4 pt-1">
        <p class="whitespace-pre-line text-sm text-surface-700 dark:text-surface-200">{{ detail.body }}</p>

        <div class="flex flex-wrap gap-2">
          <Tag :value="targetLabel(detail)" severity="info" />
          <Tag :value="`${t('alerts.colRecipients')}: ${detail.recipients_count ?? 0}`" severity="secondary" />
          <Tag :value="`${t('alerts.colRead')}: ${detail.read_count ?? 0}`" severity="secondary" />
          <Tag v-if="detail.requires_ack" :value="`${t('alerts.colAck')}: ${detail.ack_count ?? 0} / ${detail.recipients_count ?? 0}`" severity="success" />
        </div>

        <!-- قائمة من أقرّ -->
        <div v-if="detail.requires_ack">
          <h3 class="mb-2 text-sm font-semibold text-surface-700 dark:text-surface-200">{{ t('alerts.acknowledgers') }}</h3>
          <p v-if="detailLoading" class="text-sm text-surface-500">{{ t('common.loading') }}</p>
          <ul v-else-if="detail.acknowledgers && detail.acknowledgers.length" class="divide-y divide-surface-100 rounded-xl border border-surface-200 dark:divide-surface-800 dark:border-surface-700">
            <li v-for="a in detail.acknowledgers" :key="a.user_id" class="flex items-center justify-between gap-3 px-3 py-2 text-sm">
              <span class="flex items-center gap-2 text-surface-700 dark:text-surface-200">
                <span class="inline-flex size-7 items-center justify-center rounded-full bg-primary-100 text-xs font-semibold text-primary-700 dark:bg-primary-900 dark:text-primary-200">{{ (a.name || '?').charAt(0) }}</span>
                {{ a.name }}
              </span>
              <span v-if="a.acknowledged_at" class="font-mono text-xs text-surface-500" dir="ltr">{{ a.acknowledged_at.slice(0, 16).replace('T', ' ') }}</span>
            </li>
          </ul>
          <p v-else class="text-sm text-surface-500">{{ t('alerts.noAcks') }}</p>
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
