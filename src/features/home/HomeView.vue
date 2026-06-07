<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUiStore } from '@/stores/ui'
import { useAuthStore } from '@/stores/auth'

const { t } = useI18n()
const ui = useUiStore()
const auth = useAuthStore()

const apiBase = computed(
  () => import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1',
)
const direction = computed(() => (ui.locale === 'ar' ? 'RTL' : 'LTR'))
</script>

<template>
  <div class="mx-auto max-w-2xl">
    <header class="mb-6">
      <h1 class="text-2xl font-bold text-slate-900 dark:text-white">
        {{ t('home.welcome') }}<span v-if="auth.user">، {{ auth.user.name }}</span>
      </h1>
      <p class="mt-1 text-slate-500 dark:text-slate-400">{{ t('app.subtitle') }}</p>
    </header>

    <section
      class="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <p class="text-sm leading-6 text-slate-600 dark:text-slate-300">
        {{ t('home.ready') }}
      </p>

      <dl class="mt-4 space-y-1 text-sm">
        <div class="flex justify-between gap-4">
          <dt class="text-slate-500 dark:text-slate-400">{{ t('common.direction') }}</dt>
          <dd class="font-mono font-medium">{{ direction }}</dd>
        </div>
        <div class="flex justify-between gap-4">
          <dt class="text-slate-500 dark:text-slate-400">{{ t('common.theme') }}</dt>
          <dd class="font-mono font-medium">{{ ui.theme }}</dd>
        </div>
        <div class="flex justify-between gap-4">
          <dt class="text-slate-500 dark:text-slate-400">{{ t('home.apiBase') }}</dt>
          <dd class="font-mono text-xs">{{ apiBase }}</dd>
        </div>
      </dl>
    </section>
  </div>
</template>
