<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
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

const { t } = useI18n()
const auth = useAuthStore()

type Tab = 'requests' | 'types' | 'balances'
const tab = ref<Tab>('requests')

const error = ref('')
const saving = ref(false)
const acting = ref<number | null>(null)

const types = ref<LeaveType[]>([])
const requests = ref<LeaveRequest[]>([])
const users = ref<User[]>([])

function messageFor(e: unknown, fallback: string): string {
  return e instanceof ApiException ? e.message : fallback
}
const ymd = (date: string | null) => (date ? date.slice(0, 10) : '—')
const userName = (id: number) => users.value.find((u) => u.id === id)?.name ?? `#${id}`
const typeName = (id: number) => types.value.find((x) => x.id === id)?.name ?? `#${id}`

const statusClass: Record<LeaveStatus, string> = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-200',
  approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200',
  rejected: 'bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-200',
  auto: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
}

async function loadTypes(): Promise<void> {
  types.value = await leaveTypesApi.list()
}
async function loadUsers(): Promise<void> {
  if (users.value.length) return
  users.value = (await usersApi.list({ per_page: 100 })).data
}

// ===== طلبات الإجازة =====
const statusFilter = ref<'' | LeaveStatus>('')
async function loadRequests(): Promise<void> {
  error.value = ''
  try {
    const params = statusFilter.value ? { status: statusFilter.value } : {}
    requests.value = (await leavesApi.list(params)).data
  } catch (e) {
    error.value = messageFor(e, t('common.loadError'))
  }
}
async function decide(r: LeaveRequest, approve: boolean): Promise<void> {
  const msg = approve ? 'leaves.confirmApprove' : 'leaves.confirmReject'
  if (!window.confirm(t(msg, { name: r.user?.name ?? userName(r.user_id) }))) return
  acting.value = r.id
  error.value = ''
  try {
    if (approve) await leavesApi.approve(r.id)
    else await leavesApi.reject(r.id)
    await loadRequests()
  } catch (e) {
    error.value = messageFor(e, t('common.saveError'))
  } finally {
    acting.value = null
  }
}

const reqForm = reactive({ open: false, user_id: 0, leave_type_id: 0, start_at: '', end_at: '' })
function openRequest(): void {
  reqForm.open = true
  reqForm.user_id = users.value[0]?.id ?? 0
  reqForm.leave_type_id = types.value[0]?.id ?? 0
  reqForm.start_at = ''
  reqForm.end_at = ''
}
async function submitRequest(): Promise<void> {
  saving.value = true
  error.value = ''
  try {
    await leavesApi.create({
      user_id: reqForm.user_id,
      leave_type_id: reqForm.leave_type_id,
      start_at: reqForm.start_at,
      end_at: reqForm.end_at,
      source: 'panel',
    })
    reqForm.open = false
    await loadRequests()
  } catch (e) {
    error.value = messageFor(e, t('common.saveError'))
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
  error.value = ''
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
    await loadTypes()
  } catch (e) {
    error.value = messageFor(e, t('common.saveError'))
  } finally {
    saving.value = false
  }
}
async function removeType(x: LeaveType): Promise<void> {
  if (!window.confirm(t('leaves.confirmDeleteType', { name: x.name }))) return
  error.value = ''
  try {
    await leaveTypesApi.remove(x.id)
    await loadTypes()
  } catch (e) {
    error.value = messageFor(e, t('common.saveError'))
  }
}

// ===== الأرصدة =====
const balanceUserId = ref(0)
const balances = ref<LeaveBalance[]>([])
const balForm = reactive({ balance_type: 'normal' as 'normal' | 'sick', balance_days: 0, mode: 'set' as 'set' | 'increment' })
async function loadBalances(): Promise<void> {
  if (!balanceUserId.value) {
    balances.value = []
    return
  }
  error.value = ''
  try {
    balances.value = await leaveBalancesApi.list(balanceUserId.value)
  } catch (e) {
    error.value = messageFor(e, t('common.loadError'))
  }
}
async function submitBalance(): Promise<void> {
  if (!balanceUserId.value) return
  saving.value = true
  error.value = ''
  try {
    await leaveBalancesApi.upsert(balanceUserId.value, {
      balance_type: balForm.balance_type,
      balance_days: balForm.balance_days,
      mode: balForm.mode,
    })
    await loadBalances()
  } catch (e) {
    error.value = messageFor(e, t('common.saveError'))
  } finally {
    saving.value = false
  }
}

