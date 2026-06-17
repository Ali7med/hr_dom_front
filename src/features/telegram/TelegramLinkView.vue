<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import Message from 'primevue/message'
import PageHeader from '@/components/PageHeader.vue'
import { ApiException } from '@/api/client'
import { useAuthStore } from '@/stores/auth'
import { telegramLinkApi, deepLinkOf, type TelegramLinkStatus, type TelegramLinkCode } from '@/api/telegramLink'

const { t } = useI18n()
const auth = useAuthStore()
const confirm = useConfirm()
const toast = useToast()

function notifyError(e: unknown, fallback: string): void {
  const msg = e instanceof ApiException ? e.message : fallback
  toast.add({ severity: 'error', summary: t('common.error'), detail: msg, life: 4000 })
}

const status = ref<TelegramLinkStatus | null>(null)
const code = ref<TelegramLinkCode | null>(null)
const loading = ref(false)
const linking = ref(false)
const unlinking = ref(false)

// بوت الشركة يُضبط في «إعدادات الإشعارات» (BE-70). بدونه لا يظهر رابط ربط مباشر.
const botConfigured = computed(() => !!status.value?.bot_username)
const canConfigureBot = computed(() => auth.can('notification_settings.manage'))

async function load(): Promise<void> {
  loading.value = true
  try {
    status.value = await telegramLinkApi.get()
  } catch (e) {
    notifyError(e, t('common.loadError'))
  } finally {
    loading.value = false
  }
}

async function startLink(): Promise<void> {
  linking.value = true
  try {
    code.value = await telegramLinkApi.create()
    const url = deepLinkOf(code.value)
    if (url) window.open(url, '_blank', 'noopener')
  } catch (e) {
    notifyError(e, t('telegram.linkError'))
  } finally {
    linking.value = false
  }
}

function unlink(): void {
  confirm.require({
    message: t('telegram.confirmUnlink'),
    header: t('telegram.unlink'),
    icon: 'pi pi-exclamation-triangle',
    acceptProps: { severity: 'danger', label: t('telegram.unlink') },
    rejectProps: { severity: 'secondary', outlined: true, label: t('common.cancel') },
    accept: async () => {
      unlinking.value = true
      try {
        await telegramLinkApi.remove()
        code.value = null
        toast.add({ severity: 'success', summary: t('telegram.unlinked'), life: 2500 })
        await load()
      } catch (e) {
        notifyError(e, t('common.saveError'))
      } finally {
        unlinking.value = false
      }
    },
  })
}

onMounted(load)
</script>

<template>
  <div class="mx-auto max-w-2xl">
    <PageHeader :title="t('telegram.title')" :subtitle="t('telegram.subtitle')" />

    <div class="rounded-2xl border border-surface-200 bg-white p-6 dark:border-surface-800 dark:bg-surface-900">
      <div class="mb-5 flex items-center gap-3">
        <span class="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-500/15 dark:text-primary-300">
          <i class="pi pi-telegram text-xl" />
        </span>
        <div class="min-w-0">
          <h2 class="text-sm font-semibold text-surface-800 dark:text-surface-100">{{ t('telegram.cardTitle') }}</h2>
          <p class="text-xs text-surface-500">{{ t('telegram.cardHint') }}</p>
        </div>
        <div class="ms-auto">
          <Tag v-if="status?.linked" :value="t('telegram.linked')" severity="success" icon="pi pi-check" />
          <Tag v-else-if="status" :value="t('telegram.notLinked')" severity="secondary" />
        </div>
      </div>

      <p v-if="loading" class="text-sm text-surface-500">{{ t('common.loading') }}</p>

      <!-- البوت غير مضبوط: لن يظهر رابط ربط مباشر حتى يُضبط توكن بوت الشركة في إعدادات الإشعارات -->
      <Message v-if="!loading && status && !botConfigured" severity="warn" :closable="false" class="mb-4">
        <div class="flex flex-col items-start gap-2">
          <span>{{ t('telegram.botNotConfigured') }}</span>
          <RouterLink
            v-if="canConfigureBot"
            :to="{ name: 'notification-settings' }"
            class="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-600 hover:underline dark:text-primary-300"
          >
            <i class="pi pi-cog" />{{ t('telegram.goToNotificationSettings') }}
          </RouterLink>
        </div>
      </Message>

      <!-- مربوط (شرط مستقلّ كي لا يبتلع تحذيرُ «البوت غير مضبوط» هذه الكتلة) -->
      <template v-if="!loading && status?.linked">
        <div class="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-50 px-4 py-3 dark:bg-surface-800">
          <div class="text-sm">
            <span class="text-surface-500">{{ t('telegram.account') }}:</span>
            <span class="ms-1 font-medium text-surface-900 dark:text-white" dir="ltr">{{ status.telegram_username ? '@' + status.telegram_username : t('telegram.linkedNoUser') }}</span>
          </div>
          <Button :label="t('telegram.unlink')" icon="pi pi-times" severity="danger" outlined size="small" :loading="unlinking" @click="unlink" />
        </div>
      </template>

      <!-- غير مربوط -->
      <template v-if="!loading && status && !status.linked">
        <Message severity="info" :closable="false" class="mb-4">{{ t('telegram.instructions') }}</Message>
        <Button :label="t('telegram.link')" icon="pi pi-link" :loading="linking" @click="startLink" />

        <!-- بعد توليد الكود -->
        <div v-if="code" class="mt-4 rounded-xl border border-primary-200 bg-primary-50/50 p-4 dark:border-primary-500/30 dark:bg-primary-500/10">
          <p class="mb-2 text-sm font-medium text-surface-800 dark:text-surface-100">{{ t('telegram.linkReady') }}</p>
          <a v-if="deepLinkOf(code)" :href="deepLinkOf(code)!" target="_blank" rel="noopener" class="inline-flex items-center gap-2 text-sm font-medium text-primary-600 hover:underline dark:text-primary-300" dir="ltr">
            <i class="pi pi-external-link" />{{ deepLinkOf(code) }}
          </a>
          <p v-if="code.code" class="mt-2 text-sm text-surface-600 dark:text-surface-300">
            {{ t('telegram.orSendCode') }} <code class="rounded bg-surface-200 px-1.5 py-0.5 font-mono dark:bg-surface-700" dir="ltr">/start {{ code.code }}</code>
          </p>
          <p class="mt-3 text-xs text-surface-500">{{ t('telegram.afterLinkHint') }}</p>
          <Button :label="t('telegram.refreshStatus')" icon="pi pi-refresh" severity="secondary" text size="small" class="mt-2" :loading="loading" @click="load" />
        </div>
      </template>
    </div>
  </div>
</template>
