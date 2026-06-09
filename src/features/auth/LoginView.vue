<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import Message from 'primevue/message'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { ApiException } from '@/api/client'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const ui = useUiStore()

type Step = 'credentials' | 'two-factor'

const step = ref<Step>('credentials')
const username = ref('')
const password = ref('')
const code = ref('')
const challenge = ref('')
const error = ref('')

function messageFor(e: unknown, fallback: string): string {
  return e instanceof ApiException ? e.message : fallback
}

// بعد نجاح الدخول، اذهب لوجهة `redirect` إن وُجدت وإلا للوحة التحكم.
function goAfterLogin(): void {
  const target = route.query.redirect
  router.replace(typeof target === 'string' ? target : { name: 'dashboard' })
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
    error.value = messageFor(e, t('auth.genericError'))
  }
}

async function submitTwoFactor(): Promise<void> {
  error.value = ''
  try {
    await auth.verifyTwoFactor(challenge.value, code.value)
    goAfterLogin()
  } catch (e) {
    error.value = messageFor(e, t('auth.genericError'))
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
  <div class="flex min-h-svh items-center justify-center bg-surface-50 px-6 py-12 dark:bg-surface-950">
    <div class="w-full max-w-sm">
      <!-- مبدّلات اللغة/المظهر -->
      <div class="mb-6 flex justify-end gap-2">
        <Button
          type="button"
          severity="secondary"
          outlined
          size="small"
          :label="ui.locale === 'ar' ? 'EN' : 'ع'"
          :title="t('common.toggleLanguage')"
          @click="ui.toggleLocale()"
        />
        <Button
          type="button"
          severity="secondary"
          outlined
          size="small"
          :icon="ui.theme === 'dark' ? 'pi pi-sun' : 'pi pi-moon'"
          :title="t('common.toggleTheme')"
          @click="ui.toggleTheme()"
        />
      </div>

      <div class="rounded-2xl border border-surface-200 bg-white p-8 shadow-sm dark:border-surface-800 dark:bg-surface-900">
        <header class="mb-6 text-center">
          <span class="mx-auto mb-3 grid size-12 place-items-center rounded-2xl bg-primary text-primary-contrast">
            <i class="pi pi-clock !text-xl" />
          </span>
          <h1 class="text-2xl font-bold text-surface-900 dark:text-white">{{ t('app.title') }}</h1>
          <p class="mt-1 text-sm text-surface-500 dark:text-surface-400">
            {{ step === 'credentials' ? t('auth.loginSubtitle') : t('auth.twoFactorSubtitle') }}
          </p>
        </header>

        <Message v-if="error" severity="error" :closable="false" class="mb-4">{{ error }}</Message>

        <!-- الخطوة 1: بيانات الدخول -->
        <form v-if="step === 'credentials'" class="space-y-4" @submit.prevent="submitCredentials">
          <div>
            <label for="username" class="mb-1.5 block text-sm font-medium text-surface-700 dark:text-surface-300">
              {{ t('auth.username') }}
            </label>
            <InputText
              id="username"
              v-model="username"
              autocomplete="username"
              required
              :placeholder="t('auth.usernamePlaceholder')"
              fluid
            />
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
              class="text-center font-mono !text-lg tracking-widest"
              fluid
            />
          </div>
          <Button
            type="submit"
            :loading="auth.loading"
            :label="auth.loading ? t('auth.verifying') : t('auth.verify')"
            fluid
          />
          <Button
            type="button"
            severity="secondary"
            text
            :label="t('auth.back')"
            fluid
            @click="backToCredentials"
          />
        </form>
      </div>
    </div>
  </div>
</template>
