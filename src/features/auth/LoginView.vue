<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Message from 'primevue/message'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { ApiException } from '@/api/client'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const ui = useUiStore()

type Step = 'credentials' | 'two-factor'

const appIcon = '/app-icon-192.png'
const appVersion = __APP_VERSION__
const logoError = ref(false)
const step = ref<Step>('credentials')
const username = ref('')
const password = ref('')
const code = ref('')
const challenge = ref('')
const error = ref('')
const errorIsConnection = ref(false)
const currentYear = new Date().getFullYear()

// خطأ تعذّر الوصول للخادم (لا استجابة / 5xx) → رسالة ودّية بدل الخطأ الخام.
function isConnectionError(e: ApiException): boolean {
  return e.status === undefined || e.first?.code === 'network_error' || (e.status ?? 0) >= 500
}

function setError(e: unknown): void {
  if (e instanceof ApiException && isConnectionError(e)) {
    errorIsConnection.value = true
    error.value = t('auth.networkError')
  } else {
    errorIsConnection.value = false
    error.value = e instanceof ApiException ? e.message : t('auth.genericError')
  }
}

// مسار داخلي آمن فقط — يرفض الروابط المطلقة الخارجية و//host و/\ (open-redirect).
function safeInternalPath(target: unknown): string | null {
  if (typeof target !== 'string' || !target.startsWith('/')) return null
  if (target.startsWith('//') || target.startsWith('/\\')) return null
  return target
}

// بعد نجاح الدخول، اذهب لوجهة `redirect` الداخلية الآمنة إن وُجدت وإلا للوحة التحكم.
function goAfterLogin(): void {
  const target = safeInternalPath(route.query.redirect)
  router.replace(target ?? { name: 'dashboard' })
}

async function submitCredentials(): Promise<void> {
  error.value = ''
  try {
    const result = await auth.login(username.value, password.value)
    if (result) {
      challenge.value = result.challenge
      step.value = 'two-factor'
      return
    }
    goAfterLogin()
  } catch (e) {
    setError(e)
  }
}

async function submitTwoFactor(): Promise<void> {
  error.value = ''
  try {
    await auth.verifyTwoFactor(challenge.value, code.value)
    goAfterLogin()
  } catch (e) {
    setError(e)
  }
}

function backToCredentials(): void {
  step.value = 'credentials'
  code.value = ''
  challenge.value = ''
  error.value = ''
}
</script>

<template>
  <div
    class="relative flex min-h-svh items-center justify-center overflow-hidden bg-gradient-to-br from-primary-50 via-surface-50 to-surface-100 px-6 py-12 dark:from-surface-950 dark:via-surface-950 dark:to-surface-900"
  >
    <!-- زخارف ضبابية خفيفة في الخلفية -->
    <div class="pointer-events-none absolute -top-28 -start-28 size-80 rounded-full bg-primary-400/20 blur-3xl dark:bg-primary-500/10" aria-hidden="true" />
    <div class="pointer-events-none absolute -bottom-28 -end-28 size-80 rounded-full bg-primary-500/15 blur-3xl dark:bg-primary-400/10" aria-hidden="true" />

    <div class="relative w-full max-w-sm">
      <!-- مبدّلات اللغة/المظهر -->
      <div class="mb-5 flex justify-end gap-2">
        <Button
          type="button"
          severity="secondary"
          rounded
          outlined
          size="small"
          :label="ui.locale === 'ar' ? 'EN' : 'ع'"
          :title="t('common.toggleLanguage')"
          @click="ui.toggleLocale()"
        />
        <Button
          type="button"
          severity="secondary"
          rounded
          outlined
          size="small"
          :icon="ui.theme === 'dark' ? 'pi pi-sun' : 'pi pi-moon'"
          :title="t('common.toggleTheme')"
          @click="ui.toggleTheme()"
        />
      </div>

      <div
        class="rounded-3xl border border-surface-200/70 bg-white/90 p-8 shadow-xl backdrop-blur-sm dark:border-surface-800/80 dark:bg-surface-900/90"
      >
        <header class="mb-7 text-center">
          <div class="mx-auto mb-4 grid size-20 place-items-center rounded-3xl bg-white shadow-md ring-1 ring-surface-200/80 dark:bg-surface-800 dark:ring-surface-700">
            <img v-if="!logoError" :src="appIcon" alt="" class="size-14 rounded-2xl object-contain" @error="logoError = true" />
            <i v-else class="pi pi-clock !text-2xl text-primary" />
          </div>
          <p class="text-sm font-medium text-primary-600 dark:text-primary-400">{{ t('auth.welcomeBack') }}</p>
          <h1 class="mt-0.5 text-2xl font-bold tracking-tight text-surface-900 dark:text-white">{{ t('app.title') }}</h1>
          <p class="mt-1.5 text-sm text-surface-500 dark:text-surface-400">
            {{ step === 'credentials' ? t('auth.loginSubtitle') : t('auth.twoFactorSubtitle') }}
          </p>
        </header>

        <Message
          v-if="error"
          :severity="errorIsConnection ? 'warn' : 'error'"
          :icon="errorIsConnection ? 'pi pi-server' : 'pi pi-times-circle'"
          :closable="false"
          class="mb-5"
        >
          {{ error }}
        </Message>

        <!-- الخطوة 1: بيانات الدخول -->
        <form v-if="step === 'credentials'" class="space-y-4" @submit.prevent="submitCredentials">
          <div>
            <label for="username" class="mb-1.5 block text-sm font-medium text-surface-700 dark:text-surface-300">
              {{ t('auth.username') }}
            </label>
            <IconField>
              <InputIcon class="pi pi-user" />
              <InputText
                id="username"
                v-model="username"
                autocomplete="username"
                required
                :placeholder="t('auth.usernamePlaceholder')"
                fluid
              />
            </IconField>
          </div>
          <div>
            <label for="password" class="mb-1.5 block text-sm font-medium text-surface-700 dark:text-surface-300">
              {{ t('auth.password') }}
            </label>
            <Password
              v-model="password"
              input-id="password"
              :feedback="false"
              toggle-mask
              :input-props="{ autocomplete: 'current-password', required: true }"
              fluid
            />
          </div>
          <Button
            type="submit"
            class="mt-1"
            icon="pi pi-sign-in"
            :loading="auth.loading"
            :label="auth.loading ? t('auth.signingIn') : t('auth.signIn')"
            fluid
          />
        </form>

        <!-- الخطوة 2: التحقّق بخطوتين -->
        <form v-else class="space-y-4" @submit.prevent="submitTwoFactor">
          <div>
            <label for="code" class="mb-1.5 block text-sm font-medium text-surface-700 dark:text-surface-300">
              {{ t('auth.code') }}
            </label>
            <InputText
              id="code"
              v-model="code"
              inputmode="numeric"
              autocomplete="one-time-code"
              required
              class="text-center font-mono !text-lg !tracking-[0.4em]"
              fluid
            />
          </div>
          <Button
            type="submit"
            icon="pi pi-check"
            :loading="auth.loading"
            :label="auth.loading ? t('auth.verifying') : t('auth.verify')"
            fluid
          />
          <Button
            type="button"
            severity="secondary"
            text
            icon="pi pi-arrow-right rtl:pi-arrow-left"
            :label="t('auth.back')"
            fluid
            @click="backToCredentials"
          />
        </form>
      </div>

      <p class="mt-6 text-center text-xs text-surface-400 dark:text-surface-500">
        {{ t('app.title') }} · v{{ appVersion }} · {{ currentYear }}
      </p>
    </div>
  </div>
</template>
