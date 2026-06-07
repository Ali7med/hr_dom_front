<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

const { t } = useI18n()
const router = useRouter()
</script>

<template>
  <div class="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center text-center">
    <p class="text-6xl font-black text-indigo-600 dark:text-indigo-400">403</p>
    <h1 class="mt-4 text-xl font-bold text-slate-900 dark:text-white">
      {{ t('errors.forbiddenTitle') }}
    </h1>
    <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
      {{ t('errors.forbiddenBody') }}
    </p>
    <button
      type="button"
      class="mt-6 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
      @click="router.push({ name: 'dashboard' })"
    >
      {{ t('errors.backToDashboard') }}
    </button>
  </div>
</template>
