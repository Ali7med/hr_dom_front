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
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import DatePicker from 'primevue/datepicker'
import Checkbox from 'primevue/checkbox'
import Tag from 'primevue/tag'
import { ApiException } from '@/api/client'
import {
  leaveTypesApi,
  leavesApi,
  leaveBalancesApi,
  type LeaveType,
  type LeaveRequest,
  type LeaveBalance,
  type LeaveStatus,
} from '@/api/leaves'
import { usersApi, type User } from '@/api/users'
import { useAuthStore } from '@/stores/auth'
import PageHeader from '@/components/PageHeader.vue'

const { t } = useI18n()
const auth = useAuthStore()
const confirm = useConfirm()
const toast = useToast()

type Tab = 'requests' | 'types' | 'balances'
const tab = ref<Tab>('requests')

const saving = ref(false)
const acting = ref<number | null>(null)
const loadingRequests = ref(false)
const loadingTypes = ref(false)
const loadingBalances = ref(false)

const types = ref<LeaveType[]>([])
const requests = ref<LeaveRequest[]>([])
const users = ref<User[]>([])

function messageFor(e: unknown, fallback: string): string {
  return e instanceof ApiException ? e.message : fallback
}
function notifyError(e: unknown, fallback: string): void {
  toast.add({ severity: 'error', summary: t('common.error'), detail: messageFor(e, fallback), life: 4000 })
}
const ymd = (date: string | null) => (date ? date.slice(0, 10) : '—')
const userName = (id: number) => users.value.find((u) => u.id === id)?.name ?? `#${id}`
const typeName = (id: number) => types.value.find((x) => x.id === id)?.name ?? `#${id}`

const statusSeverity: Record<LeaveStatus, 'warn' | 'success' | 'danger' | 'secondary'> = {
  pending: 'warn',
  approved: 'success',
  rejected: 'danger',
  auto: 'secondary',
}

async function loadTypes(): Promise<void> {
  loadingTypes.value = true
  try {
    types.value = await leaveTypesApi.list()
  } finally {
    loadingTypes.value = false
  }
}
async function loadUsers(): Promise<void> {
  if (users.value.length) return
  users.value = (await usersApi.list({ per_page: 100 })).data
}

// ===== طلبات الإجازة =====
const statusFilter = ref<'' | LeaveStatus>('')
const statusOptions = computed(() => [
  { label: t('leaves.allStatuses'), value: '' },
  { label: t('leaveStatus.pending'), value: 'pending' },
  { label: t('leaveStatus.approved'), value: 'approved' },
  { label: t('leaveStatus.rejected'), value: 'rejected' },
])
async function loadRequests(): Promise<void> {
  loadingRequests.value = true
  try {
    const params = statusFilter.value ? { status: statusFilter.value } : {}
    requests.value = (await leavesApi.list(params)).data
  } catch (e) {
    notifyError(e, t('common.loadError'))
  } finally {
    loadingRequests.value = false
  }
}
async function decide(r: LeaveRequest, approve: boolean): Promise<void> {
  const msg = approve ? 'leaves.confirmApprove' : 'leaves.confirmReject'
  confirm.require({
    message: t(msg, { name: r.user?.name ?? userName(r.user_id) }),
    header: approve ? t('leaves.approve') : t('leaves.reject'),
    icon: 'pi pi-exclamation-triangle',
    rejectProps: { severity: 'secondary', outlined: true, label: t('common.cancel') },
    acceptProps: approve
      ? { severity: 'success', label: t('leaves.approve') }
      : { severity: 'danger', label: t('leaves.reject') },
    accept: async () => {
      acting.value = r.id
      try {
        if (approve) await leavesApi.approve(r.id)
        else await leavesApi.reject(r.id)
        toast.add({ severity: 'success', summary: t('common.saved'), life: 2500 })
        await loadRequests()
      } catch (e) {
        notifyError(e, t('common.saveError'))
      } finally {
        acting.value = null
      }
    },
  })
}

