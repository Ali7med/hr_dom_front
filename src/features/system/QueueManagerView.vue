<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import { useConfirm } from 'primevue/useconfirm'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import Message from 'primevue/message'
import PageHeader from '@/components/PageHeader.vue'
import { ApiException } from '@/api/client'
import { queueApi, type QueueStatus, type FailedJob } from '@/api/queue'

const { t } = useI18n()
const toast = useToast()
const confirm = useConfirm()

const status = ref<QueueStatus | null>(null)
const failed = ref<FailedJob[]>([])
const loading = ref(false)
const acting = ref('') // 'start'|'stop'|'restart'|'retry-all'|'flush'|`row:<id>`
const unavailable = ref(false) // 403/404 → رسالة (الصلاحية أو الميزة غير منشورة)

let timer: ReturnType<typeof setInterval> | null = null

function notifyError(e: unknown, fallback: string): void {
  const msg = e instanceof ApiException ? e.message : fallback
  toast.add({ severity: 'error', summary: t('common.error'), detail: msg, life: 4000 })
}

const running = computed(() => status.value?.running === true)
const ymd = (d?: string | null) => (d ? d.slice(0, 19).replace('T', ' ') : '—')

const counters = computed(() => [
  { key: 'pending', value: status.value?.pending_jobs, icon: 'pi pi-hourglass', cls: 'text-amber-600 dark:text-amber-400' },
  { key: 'reserved', value: status.value?.reserved_jobs, icon: 'pi pi-spin pi-cog', cls: 'text-indigo-600 dark:text-indigo-400' },
  { key: 'failed', value: status.value?.failed_jobs, icon: 'pi pi-times-circle', cls: 'text-red-600 dark:text-red-400' },
])

async function refresh(silent = false): Promise<void> {
  if (!silent) loading.value = true
  try {
    status.value = await queueApi.status()
    unavailable.value = false
    if ((status.value.failed_jobs ?? 0) > 0 || failed.value.length) {
      failed.value = (await queueApi.failed({ per_page: 50 })).data
    } else {
      failed.value = []
    }
  } catch (e) {
    if (e instanceof ApiException && (e.status === 403 || e.status === 404)) unavailable.value = true
    else if (!silent) notifyError(e, t('common.loadError'))
  } finally {
    loading.value = false
  }
}

async function control(action: 'start' | 'stop' | 'restart', force = false): Promise<void> {
  acting.value = action
  try {
    if (action === 'start') status.value = await queueApi.start(force)
    else if (action === 'stop') status.value = await queueApi.stop()
    else status.value = await queueApi.restart()
    toast.add({ severity: 'success', summary: t('queue.action.' + action + 'Done'), life: 2500 })
    await refresh(true)
  } catch (e) {
    // 409: يعمل أصلاً → اعرض تأكيد التشغيل القسري.
    if (action === 'start' && e instanceof ApiException && e.status === 409) {
      confirm.require({
        message: t('queue.forceStartHint'),
        header: t('queue.action.start'),
        icon: 'pi pi-exclamation-triangle',
        acceptProps: { label: t('queue.forceStart') },
        rejectProps: { severity: 'secondary', outlined: true, label: t('common.cancel') },
        accept: () => void control('start', true),
      })
    } else {
      notifyError(e, t('common.saveError'))
    }
  } finally {
    acting.value = ''
  }
}

function rowAction(job: FailedJob, kind: 'retry' | 'forget'): void {
  const id = job.id ?? job.uuid
  acting.value = 'row:' + id
  const run = async () => {
    try {
      if (kind === 'retry') await queueApi.retry(id)
      else await queueApi.forget(id)
      toast.add({ severity: 'success', summary: t('queue.' + (kind === 'retry' ? 'retried' : 'forgotten')), life: 2000 })
      await refresh(true)
    } catch (e) {
      notifyError(e, t('common.saveError'))
    } finally {
      acting.value = ''
    }
  }
  void run()
}