const tabs: { key: Tab; label: string }[] = [
  { key: 'requests', label: 'leaves.tabRequests' },
  { key: 'types', label: 'leaves.tabTypes' },
  { key: 'balances', label: 'leaves.tabBalances' },
]

onMounted(async () => {
  try {
    await Promise.all([loadTypes(), loadUsers(), loadRequests()])
  } catch (e) {
    error.value = messageFor(e, t('common.loadError'))
  }
})
</script>

<template>
  <div class="mx-auto max-w-5xl">
    <h1 class="mb-6 text-2xl font-bold text-slate-900 dark:text-white">{{ t('leaves.title') }}</h1>

    <div class="mb-6 flex gap-1 border-b border-slate-200 dark:border-slate-800">
      <button
        v-for="tb in tabs"
        :key="tb.key"
        type="button"
        class="-mb-px border-b-2 px-4 py-2 text-sm font-medium transition"
        :class="tab === tb.key ? 'border-indigo-600 text-indigo-700 dark:text-indigo-300' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'"
        @click="tab = tb.key"
      >
        {{ t(tb.label) }}
      </button>
    </div>

    <p v-if="error" class="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300" role="alert">{{ error }}</p>

    <!-- ===== الطلبات ===== -->
    <section v-if="tab === 'requests'">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <label class="flex items-center gap-2 text-sm">
          <span class="text-slate-500">{{ t('leaves.status') }}</span>
          <select v-model="statusFilter" class="field w-auto" @change="loadRequests">
            <option value="">{{ t('leaves.allStatuses') }}</option>
            <option value="pending">{{ t('leaveStatus.pending') }}</option>
            <option value="approved">{{ t('leaveStatus.approved') }}</option>
            <option value="rejected">{{ t('leaveStatus.rejected') }}</option>
          </select>
        </label>
        <button v-if="auth.can('leaves.approve')" type="button" class="btn-primary disabled:opacity-60" :disabled="!canCreateRequest" @click="openRequest">{{ t('leaves.newRequest') }}</button>
      </div>

      <form v-if="reqForm.open" class="mb-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900" @submit.prevent="submitRequest">
        <h2 class="font-semibold">{{ t('leaves.newRequest') }}</h2>
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="block text-sm"><span class="lbl">{{ t('leaves.employee') }}</span>
            <select v-model.number="reqForm.user_id" required class="field"><option v-for="u in users" :key="u.id" :value="u.id">{{ u.name }}</option></select>
          </label>
          <label class="block text-sm"><span class="lbl">{{ t('leaves.type') }}</span>
            <select v-model.number="reqForm.leave_type_id" required class="field"><option v-for="x in types" :key="x.id" :value="x.id">{{ x.name }}</option></select>
          </label>
          <label class="block text-sm"><span class="lbl">{{ t('leaves.startAt') }}</span><input v-model="reqForm.start_at" type="date" required class="field" /></label>
          <label class="block text-sm"><span class="lbl">{{ t('leaves.endAt') }}</span><input v-model="reqForm.end_at" type="date" required class="field" /></label>
        </div>
        <div class="flex gap-3">
          <button type="submit" :disabled="saving" class="btn-primary disabled:opacity-60">{{ saving ? t('common.saving') : t('common.save') }}</button>
          <button type="button" class="btn-ghost" @click="reqForm.open = false">{{ t('common.cancel') }}</button>
        </div>
      </form>

      <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <p v-if="!requests.length" class="p-6 text-sm text-slate-500">{{ t('leaves.emptyRequests') }}</p>
        <table v-else class="w-full text-start text-sm">
          <thead class="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            <tr>
              <th class="px-4 py-3 text-start">{{ t('leaves.employee') }}</th>
              <th class="px-4 py-3 text-start">{{ t('leaves.type') }}</th>
              <th class="px-4 py-3 text-start">{{ t('leaves.period') }}</th>
              <th class="px-4 py-3 text-start">{{ t('leaves.status') }}</th>
              <th class="px-4 py-3 text-end">{{ t('companies.actions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            <tr v-for="r in requests" :key="r.id">
              <td class="px-4 py-3 font-medium text-slate-900 dark:text-white">{{ r.user?.name ?? userName(r.user_id) }}</td>
              <td class="px-4 py-3 text-slate-500">{{ r.leave_type?.name ?? typeName(r.leave_type_id) }}</td>
              <td class="px-4 py-3 text-slate-500" dir="ltr">{{ ymd(r.start_at) }} → {{ ymd(r.end_at) }}</td>
              <td class="px-4 py-3"><span class="rounded-full px-2 py-0.5 text-xs" :class="statusClass[r.status]">{{ t('leaveStatus.' + r.status) }}</span></td>
              <td class="px-4 py-3">
                <div v-if="r.status === 'pending'" class="flex justify-end gap-3">
                  <button v-can="'leaves.approve'" type="button" :disabled="acting === r.id" class="font-medium text-emerald-600 hover:underline disabled:opacity-50 dark:text-emerald-400" @click="decide(r, true)">{{ t('leaves.approve') }}</button>
                  <button v-can="'leaves.approve'" type="button" :disabled="acting === r.id" class="font-medium text-rose-600 hover:underline disabled:opacity-50 dark:text-rose-400" @click="decide(r, false)">{{ t('leaves.reject') }}</button>
                </div>
                <span v-else class="flex justify-end text-xs text-slate-400">—</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- ===== الأنواع ===== -->
    <section v-else-if="tab === 'types'">
      <div class="mb-4 flex justify-end">
        <button v-can="'leaves.manage_balances'" type="button" class="btn-primary" @click="openType()">{{ t('leaves.addType') }}</button>
      </div>

      <form v-if="typeForm.open" class="mb-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900" @submit.prevent="submitType">
        <h2 class="font-semibold">{{ typeForm.id === null ? t('leaves.addType') : t('leaves.editType') }}</h2>
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="block text-sm"><span class="lbl">{{ t('leaves.typeName') }}</span><input v-model="typeForm.name" type="text" required maxlength="100" class="field" /></label>
          <label class="block text-sm"><span class="lbl">{{ t('leaves.kind') }}</span>
            <select v-model="typeForm.kind" class="field">
              <option value="hourly">{{ t('leaveKind.hourly') }}</option>
              <option value="daily">{{ t('leaveKind.daily') }}</option>
              <option value="long">{{ t('leaveKind.long') }}</option>
              <option value="sick">{{ t('leaveKind.sick') }}</option>
            </select>
          </label>
          <label class="block text-sm"><span class="lbl">{{ t('leaves.affectsBalance') }}</span>
            <select v-model="typeForm.affects_balance" class="field">
              <option value="normal">{{ t('leaveBalanceType.normal') }}</option>
              <option value="sick">{{ t('leaveBalanceType.sick') }}</option>
              <option value="none">{{ t('leaves.affectsNone') }}</option>
            </select>
          </label>
          <div class="flex items-center gap-6 pt-6">
            <label class="flex items-center gap-2 text-sm"><input v-model="typeForm.needs_approval" type="checkbox" class="size-4" /><span class="font-medium text-slate-700 dark:text-slate-300">{{ t('leaves.needsApproval') }}</span></label>
            <label class="flex items-center gap-2 text-sm"><input v-model="typeForm.is_paid" type="checkbox" class="size-4" /><span class="font-medium text-slate-700 dark:text-slate-300">{{ t('leaves.isPaid') }}</span></label>
          </div>
        </div>
        <div class="flex gap-3">
          <button type="submit" :disabled="saving" class="btn-primary disabled:opacity-60">{{ saving ? t('common.saving') : t('common.save') }}</button>
          <button type="button" class="btn-ghost" @click="typeForm.open = false">{{ t('common.cancel') }}</button>
        </div>
      </form>

      <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <p v-if="!types.length" class="p-6 text-sm text-slate-500">{{ t('leaves.emptyTypes') }}</p>
        <table v-else class="w-full text-start text-sm">
          <thead class="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            <tr>
              <th class="px-4 py-3 text-start">{{ t('leaves.typeName') }}</th>
              <th class="px-4 py-3 text-start">{{ t('leaves.kind') }}</th>
              <th class="px-4 py-3 text-start">{{ t('leaves.needsApproval') }}</th>
              <th class="px-4 py-3 text-start">{{ t('leaves.isPaid') }}</th>
              <th class="px-4 py-3 text-end">{{ t('companies.actions') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            <tr v-for="x in types" :key="x.id">
              <td class="px-4 py-3 font-medium text-slate-900 dark:text-white">{{ x.name }}</td>
              <td class="px-4 py-3 text-slate-500">{{ t('leaveKind.' + x.kind) }}</td>
              <td class="px-4 py-3 text-slate-500">{{ x.needs_approval ? t('common.yes') : t('common.no') }}</td>
              <td class="px-4 py-3 text-slate-500">{{ x.is_paid ? t('common.yes') : t('common.no') }}</td>
              <td class="px-4 py-3">
                <div class="flex justify-end gap-3">
                  <button v-can="'leaves.manage_balances'" type="button" class="text-slate-600 hover:underline dark:text-slate-300" @click="openType(x)">{{ t('common.edit') }}</button>
                  <button v-can="'leaves.manage_balances'" type="button" class="text-rose-600 hover:underline dark:text-rose-400" @click="removeType(x)">{{ t('common.delete') }}</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- ===== الأرصدة ===== -->
    <section v-else>
      <div class="mb-4 max-w-xs">
        <label class="block text-sm"><span class="lbl">{{ t('leaves.employee') }}</span>
          <select v-model.number="balanceUserId" class="field" @change="loadBalances">
            <option :value="0">{{ t('leaves.chooseEmployee') }}</option>
            <option v-for="u in users" :key="u.id" :value="u.id">{{ u.name }}</option>
          </select>
        </label>
      </div>

      <template v-if="balanceUserId">
        <div class="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <p v-if="!balances.length" class="p-6 text-sm text-slate-500">{{ t('leaves.emptyBalances') }}</p>
          <table v-else class="w-full text-start text-sm">
            <thead class="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              <tr>
                <th class="px-4 py-3 text-start">{{ t('leaves.balanceType') }}</th>
                <th class="px-4 py-3 text-start">{{ t('leaves.days') }}</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
              <tr v-for="b in balances" :key="b.id">
                <td class="px-4 py-3 font-medium text-slate-900 dark:text-white">{{ t('leaveBalanceType.' + b.balance_type) }}</td>
                <td class="px-4 py-3 text-slate-500">{{ b.balance_days }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <form v-can="'leaves.manage_balances'" class="space-y-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900" @submit.prevent="submitBalance">
          <h2 class="font-semibold">{{ t('leaves.setBalance') }}</h2>
          <div class="grid gap-4 sm:grid-cols-3">
            <label class="block text-sm"><span class="lbl">{{ t('leaves.balanceType') }}</span>
              <select v-model="balForm.balance_type" class="field">
                <option value="normal">{{ t('leaveBalanceType.normal') }}</option>
                <option value="sick">{{ t('leaveBalanceType.sick') }}</option>
              </select>
            </label>
            <label class="block text-sm"><span class="lbl">{{ t('leaves.days') }}</span><input v-model.number="balForm.balance_days" type="number" min="0" step="0.5" required class="field" /></label>
            <label class="block text-sm"><span class="lbl">{{ t('leaves.mode') }}</span>
              <select v-model="balForm.mode" class="field">
                <option value="set">{{ t('leaves.modeSet') }}</option>
                <option value="increment">{{ t('leaves.modeIncrement') }}</option>
              </select>
            </label>
          </div>
          <button type="submit" :disabled="saving" class="btn-primary disabled:opacity-60">{{ saving ? t('common.saving') : t('common.save') }}</button>
        </form>
      </template>
    </section>
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
.btn-primary {
  border-radius: 0.5rem;
  background: rgb(79 70 229);
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: #fff;
  transition: background 0.15s;
}
.btn-primary:hover {
  background: rgb(67 56 202);
}
.btn-ghost {
  border-radius: 0.5rem;
  padding: 0.5rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: rgb(71 85 105);
}
:global(.dark) .btn-ghost {
  color: rgb(148 163 184);
}
</style>
