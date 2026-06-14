<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import Dialog from '@/components/AppDialog.vue'
import PageHeader from '@/components/PageHeader.vue'
import { ApiException } from '@/api/client'
import { delegationsApi, type ApprovalDelegation, type DelegationScope } from '@/api/delegations'
import { usersApi, type User } from '@/api/users'

const { t } = useI18n()
const confirm = useConfirm()
const toast = useToast()

function messageFor(e: unknown, fallback: string): string {
  return e instanceof ApiException ? e.message : fallback
}
function notifyError(e: unknown, fallback: string): void {
  toast.add({ severity: 'error', summary: t('common.error'), detail: messageFor(e, fallback), life: 4000 })
}

const ymd = (d?: string | null) => (d ? d.slice(0, 10) : '—')

const scopeOptions: { value: DelegationScope; key: string }[] = [
  { value: 'all', key: 'delegations.scopeAll' },
  { value: 'leaves', key: 'delegations.scopeLeaves' },
  { value: 'excuses', key: 'delegations.scopeExcuses' },
  { value: 'overtime', key: 'delegations.scopeOvertime' },
]
const scopeLabel = (s: DelegationScope) => t(scopeOptions.find((o) => o.value === s)?.key ?? 'delegations.scopeAll')

// نشط = تاريخ اليوم ضمن [from_date, to_date].
function isActive(d: ApprovalDelegation): boolean {
  const today = new Date().toISOString().slice(0, 10)
  return ymd(d.from_date) <= today && today <= ymd(d.to_date)
}

const users = ref<User[]>([])
const rows = ref<ApprovalDelegation[]>([])
const loading = ref(false)

const fromName = (d: ApprovalDelegation) => d.from_user?.name ?? users.value.find((u) => u.id === d.from_user_id)?.name ?? `#${d.from_user_id}`
const toName = (d: ApprovalDelegation) => d.to_user?.name ?? users.value.find((u) => u.id === d.to_user_id)?.name ?? `#${d.to_user_id}`

async function load(): Promise<void> {
  loading.value = true
  try {
    rows.value = await delegationsApi.list()
  } catch (e) {
    notifyError(e, t('common.loadError'))
  } finally {
    loading.value = false
  }
}

// ===== إنشاء تفويض =====
const form = reactive({
  open: false,
  to_user_id: 0,
  scope: 'all' as DelegationScope,
  from_date: '',
  to_date: '',
})
const saving = ref(false)
function openForm(): void {
  form.open = true
  form.to_user_id = users.value[0]?.id ?? 0
  form.scope = 'all'
  form.from_date = ''
  form.to_date = ''
}
async function submit(): Promise<void> {
  if (!form.to_user_id || !form.from_date || !form.to_date) return
  if (form.to_date < form.from_date) {
    toast.add({ severity: 'warn', summary: t('common.error'), detail: t('delegations.endAfterStart'), life: 4000 })
    return
  }
  saving.value = true
  try {
    await delegationsApi.create({
      to_user_id: form.to_user_id,
      scope: form.scope,
      from_date: form.from_date,
      to_date: form.to_date,
    })
    form.open = false
    toast.add({ severity: 'success', summary: t('delegations.created'), life: 2500 })
    await load()
  } catch (e) {
    notifyError(e, t('common.saveError'))
  } finally {
    saving.value = false
  }
}

function remove(d: ApprovalDelegation): void {
  confirm.require({
    message: t('delegations.confirmDelete', { name: toName(d) }),
    header: t('delegations.cancelDelegation'),
    icon: 'pi pi-exclamation-triangle',
    acceptProps: { severity: 'danger', label: t('delegations.cancelDelegation') },
    rejectProps: { severity: 'secondary', outlined: true, label: t('common.cancel') },
    accept: async () => {
      try {
        await delegationsApi.remove(d.id)
        toast.add({ severity: 'success', summary: t('delegations.revoked'), life: 2500 })
        await load()
      } catch (e) {
        notifyError(e, t('common.saveError'))
      }
    },
  })
}

