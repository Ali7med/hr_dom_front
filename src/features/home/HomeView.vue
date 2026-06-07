<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useUiStore } from '@/stores/ui'

const { t } = useI18n()
const ui = useUiStore()

const apiBase = computed(
  () => import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api/v1',
)
const direction = computed(() => (ui.locale === 'ar' ? 'RTL' : 'LTR'))
</script>

<template>
  <main class="mx-auto flex min-h-svh max-w-2xl flex-col items-center justify-center gap-8 px-6 py-12">
    <header class="text-center">
      <h1 class="text-3xl font-bold text-slate-900 dark:text-white">
        {{ t('app.title') }}
      </h1>
      <p class="mt-2 text-slate-500 dark:text-slate-400">
        {{ t('app.subtitle') }}
      </p>
    </header>

    <section
      class="w-full rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800"
    >
      <h2 class="text-xl font-semibold">{{ t('home.welcome') }}</h2>
      <p class="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
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

      <div class="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          @click="ui.toggleLocale()"
        >
          {{ t('common.toggleLanguage') }} ({{ ui.locale === 'ar' ? 'EN' : 'ع' }})
        </button>
        <button
          type="button"
          class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium transition hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-700"
          @click="ui.toggleTheme()"
        >
          {{ t('common.toggleTheme') }} ({{ ui.theme === 'dark' ? '☀' : '☾' }})
        </button>
      </div>
    </section>
  </main>
</template>
