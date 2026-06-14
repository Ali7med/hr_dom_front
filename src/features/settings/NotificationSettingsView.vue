<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Password from 'primevue/password'
import Select from 'primevue/select'
import ToggleSwitch from 'primevue/toggleswitch'
import InputChips from 'primevue/inputchips'
import Tag from 'primevue/tag'
import Message from 'primevue/message'
import PageHeader from '@/components/PageHeader.vue'
import { ApiException } from '@/api/client'
import { useAuthStore } from '@/stores/auth'
import {
  notificationSettingsApi,
  type NotificationSettings,
  type MailEncryption,
  type NotificationSettingsPayload,
} from '@/api/notificationSettings'

const { t } = useI18n()
const toast = useToast()
const auth = useAuthStore()

const companyId = ref<number | null>(auth.user?.company_id ?? null)

function messageFor(e: unknown, fallback: string): string {
  return e instanceof ApiException ? e.message : fallback
}
function notifyError(e: unknown, fallback: string): void {
  toast.add({ severity: 'error', summary: t('common.error'), detail: messageFor(e, fallback), life: 4000 })
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const encryptionOptions: { value: MailEncryption; key: string }[] = [
  { value: 'tls', key: 'notificationSettings.encTls' },
  { value: 'ssl', key: 'notificationSettings.encSsl' },
  { value: null, key: 'notificationSettings.encNone' },
]

// حالة النموذج (غير الحسّاسة) + علمَا وجود الأسرار + الأسرار الجديدة (تُرسَل عند الإدخال فقط).
const form = reactive({
  telegram_enabled: false,
  telegram_chat_ids: [] as string[],
  smtp_enabled: false,
  mail_host: '' as string,
  mail_port: null as number | null,
  mail_encryption: 'tls' as MailEncryption,
  mail_username: '' as string,
  mail_from_address: '' as string,
  mail_from_name: '' as string,
  notify_emails: [] as string[],
})
const telegramTokenSet = ref(false)
const mailPasswordSet = ref(false)
const telegramToken = ref('') // كتابة فقط — فارغ = إبقاء الحالي
const mailPassword = ref('')

const loading = ref(false)
const saving = ref(false)
const loaded = ref(false)
const testing = ref<'telegram' | 'email' | null>(null)

function applySettings(s: NotificationSettings): void {
  form.telegram_enabled = s.telegram_enabled
  form.telegram_chat_ids = [...(s.telegram_chat_ids ?? [])]
  form.smtp_enabled = s.smtp_enabled
  form.mail_host = s.mail_host ?? ''
  form.mail_port = s.mail_port ?? null
  form.mail_encryption = s.mail_encryption ?? 'tls'
  form.mail_username = s.mail_username ?? ''
  form.mail_from_address = s.mail_from_address ?? ''
  form.mail_from_name = s.mail_from_name ?? ''
  form.notify_emails = [...(s.notify_emails ?? [])]
  telegramTokenSet.value = s.telegram_bot_token_set
  mailPasswordSet.value = s.mail_password_set
  telegramToken.value = ''
  mailPassword.value = ''
}

async function load(): Promise<void> {
  if (!companyId.value) return
  loading.value = true
  try {
    applySettings(await notificationSettingsApi.get(companyId.value))
    loaded.value = true
  } catch (e) {
    notifyError(e, t('common.loadError'))
  } finally {
    loading.value = false
  }
}

function invalidEmails(): string[] {
  return form.notify_emails.filter((e) => !EMAIL_RE.test(e.trim()))
}

function buildPayload(): NotificationSettingsPayload {
  const p: NotificationSettingsPayload = {
    telegram_enabled: form.telegram_enabled,
    telegram_chat_ids: form.telegram_chat_ids,
    smtp_enabled: form.smtp_enabled,
    mail_host: form.mail_host.trim() || null,
    mail_port: form.mail_port,
    mail_encryption: form.mail_encryption,
    mail_username: form.mail_username.trim() || null,
    mail_from_address: form.mail_from_address.trim() || null,
    mail_from_name: form.mail_from_name.trim() || null,
    notify_emails: form.notify_emails.map((e) => e.trim()),
  }
  // الأسرار: تُرسَل عند الإدخال فقط (فارغ = إبقاء الحالي).
  if (telegramToken.value.trim()) p.telegram_bot_token = telegramToken.value.trim()
  if (mailPassword.value.trim()) p.mail_password = mailPassword.value.trim()
  return p
}

async function save(): Promise<void> {
  if (!companyId.value) return
  const bad = invalidEmails()
  if (bad.length) {
    toast.add({ severity: 'warn', summary: t('common.error'), detail: t('notificationSettings.invalidEmail', { email: bad[0] }), life: 4000 })
    return
  }
  saving.value = true
  try {
    applySettings(await notificationSettingsApi.update(companyId.value, buildPayload()))
    toast.add({ severity: 'success', summary: t('common.saved'), life: 2500 })
  } catch (e) {
    notifyError(e, t('common.saveError'))
  } finally {
    saving.value = false
  }
}

async function sendTest(channel: 'telegram' | 'email'): Promise<void> {
  if (!companyId.value) return
  testing.value = channel
  try {
    const res = await notificationSettingsApi.test(companyId.value, { channel })
    toast.add({
      severity: 'success',
      summary: t('notificationSettings.testSent'),
      detail: res?.message ?? t('notificationSettings.testSentBody'),
      life: 3500,
    })
  } catch (e) {
    notifyError(e, t('notificationSettings.testFailed'))
  } finally {
    testing.value = null
  }
}

onMounted(load)
</script>

<template>
  <div>
    <PageHeader :title="t('notificationSettings.title')" :subtitle="t('notificationSettings.subtitle')" />

    <!-- لا سياق شركة (Super Admin بلا شركة) -->
    <Message v-if="!companyId" severity="warn" :closable="false">{{ t('notificationSettings.noCompany') }}</Message>

    <template v-else>
      <!-- تنبيه أمني (ADR-0004) -->
      <Message severity="info" :closable="false" class="mb-6">{{ t('notificationSettings.securityNote') }}</Message>

      <div class="grid gap-6 lg:grid-cols-2">
        <!-- بطاقة تلكرام -->
        <section class="rounded-2xl border border-surface-200 bg-white p-5 dark:border-surface-800 dark:bg-surface-900">
          <div class="mb-4 flex items-center justify-between">
            <h2 class="flex items-center gap-2 text-sm font-semibold text-surface-800 dark:text-surface-100">
              <i class="pi pi-telegram text-primary" />{{ t('notificationSettings.telegram') }}
            </h2>
            <label class="flex items-center gap-2 text-sm">
              <ToggleSwitch v-model="form.telegram_enabled" />
              <span class="text-surface-600 dark:text-surface-300">{{ t('notificationSettings.enabled') }}</span>
            </label>
          </div>
          <div class="grid gap-4">
            <label class="block text-sm">
              <span class="mb-1.5 flex items-center gap-2 font-medium text-surface-700 dark:text-surface-300">
                {{ t('notificationSettings.botToken') }}
                <Tag v-if="telegramTokenSet" :value="t('notificationSettings.set')" severity="success" />
              </span>
              <Password v-model="telegramToken" :feedback="false" toggle-mask fluid :placeholder="telegramTokenSet ? t('notificationSettings.keepCurrent') : ''" :input-props="{ autocomplete: 'off' }" />
            </label>
            <label class="block text-sm">
              <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('notificationSettings.chatIds') }}</span>
              <InputChips v-model="form.telegram_chat_ids" separator="," fluid :placeholder="t('notificationSettings.chatIdsPlaceholder')" />
              <span class="mt-1 block text-xs text-surface-500">{{ t('notificationSettings.chatIdsHint') }}</span>
            </label>
            <div>
              <Button
                :label="t('notificationSettings.testTelegram')"
                icon="pi pi-send"
                severity="secondary"
                outlined
                size="small"
                :loading="testing === 'telegram'"
                :disabled="!form.telegram_enabled"
                @click="sendTest('telegram')"
              />
            </div>
          </div>
        </section>

        <!-- بطاقة الإيميل (SMTP) -->
        <section class="rounded-2xl border border-surface-200 bg-white p-5 dark:border-surface-800 dark:bg-surface-900">
          <div class="mb-4 flex items-center justify-between">
            <h2 class="flex items-center gap-2 text-sm font-semibold text-surface-800 dark:text-surface-100">
              <i class="pi pi-envelope text-primary" />{{ t('notificationSettings.email') }}
            </h2>
            <label class="flex items-center gap-2 text-sm">
              <ToggleSwitch v-model="form.smtp_enabled" />
              <span class="text-surface-600 dark:text-surface-300">{{ t('notificationSettings.enabled') }}</span>
            </label>
          </div>
          <div class="grid gap-4 sm:grid-cols-2">
            <label class="block text-sm sm:col-span-2">
              <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('notificationSettings.mailHost') }}</span>
              <InputText v-model="form.mail_host" fluid placeholder="smtp.example.com" />
            </label>
            <label class="block text-sm">
              <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('notificationSettings.mailPort') }}</span>
              <InputNumber v-model="form.mail_port" :use-grouping="false" :min="1" :max="65535" fluid />
            </label>
            <label class="block text-sm">
              <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('notificationSettings.mailEncryption') }}</span>
              <Select v-model="form.mail_encryption" :options="encryptionOptions" option-value="value" fluid>
                <template #value="{ value }">{{ t(encryptionOptions.find((o) => o.value === value)?.key ?? 'notificationSettings.encNone') }}</template>
                <template #option="{ option }">{{ t(option.key) }}</template>
              </Select>
            </label>
            <label class="block text-sm">
              <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('notificationSettings.mailUsername') }}</span>
              <InputText v-model="form.mail_username" fluid :input-props="{ autocomplete: 'off' }" />
            </label>
            <label class="block text-sm">
              <span class="mb-1.5 flex items-center gap-2 font-medium text-surface-700 dark:text-surface-300">
                {{ t('notificationSettings.mailPassword') }}
                <Tag v-if="mailPasswordSet" :value="t('notificationSettings.set')" severity="success" />
              </span>
              <Password v-model="mailPassword" :feedback="false" toggle-mask fluid :placeholder="mailPasswordSet ? t('notificationSettings.keepCurrent') : ''" :input-props="{ autocomplete: 'new-password' }" />
            </label>
            <label class="block text-sm">
              <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('notificationSettings.fromAddress') }}</span>
              <InputText v-model="form.mail_from_address" fluid placeholder="no-reply@example.com" />
            </label>
            <label class="block text-sm">
              <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('notificationSettings.fromName') }}</span>
              <InputText v-model="form.mail_from_name" fluid />
            </label>
            <label class="block text-sm sm:col-span-2">
              <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('notificationSettings.notifyEmails') }}</span>
              <InputChips v-model="form.notify_emails" separator="," fluid :placeholder="t('notificationSettings.notifyEmailsPlaceholder')" />
              <span class="mt-1 block text-xs text-surface-500">{{ t('notificationSettings.notifyEmailsHint') }}</span>
            </label>
            <div class="sm:col-span-2">
              <Button
                :label="t('notificationSettings.testEmail')"
                icon="pi pi-send"
                severity="secondary"
                outlined
                size="small"
                :loading="testing === 'email'"
                :disabled="!form.smtp_enabled"
                @click="sendTest('email')"
              />
            </div>
          </div>
        </section>
      </div>

      <!-- حفظ -->
      <div class="mt-6 flex justify-end">
        <Button
          v-can="'notification_settings.manage'"
          :label="saving ? t('common.saving') : t('common.save')"
          icon="pi pi-check"
          :loading="saving"
          :disabled="loading || !loaded"
          @click="save"
        />
      </div>
    </template>
  </div>
</template>
