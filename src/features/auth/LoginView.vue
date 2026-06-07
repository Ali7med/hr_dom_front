<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'
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
  <div class="flex min-h-svh items-center justify-center bg-slate-50 px-6 py-12 dark:bg-slate-950">
    <div class="w-full max-w-sm">
      <!-- مبدّلات اللغة/المظهر -->
      <div class="mb-6 flex justify-end gap-2">
        <button
          type="button"
          class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium transition hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          :title="t('common.toggleLanguage')"
          @click="ui.toggleLocale()"
        >
          {{ ui.locale === 'ar' ? 'EN' : 'ع' }}
        </button>
        <button
          type="button"
          class="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium transition hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
          :title="t('common.toggleTheme')"
          @click="ui.toggleTheme()"
        >
          {{ ui.theme === 'dark' ? '☀' : '☾' }}
        </button>
      </div>

      <div
        class="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <header class="mb-6 text-center">
          <h1 class="text-2xl font-bold text-slate-900 dark:text-white">
            {{ t('app.title') }}
          </h1>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {{ step === 'credentials' ? t('auth.loginSubtitle') : t('auth.twoFactorSubtitle') }}
          </p>
        </header>

        <p
          v-if="error"
          class="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300"
          role="alert"
        >
          {{ error }}
        </p>

        <!-- الخطوة 1: بيانات الدخول -->
        <form v-if="step === 'credentials'" class="space-y-4" @submit.prevent="submitCredentials">
          <div>
            <label for="username" class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              {{ t('auth.username') }}
            </label>
            <input
              id="username"
              v-model="username"
              type="text"
              autocomplete="username"
              required
              :placeholder="t('auth.usernamePlaceholder')"
              class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
          <div>
            <label for="password" class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              {{ t('auth.password') }}
            </label>
            <input
              id="password"
              v-model="password"
              type="password"
              autocomplete="current-password"
              required
              class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
          <button
            type="submit"
            :disabled="auth.loading"
            class="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {{ auth.loading ? t('auth.signingIn') : t('auth.signIn') }}
          </button>
        </form>

        <!-- الخطوة 2: التحقّق بخطوتين -->
        <form v-else class="space-y-4" @submit.prevent="submitTwoFactor">
          <div>
            <label for="code" class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              {{ t('auth.code') }}
            </label>
            <input
              id="code"
              v-model="code"
              type="text"
              inputmode="numeric"
              autocomplete="one-time-code"
              required
              class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-center font-mono text-lg tracking-widest text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>
          <button
            type="submit"
            :disabled="auth.loading"
            class="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {{ auth.loading ? t('auth.verifying') : t('auth.verify') }}
          </button>
          <button
            type="button"
            class="w-full rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            @click="backToCredentials"
          >
            {{ t('auth.back') }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>