function bulk(kind: 'retry-all' | 'flush'): void {
  confirm.require({
    message: t('queue.confirm.' + (kind === 'retry-all' ? 'retryAll' : 'flush')),
    header: t('queue.' + (kind === 'retry-all' ? 'retryAll' : 'flush')),
    icon: 'pi pi-exclamation-triangle',
    acceptProps: { severity: kind === 'flush' ? 'danger' : undefined, label: t('queue.' + (kind === 'retry-all' ? 'retryAll' : 'flush')) },
    rejectProps: { severity: 'secondary', outlined: true, label: t('common.cancel') },
    accept: async () => {
      acting.value = kind
      try {
        if (kind === 'retry-all') await queueApi.retryAll()
        else await queueApi.flush()
        toast.add({ severity: 'success', summary: t('common.saved'), life: 2000 })
        await refresh(true)
      } catch (e) {
        notifyError(e, t('common.saveError'))
      } finally {
        acting.value = ''
      }
    },
  })
}

onMounted(() => {
  void refresh()
  timer = setInterval(() => void refresh(true), 5000) // استطلاع دوري ~5ث.
})
onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <div class="mx-auto max-w-4xl">
    <PageHeader :title="t('queue.title')" :subtitle="t('queue.subtitle')">
      <template #actions>
        <Button icon="pi pi-refresh" severity="secondary" outlined :label="t('common.search')" :loading="loading" @click="refresh()" />
      </template>
    </PageHeader>

    <Message v-if="unavailable" severity="info" :closable="false">{{ t('queue.unavailable') }}</Message>

    <template v-else>
      <!-- بطاقة الحالة + أزرار التحكّم -->
      <div class="mb-5 rounded-2xl border border-surface-200 bg-white p-5 dark:border-surface-800 dark:bg-surface-900">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <span
              class="grid size-12 place-items-center rounded-2xl"
              :class="running ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400' : 'bg-surface-100 text-surface-400 dark:bg-surface-800'"
            >
              <i class="pi text-xl" :class="running ? 'pi-bolt' : 'pi-power-off'" />
            </span>
            <div>
              <Tag :value="running ? t('queue.running') : t('queue.stopped')" :severity="running ? 'success' : 'secondary'" />
              <p class="mt-1 text-xs text-surface-500">
                {{ t('queue.driver') }}: <span dir="ltr">{{ status?.driver ?? '—' }}</span>
                · {{ t('queue.connection') }}: <span dir="ltr">{{ status?.queue_connection ?? '—' }}</span>
              </p>
            </div>
          </div>
          <div class="flex flex-wrap gap-2">
            <Button :label="t('queue.action.start')" icon="pi pi-play" :disabled="running || acting !== ''" :loading="acting === 'start'" @click="control('start')" />
            <Button :label="t('queue.action.restart')" icon="pi pi-replay" severity="secondary" :disabled="acting !== ''" :loading="acting === 'restart'" @click="control('restart')" />
            <Button :label="t('queue.action.stop')" icon="pi pi-stop" severity="danger" outlined :disabled="!running || acting !== ''" :loading="acting === 'stop'" @click="control('stop')" />
          </div>
        </div>

        <!-- تفاصيل النبضة -->
        <div class="mt-4 grid gap-x-6 gap-y-1 border-t border-surface-100 pt-4 text-sm sm:grid-cols-2 dark:border-surface-800">
          <div class="flex justify-between py-0.5"><span class="text-surface-500">{{ t('queue.workers') }}</span><span dir="ltr">{{ status?.worker_count ?? 0 }}</span></div>
          <div class="flex justify-between py-0.5"><span class="text-surface-500">{{ t('queue.heartbeatAge') }}</span><span dir="ltr">{{ status?.heartbeat_age_seconds != null ? status.heartbeat_age_seconds + 's' : '—' }}</span></div>
          <div class="flex justify-between py-0.5"><span class="text-surface-500">{{ t('queue.lastHeartbeat') }}</span><span class="font-mono text-xs" dir="ltr">{{ ymd(status?.last_heartbeat_at) }}</span></div>
          <div class="flex justify-between py-0.5"><span class="text-surface-500">{{ t('queue.staleAfter') }}</span><span dir="ltr">{{ status?.heartbeat_stale_after != null ? status.heartbeat_stale_after + 's' : '—' }}</span></div>
        </div>
      </div>

      <!-- العدّادات -->
      <div class="mb-5 grid gap-3 sm:grid-cols-3">
        <div v-for="c in counters" :key="c.key" class="rounded-2xl border border-surface-200 bg-white p-4 dark:border-surface-800 dark:bg-surface-900">
          <div class="flex items-center gap-2">
            <i :class="[c.icon, c.cls]" />
            <p class="text-xs text-surface-500">{{ t('queue.counter.' + c.key) }}</p>
          </div>
          <p class="mt-1 text-2xl font-semibold text-surface-900 dark:text-white" dir="ltr">{{ c.value ?? 0 }}</p>
        </div>
      </div>

      <!-- المهام الفاشلة -->
      <div class="overflow-hidden rounded-2xl border border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
        <div class="flex flex-wrap items-center justify-between gap-2 border-b border-surface-100 px-4 py-3 dark:border-surface-800">
          <h2 class="text-sm font-semibold text-surface-700 dark:text-surface-200">{{ t('queue.failedTitle') }}</h2>
          <div class="flex gap-2">
            <Button :label="t('queue.retryAll')" icon="pi pi-replay" size="small" severity="secondary" :disabled="!failed.length || acting !== ''" :loading="acting === 'retry-all'" @click="bulk('retry-all')" />
            <Button :label="t('queue.flush')" icon="pi pi-trash" size="small" severity="danger" outlined :disabled="!failed.length || acting !== ''" :loading="acting === 'flush'" @click="bulk('flush')" />
          </div>
        </div>
        <DataTable :value="failed" :loading="loading" paginator :rows="10" :rows-per-page-options="[10, 25, 50]" data-key="id" striped-rows>
          <template #empty>
            <p class="py-6 text-center text-sm text-surface-500">{{ t('queue.noFailed') }}</p>
          </template>
          <Column field="id" header="#" class="w-16"><template #body="{ data }"><span dir="ltr">{{ data.id }}</span></template></Column>
          <Column :header="t('queue.col.queue')"><template #body="{ data }"><span class="text-surface-500" dir="ltr">{{ data.queue ?? '—' }}</span></template></Column>
          <Column :header="t('queue.col.job')"><template #body="{ data }"><span class="text-surface-700 dark:text-surface-200" dir="ltr">{{ data.job_name ?? '—' }}</span></template></Column>
          <Column :header="t('queue.col.error')"><template #body="{ data }"><span class="line-clamp-2 text-xs text-red-600 dark:text-red-400" dir="ltr">{{ data.exception }}</span></template></Column>
          <Column field="failed_at" :header="t('queue.col.failedAt')" sortable><template #body="{ data }"><span class="font-mono text-xs text-surface-500" dir="ltr">{{ ymd(data.failed_at) }}</span></template></Column>
          <Column class="text-end">
            <template #body="{ data }">
              <div class="flex justify-end gap-1">
                <Button v-tooltip.top="t('queue.retry')" icon="pi pi-replay" severity="secondary" text rounded :loading="acting === 'row:' + (data.id ?? data.uuid)" @click="rowAction(data, 'retry')" />
                <Button v-tooltip.top="t('common.delete')" icon="pi pi-trash" severity="danger" text rounded :loading="acting === 'row:' + (data.id ?? data.uuid)" @click="rowAction(data, 'forget')" />
              </div>
            </template>
          </Column>
        </DataTable>
      </div>
    </template>
  </div>
</template>
