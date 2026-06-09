<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import Button from 'primevue/button'

const { t } = useI18n()
const router = useRouter()
</script>

<template>
  <div class="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center text-center">
    <span class="grid size-20 place-items-center rounded-3xl bg-primary-50 text-primary-600 dark:bg-primary-500/15 dark:text-primary-300">
      <i class="pi pi-lock !text-4xl" />
    </span>
    <p class="mt-6 text-5xl font-black text-primary-600 dark:text-primary-400">403</p>
    <h1 class="mt-3 text-xl font-bold text-surface-900 dark:text-white">
      {{ t('errors.forbiddenTitle') }}
    </h1>
    <p class="mt-2 text-sm text-surface-500 dark:text-surface-400">
      {{ t('errors.forbiddenBody') }}
    </p>
    <Button
      class="mt-6"
      icon="pi pi-home"
      :label="t('errors.backToDashboard')"
      @click="router.push({ name: 'dashboard' })"
    />
  </div>
</template>
