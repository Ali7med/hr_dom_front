<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ApiException } from '@/api/client'
import { devicesApi, type RebindRequest } from '@/api/devices'

const { t } = useI18n()

const requests = ref<RebindRequest[]>([])
const loading = ref(false)
const error = ref('')
const acting = ref<number | null>(null)

function messageFor(e: unknown, fallback: string): string {
  return e instanceof ApiException ? e.message : fallback
}

const ymd = (date: string) => date.slice(0, 10)

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    requests.value = await devicesApi.rebindRequests()
  } catch (e) {
    error.value = messageFor(e, t('common.loadError'))
  } finally {
    loading.value = false
  }
}

async function approve(r: RebindRequest): Promise<void> {
  if (!window.confirm(t('devices.confirmApprove', { name: r.user?.name ?? `#${r.user_id}` }))) return
  await act(r.id, () => devicesApi.approveRebind(r.id))
}

async function reject(r: RebindRequest): Promise<void> {
  if (!window.confirm(t('devices.confirmReject', { name: r.user?.name ?? `#${r.user_id}` }))) return
  await act(r.id, () => devicesApi.rejectRebind(r.id))
}

async function act(id: number, fn: () => Promise<unknown>): Promise<void> {
  acting.value = id
  error.value = ''
  try {
    await fn()
    await load()
  } catch (e) {
    error.value = messageFor(e, t('common.saveError'))
  } finally {
    acting.value = null
  }
}

onMounted(load)
</script>

<template>
  <div class="mx-auto max-w-4xl">
    <div class="mb-6 flex items-center justify-between gap-4">
      <h1 class="text-2xl font-bold text-slate-900 dark:text-white">{{ t('devices.title') }}</h1>
      <button type="button" class="text-sm text-indigo-600 hover:underline dark:text-indigo-400" @click="load">{{ t('devices.refresh') }}</button>
    </div>

    <p class="mb-4 text-sm text-slate-500">{{ t('devices.subtitle') }}</p>

    <p v-if="error" class="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300" role="alert">{{ error }}</p>

    <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <p v-if="loading" class="p-6 text-sm text-slate-500">{{ t('common.loading') }}</p>
      <p v-else-if="!requests.length" class="p-6 text-sm text-slate-500">{{ t('devices.empty') }}</p>
      <table v-else class="w-full text-start text-sm">
        <thead class="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          <tr>
            <th class="px-4 py-3 text-start">{{ t('devices.employee') }}</th>
            <th class="px-4 py-3 text-start">{{ t('devices.employeeNo') }}</th>
            <th class="px-4 py-3 text-start">{{ t('devices.newDeviceUid') }}</th>
            <th class="px-4 py-3 text-start">{{ t('devices.requestedAt') }}</th>
            <th class="px-4 py-3 text-end">{{ t('companies.actions') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
          <tr v-for="r in requests" :key="r.id">
            <td class="px-4 py-3 font-medium text-slate-900 dark:text-white">{{ r.user?.name ?? '#' + r.user_id }}</td>
            <td class="px-4 py-3 text-slate-500">{{ r.user?.employee_no || '—' }}</td>
            <td class="px-4 py-3 font-mono text-xs text-slate-500" dir="ltr">{{ r.new_device_uid }}</td>
            <td class="px-4 py-3 text-slate-500" dir="ltr">{{ ymd(r.created_at) }}</td>
            <td class="px-4 py-3">
              <div class="flex justify-end gap-3">
                <button
                  v-can="'devices.rebind_approve'"
                  type="button"
                  :disabled="acting === r.id"
                  class="font-medium text-emerald-600 hover:underline disabled:opacity-50 dark:text-emerald-400"
                  @click="approve(r)"
                >
                  {{ t('devices.approve') }}
                </button>
                <button
                  v-can="'devices.rebind_approve'"
                  type="button"
                  :disabled="acting === r.id"
                  class="font-medium text-rose-600 hover:underline disabled:opacity-50 dark:text-rose-400"
                  @click="reject(r)"
                >
                  {{ t('devices.reject') }}
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