const reqForm = reactive({ open: false, user_id: 0, leave_type_id: 0, start_at: '', end_at: '' })
const reqStartDate = computed({
  get: () => (reqForm.start_at ? new Date(reqForm.start_at) : null),
  set: (d: Date | null) => {
    reqForm.start_at = d ? toYmd(d) : ''
  },
})
const reqEndDate = computed({
  get: () => (reqForm.end_at ? new Date(reqForm.end_at) : null),
  set: (d: Date | null) => {
    reqForm.end_at = d ? toYmd(d) : ''
  },
})
function toYmd(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function openRequest(): void {
  reqForm.open = true
  reqForm.user_id = users.value[0]?.id ?? 0
  reqForm.leave_type_id = types.value[0]?.id ?? 0
  reqForm.start_at = ''
  reqForm.end_at = ''
}
async function submitRequest(): Promise<void> {
  saving.value = true
  try {
    await leavesApi.create({
      user_id: reqForm.user_id,
      leave_type_id: reqForm.leave_type_id,
      start_at: reqForm.start_at,
      end_at: reqForm.end_at,
      source: 'panel',
    })
    reqForm.open = false
    toast.add({ severity: 'success', summary: t('common.saved'), life: 2500 })
    await loadRequests()
  } catch (e) {
    notifyError(e, t('common.saveError'))
  } finally {
    saving.value = false
  }
}
const canCreateRequest = computed(() => users.value.length > 0 && types.value.length > 0)

// ===== أنواع الإجازات =====
const typeForm = reactive({
  open: false,
  id: null as number | null,
  name: '',
  kind: 'daily' as LeaveType['kind'],
  needs_approval: true,
  affects_balance: 'normal' as NonNullable<LeaveType['affects_balance']>,
  is_paid: true,
})
const kindOptions = computed(() => [
  { label: t('leaveKind.hourly'), value: 'hourly' },
  { label: t('leaveKind.daily'), value: 'daily' },
  { label: t('leaveKind.long'), value: 'long' },
  { label: t('leaveKind.sick'), value: 'sick' },
])
const affectsBalanceOptions = computed(() => [
  { label: t('leaveBalanceType.normal'), value: 'normal' },
  { label: t('leaveBalanceType.sick'), value: 'sick' },
  { label: t('leaves.affectsNone'), value: 'none' },
])
function openType(x?: LeaveType): void {
  typeForm.open = true
  typeForm.id = x?.id ?? null
  typeForm.name = x?.name ?? ''
  typeForm.kind = x?.kind ?? 'daily'
  typeForm.needs_approval = x?.needs_approval ?? true
  typeForm.affects_balance = x?.affects_balance ?? 'normal'
  typeForm.is_paid = x?.is_paid ?? true
}
async function submitType(): Promise<void> {
  saving.value = true
  try {
    const payload = {
      name: typeForm.name,
      kind: typeForm.kind,
      needs_approval: typeForm.needs_approval,
      affects_balance: typeForm.affects_balance,
      is_paid: typeForm.is_paid,
    }
    if (typeForm.id === null) await leaveTypesApi.create(payload)
    else await leaveTypesApi.update(typeForm.id, payload)
    typeForm.open = false
    toast.add({ severity: 'success', summary: t('common.saved'), life: 2500 })
    await loadTypes()
  } catch (e) {
    notifyError(e, t('common.saveError'))
  } finally {
    saving.value = false
  }
}
async function removeType(x: LeaveType): Promise<void> {
  confirm.require({
    message: t('leaves.confirmDeleteType', { name: x.name }),
    header: t('common.delete'),
    icon: 'pi pi-exclamation-triangle',
    rejectProps: { severity: 'secondary', outlined: true, label: t('common.cancel') },
    acceptProps: { severity: 'danger', label: t('common.delete') },
    accept: async () => {
      try {
        await leaveTypesApi.remove(x.id)
        toast.add({ severity: 'success', summary: t('common.deleted'), life: 2500 })
        await loadTypes()
      } catch (e) {
        notifyError(e, t('common.saveError'))
      }
    },
  })
}

// ===== الأرصدة =====
const balanceUserId = ref(0)
const balances = ref<LeaveBalance[]>([])
const balForm = reactive({ balance_type: 'normal' as 'normal' | 'sick', balance_days: 0, mode: 'set' as 'set' | 'increment' })
const balanceUserOptions = computed(() => [
  { label: t('leaves.chooseEmployee'), value: 0 },
  ...users.value.map((u) => ({ label: u.name, value: u.id })),
])
const balanceTypeOptions = computed(() => [
  { label: t('leaveBalanceType.normal'), value: 'normal' },
  { label: t('leaveBalanceType.sick'), value: 'sick' },
])
const modeOptions = computed(() => [
  { label: t('leaves.modeSet'), value: 'set' },
  { label: t('leaves.modeIncrement'), value: 'increment' },
])
async function loadBalances(): Promise<void> {
  if (!balanceUserId.value) {
    balances.value = []
    return
  }
  loadingBalances.value = true
  try {
    balances.value = await leaveBalancesApi.list(balanceUserId.value)
  } catch (e) {
    notifyError(e, t('common.loadError'))
  } finally {
    loadingBalances.value = false
  }
}
async function submitBalance(): Promise<void> {
  if (!balanceUserId.value) return
  saving.value = true
  try {
    await leaveBalancesApi.upsert(balanceUserId.value, {
      balance_type: balForm.balance_type,
      balance_days: balForm.balance_days,
      mode: balForm.mode,
    })
    toast.add({ severity: 'success', summary: t('common.saved'), life: 2500 })
    await loadBalances()
  } catch (e) {
    notifyError(e, t('common.saveError'))
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  try {
    await Promise.all([loadTypes(), loadUsers(), loadRequests()])
  } catch (e) {
    notifyError(e, t('common.loadError'))
  }
})
</script>

<template>
  <div class="mx-auto max-w-5xl">
    <PageHeader :title="t('leaves.title')" />

    <Tabs :value="tab" @update:value="(v) => (tab = v as Tab)">
      <TabList>
        <Tab value="requests">{{ t('leaves.tabRequests') }}</Tab>
        <Tab value="types">{{ t('leaves.tabTypes') }}</Tab>
        <Tab value="balances">{{ t('leaves.tabBalances') }}</Tab>
      </TabList>
      <TabPanels>
        <!-- ===== الطلبات ===== -->
        <TabPanel value="requests">
          <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
            <label class="flex items-center gap-2 text-sm">
              <span class="text-surface-500">{{ t('leaves.status') }}</span>
              <Select
                v-model="statusFilter"
                :options="statusOptions"
                option-label="label"
                option-value="value"
                @change="loadRequests"
              />
            </label>
            <Button
              v-if="auth.can('leaves.approve')"
              :label="t('leaves.newRequest')"
              icon="pi pi-plus"
              :disabled="!canCreateRequest"
              @click="openRequest"
            />
          </div>

          <div class="overflow-hidden rounded-2xl border border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
            <DataTable
              :value="requests"
              :loading="loadingRequests"
              paginator
              :rows="10"
              :rows-per-page-options="[10, 20, 50]"
              data-key="id"
              striped-rows
              removable-sort
            >
              <template #empty>
                <p class="py-6 text-center text-sm text-surface-500">{{ t('leaves.emptyRequests') }}</p>
              </template>

              <Column :header="t('leaves.employee')" sortable>
                <template #body="{ data }">
                  <span class="font-medium text-surface-900 dark:text-white">{{ data.user?.name ?? userName(data.user_id) }}</span>
                </template>
              </Column>
              <Column :header="t('leaves.type')">
                <template #body="{ data }">
                  <span class="text-surface-500">{{ data.leave_type?.name ?? typeName(data.leave_type_id) }}</span>
                </template>
              </Column>
              <Column :header="t('leaves.period')">
                <template #body="{ data }">
                  <span class="text-surface-500" dir="ltr">{{ ymd(data.start_at) }} → {{ ymd(data.end_at) }}</span>
                </template>
              </Column>
              <Column :header="t('leaves.status')">
                <template #body="{ data }">
                  <Tag :value="t('leaveStatus.' + data.status)" :severity="statusSeverity[data.status as LeaveStatus]" />
                </template>
              </Column>
              <Column :header="t('companies.actions')" class="text-end">
                <template #body="{ data }">
                  <div v-if="data.status === 'pending'" class="flex justify-end gap-1">
                    <Button
                      v-can="'leaves.approve'"
                      v-tooltip.top="t('leaves.approve')"
                      icon="pi pi-check"
                      severity="success"
                      text
                      rounded
                      :disabled="acting === data.id"
                      @click="decide(data, true)"
                    />
                    <Button
                      v-can="'leaves.approve'"
                      v-tooltip.top="t('leaves.reject')"
                      icon="pi pi-times"
                      severity="danger"
                      text
                      rounded
                      :disabled="acting === data.id"
                      @click="decide(data, false)"
                    />
                  </div>
                  <span v-else class="flex justify-end text-xs text-surface-400">—</span>
                </template>
              </Column>
            </DataTable>
          </div>
        </TabPanel>

        <!-- ===== الأنواع ===== -->
        <TabPanel value="types">
          <div class="mb-4 flex justify-end">
            <Button v-can="'leave_types.create'" :label="t('leaves.addType')" icon="pi pi-plus" @click="openType()" />
          </div>

          <div class="overflow-hidden rounded-2xl border border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
            <DataTable
              :value="types"
              :loading="loadingTypes"
              paginator
              :rows="10"
              :rows-per-page-options="[10, 20, 50]"
              data-key="id"
              striped-rows
              removable-sort
            >
              <template #empty>
                <p class="py-6 text-center text-sm text-surface-500">{{ t('leaves.emptyTypes') }}</p>
              </template>

              <Column field="name" :header="t('leaves.typeName')" sortable>
                <template #body="{ data }">
                  <span class="font-medium text-surface-900 dark:text-white">{{ data.name }}</span>
                </template>
              </Column>
              <Column :header="t('leaves.kind')">
                <template #body="{ data }">
                  <span class="text-surface-500">{{ t('leaveKind.' + data.kind) }}</span>
                </template>
              </Column>
              <Column :header="t('leaves.needsApproval')">
                <template #body="{ data }">
                  <span class="text-surface-500">{{ data.needs_approval ? t('common.yes') : t('common.no') }}</span>
                </template>
              </Column>
              <Column :header="t('leaves.isPaid')">
                <template #body="{ data }">
                  <span class="text-surface-500">{{ data.is_paid ? t('common.yes') : t('common.no') }}</span>
                </template>
              </Column>
              <Column :header="t('companies.actions')" class="text-end">
                <template #body="{ data }">
                  <div class="flex justify-end gap-1">
                    <Button
                      v-can="'leave_types.update'"
                      v-tooltip.top="t('common.edit')"
                      icon="pi pi-pencil"
                      severity="secondary"
                      text
                      rounded
                      @click="openType(data)"
                    />
                    <Button
                      v-can="'leave_types.delete'"
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
        </TabPanel>

        <!-- ===== الأرصدة ===== -->
        <TabPanel value="balances">
          <div class="mb-4 max-w-xs">
            <label class="block text-sm">
              <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('leaves.employee') }}</span>
              <Select
                v-model="balanceUserId"
                :options="balanceUserOptions"
                option-label="label"
                option-value="value"
                fluid
                @change="loadBalances"
              />
            </label>
          </div>

          <template v-if="balanceUserId">
            <div class="mb-6 overflow-hidden rounded-2xl border border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
              <DataTable
                :value="balances"
                :loading="loadingBalances"
                paginator
                :rows="10"
                :rows-per-page-options="[10, 20, 50]"
                data-key="id"
                striped-rows
                removable-sort
              >
                <template #empty>
                  <p class="py-6 text-center text-sm text-surface-500">{{ t('leaves.emptyBalances') }}</p>
                </template>

                <Column :header="t('leaves.balanceType')">
                  <template #body="{ data }">
                    <span class="font-medium text-surface-900 dark:text-white">{{ t('leaveBalanceType.' + data.balance_type) }}</span>
                  </template>
                </Column>
                <Column field="balance_days" :header="t('leaves.days')" sortable>
                  <template #body="{ data }">
                    <span class="text-surface-500">{{ data.balance_days }}</span>
                  </template>
                </Column>
              </DataTable>
            </div>

            <form
              v-can="'leaves.manage_balances'"
              class="space-y-4 rounded-2xl border border-surface-200 bg-white p-6 dark:border-surface-800 dark:bg-surface-900"
              @submit.prevent="submitBalance"
            >
              <h2 class="font-semibold">{{ t('leaves.setBalance') }}</h2>
              <div class="grid gap-4 sm:grid-cols-3">
                <label class="block text-sm">
                  <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('leaves.balanceType') }}</span>
                  <Select v-model="balForm.balance_type" :options="balanceTypeOptions" option-label="label" option-value="value" fluid />
                </label>
                <label class="block text-sm">
                  <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('leaves.days') }}</span>
                  <InputNumber v-model="balForm.balance_days" :min="0" :step="0.5" :min-fraction-digits="0" :max-fraction-digits="2" show-buttons fluid />
                </label>
                <label class="block text-sm">
                  <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('leaves.mode') }}</span>
                  <Select v-model="balForm.mode" :options="modeOptions" option-label="label" option-value="value" fluid />
                </label>
              </div>
              <Button type="submit" :label="saving ? t('common.saving') : t('common.save')" icon="pi pi-check" :loading="saving" />
            </form>
          </template>
        </TabPanel>
      </TabPanels>
    </Tabs>

    <!-- نموذج طلب الإجازة بالنيابة -->
    <Dialog
      v-model:visible="reqForm.open"
      modal
      :header="t('leaves.newRequest')"
      :style="{ width: '32rem' }"
      :breakpoints="{ '640px': '95vw' }"
    >
      <form class="grid gap-4 pt-2 sm:grid-cols-2" @submit.prevent="submitRequest">
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('leaves.employee') }}</span>
          <Select v-model="reqForm.user_id" :options="users" option-label="name" option-value="id" required fluid />
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('leaves.type') }}</span>
          <Select v-model="reqForm.leave_type_id" :options="types" option-label="name" option-value="id" required fluid />
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('leaves.startAt') }}</span>
          <DatePicker v-model="reqStartDate" date-format="yy-mm-dd" show-icon fluid />
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('leaves.endAt') }}</span>
          <DatePicker v-model="reqEndDate" date-format="yy-mm-dd" show-icon fluid />
        </label>

        <div class="mt-2 flex justify-end gap-2 sm:col-span-2">
          <Button type="button" :label="t('common.cancel')" severity="secondary" text @click="reqForm.open = false" />
          <Button type="submit" :label="saving ? t('common.saving') : t('common.save')" icon="pi pi-check" :loading="saving" />
        </div>
      </form>
    </Dialog>

    <!-- نموذج إنشاء/تعديل نوع الإجازة -->
    <Dialog
      v-model:visible="typeForm.open"
      modal
      :header="typeForm.id === null ? t('leaves.addType') : t('leaves.editType')"
      :style="{ width: '32rem' }"
      :breakpoints="{ '640px': '95vw' }"
    >
      <form class="grid gap-4 pt-2 sm:grid-cols-2" @submit.prevent="submitType">
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('leaves.typeName') }}</span>
          <InputText v-model="typeForm.name" required maxlength="100" fluid />
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('leaves.kind') }}</span>
          <Select v-model="typeForm.kind" :options="kindOptions" option-label="label" option-value="value" fluid />
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('leaves.affectsBalance') }}</span>
          <Select v-model="typeForm.affects_balance" :options="affectsBalanceOptions" option-label="label" option-value="value" fluid />
        </label>
        <div class="flex items-center gap-6 pt-6">
          <label class="flex items-center gap-2 text-sm">
            <Checkbox v-model="typeForm.needs_approval" binary />
            <span class="font-medium text-surface-700 dark:text-surface-300">{{ t('leaves.needsApproval') }}</span>
          </label>
          <label class="flex items-center gap-2 text-sm">
            <Checkbox v-model="typeForm.is_paid" binary />
            <span class="font-medium text-surface-700 dark:text-surface-300">{{ t('leaves.isPaid') }}</span>
          </label>
        </div>

        <div class="mt-2 flex justify-end gap-2 sm:col-span-2">
          <Button type="button" :label="t('common.cancel')" severity="secondary" text @click="typeForm.open = false" />
          <Button type="submit" :label="saving ? t('common.saving') : t('common.save')" icon="pi pi-check" :loading="saving" />
        </div>
      </form>
    </Dialog>
  </div>
</template>
