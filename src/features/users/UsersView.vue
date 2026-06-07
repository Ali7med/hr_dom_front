<script setup lang="ts">
import { useI18n } from 'vue-i18n'

// شاشة مبدئية محميّة بصلاحية `users.view` — تُفصَّل في FE-04.
const { t } = useI18n()
</script>

<template>
  <div class="mx-auto max-w-2xl">
    <h1 class="text-2xl font-bold text-slate-900 dark:text-white">{{ t('nav.users') }}</h1>
    <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">{{ t('users.placeholder') }}</p>
  </div>
</template>