onMounted(async () => {
  try {
    const us = await usersApi.list({ per_page: 100 })
    users.value = us.data
  } catch {
    // قائمة الموظفين اختيارية.
  }
  await load()
})
</script>

<template>
  <div class="mx-auto max-w-5xl">
    <PageHeader :title="t('delegations.title')" :subtitle="t('delegations.subtitle')">
      <template #actions>
        <Button icon="pi pi-plus" :label="t('delegations.create')" @click="openForm" />
      </template>
    </PageHeader>

    <div class="overflow-hidden rounded-2xl border border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
      <DataTable :value="rows" :loading="loading" paginator :rows="15" :rows-per-page-options="[15, 30, 50]" data-key="id" striped-rows>
        <template #empty>
          <p class="py-6 text-center text-sm text-surface-500">{{ t('delegations.empty') }}</p>
        </template>

        <Column :header="t('delegations.from')">
          <template #body="{ data }"><span class="font-medium text-surface-900 dark:text-white">{{ fromName(data) }}</span></template>
        </Column>
        <Column :header="t('delegations.to')">
          <template #body="{ data }"><span class="text-surface-700 dark:text-surface-200">{{ toName(data) }}</span></template>
        </Column>
        <Column :header="t('delegations.scope')">
          <template #body="{ data }"><Tag :value="scopeLabel(data.scope)" severity="info" /></template>
        </Column>
        <Column :header="t('delegations.period')">
          <template #body="{ data }"><span class="text-surface-500" dir="ltr">{{ ymd(data.from_date) }} → {{ ymd(data.to_date) }}</span></template>
        </Column>
        <Column :header="t('delegations.state')">
          <template #body="{ data }">
            <Tag :value="isActive(data) ? t('delegations.active') : t('delegations.inactive')" :severity="isActive(data) ? 'success' : 'secondary'" />
          </template>
        </Column>
        <Column :header="t('companies.actions')" class="text-end">
          <template #body="{ data }">
            <Button
              v-tooltip.top="t('delegations.cancelDelegation')"
              icon="pi pi-trash"
              severity="danger"
              text
              rounded
              @click="remove(data)"
            />
          </template>
        </Column>
      </DataTable>
    </div>

    <!-- إنشاء تفويض -->
    <Dialog
      v-model:visible="form.open"
      modal
      :header="t('delegations.create')"
      :style="{ width: '34rem' }"
      :breakpoints="{ '640px': '95vw' }"
    >
      <form class="grid gap-4 pt-2 sm:grid-cols-2" @submit.prevent="submit">
        <label class="block text-sm sm:col-span-2">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('delegations.delegate') }}</span>
          <Select v-model.number="form.to_user_id" :options="users" option-label="name" option-value="id" filter fluid />
          <span class="mt-1 block text-xs text-surface-500">{{ t('delegations.delegateHint') }}</span>
        </label>
        <label class="block text-sm sm:col-span-2">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('delegations.scope') }}</span>
          <Select v-model="form.scope" :options="scopeOptions" option-value="value" fluid>
            <template #value="{ value }">{{ scopeLabel(value) }}</template>
            <template #option="{ option }">{{ t(option.key) }}</template>
          </Select>
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('delegations.fromDate') }}</span>
          <input v-model="form.from_date" type="date" required class="field" />
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('delegations.toDate') }}</span>
          <input v-model="form.to_date" type="date" required class="field" />
        </label>
        <div class="mt-2 flex justify-end gap-2 sm:col-span-2">
          <Button type="button" :label="t('common.cancel')" severity="secondary" text @click="form.open = false" />
          <Button type="submit" :label="saving ? t('common.saving') : t('common.save')" icon="pi pi-check" :loading="saving" :disabled="!form.to_user_id || !form.from_date || !form.to_date" />
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
