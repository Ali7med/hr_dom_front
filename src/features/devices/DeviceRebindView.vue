<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import { ApiException } from '@/api/client'
import { devicesApi, type RebindRequest } from '@/api/devices'
import PageHeader from '@/components/PageHeader.vue'

const { t } = useI18n()
const confirm = useConfirm()
const toast = useToast()

const requests = ref<RebindRequest[]>([])
const loading = ref(false)
const acting = ref<number | null>(null)

function messageFor(e: unknown, fallback: string): string {
  return e instanceof ApiException ? e.message : fallback
}
function notifyError(e: unknown, fallback: string): void {
  toast.add({ severity: 'error', summary: t('common.error'), detail: messageFor(e, fallback), life: 4000 })
}

const ymd = (date: string) => date.slice(0, 10)

async function load(): Promise<void> {
  loading.value = true
  try {
    requests.value = await devicesApi.rebindRequests()
  } catch (e) {
    notifyError(e, t('common.loadError'))
  } finally {
    loading.value = false
  }
}

function approve(r: RebindRequest): void {
  confirm.require({
    message: t('devices.confirmApprove', { name: r.user?.name ?? `#${r.user_id}` }),
    header: t('devices.approve'),
    icon: 'pi pi-check-circle',
    acceptProps: { severity: 'success', label: t('devices.approve') },
    rejectProps: { severity: 'secondary', outlined: true, label: t('common.cancel') },
    accept: () => act(r.id, () => devicesApi.approveRebind(r.id)),
  })
}

function reject(r: RebindRequest): void {
  confirm.require({
    message: t('devices.confirmReject', { name: r.user?.name ?? `#${r.user_id}` }),
    header: t('devices.reject'),
    icon: 'pi pi-exclamation-triangle',
    acceptProps: { severity: 'danger', label: t('devices.reject') },
    rejectProps: { severity: 'secondary', outlined: true, label: t('common.cancel') },
    accept: () => act(r.id, () => devicesApi.rejectRebind(r.id)),
  })
}

async function act(id: number, fn: () => Promise<unknown>): Promise<void> {
  acting.value = id
  try {
    await fn()
    toast.add({ severity: 'success', summary: t('common.saved'), life: 2500 })
    await load()
  } catch (e) {
    notifyError(e, t('common.saveError'))
  } finally {
    acting.value = null
  }
}

onMounted(load)
</script>

<template>
  <div class="mx-auto max-w-4xl">
    <PageHeader :title="t('devices.title')" :subtitle="t('devices.subtitle')">
      <template #actions>
        <Button icon="pi pi-refresh" outlined :label="t('devices.refresh')" @click="load" />
      </template>
    </PageHeader>

    <div class="overflow-hidden rounded-2xl border border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
      <DataTable
        :value="requests"
        :loading="loading"
        paginator
        :rows="10"
        :rows-per-page-options="[10, 20, 50]"
        data-key="id"
        striped-rows
      >
        <template #empty>
          <p class="py-6 text-center text-sm text-surface-500">{{ t('devices.empty') }}</p>
        </template>

        <Column field="user.name" :header="t('devices.employee')">
          <template #body="{ data }">
            <span class="font-medium text-surface-900 dark:text-white">{{ data.user?.name ?? '#' + data.user_id }}</span>
          </template>
        </Column>
        <Column field="user.employee_no" :header="t('devices.employeeNo')">
          <template #body="{ data }">
            <span class="text-surface-500">{{ data.user?.employee_no || '—' }}</span>
          </template>
        </Column>
        <Column field="new_device_uid" :header="t('devices.newDeviceUid')">
          <template #body="{ data }">
            <span class="font-mono text-xs text-surface-500" dir="ltr">{{ data.new_device_uid }}</span>
          </template>
        </Column>
        <Column field="created_at" :header="t('devices.requestedAt')">
          <template #body="{ data }">
            <span class="text-surface-500" dir="ltr">{{ ymd(data.created_at) }}</span>
          </template>
        </Column>
        <Column :header="t('companies.actions')" class="text-end">
          <template #body="{ data }">
            <div class="flex justify-end gap-2">
              <Button
                v-can="'devices.rebind_approve'"
                severity="success"
                :label="t('devices.approve')"
                icon="pi pi-check"
                size="small"
                :disabled="acting === data.id"
                @click="approve(data)"
              />
              <Button
                v-can="'devices.rebind_approve'"
                severity="danger"
                :label="t('devices.reject')"
                icon="pi pi-times"
                size="small"
                :disabled="acting === data.id"
                @click="reject(data)"
              />
            </div>
          </template>
        </Column>
      </DataTable>
    </div>
  </div>
</template>
