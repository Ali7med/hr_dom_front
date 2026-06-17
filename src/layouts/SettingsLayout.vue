<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { settingsTabs } from '@/features/settings/settingsTabs'

const { t } = useI18n()
const auth = useAuthStore()

// التبويبات التي يملك المستخدم صلاحيتها فقط (Super Admin يرى الكل؛ التبويب الذاتي بلا صلاحية يظهر دائماً).
const tabs = computed(() =>
  settingsTabs.filter(
    (tab) => !tab.permission || auth.canAny(typeof tab.permission === 'string' ? [tab.permission] : tab.permission),
  ),
)
</script>

<template>
  <div class="mx-auto max-w-6xl">
    <div class="flex flex-col gap-6 lg:flex-row">
      <!-- شريط فئات الإعدادات (أفقي على الهاتف · عمودي على الشاشات الكبيرة) -->
      <aside class="lg:w-56 lg:shrink-0">
        <nav
          class="flex gap-1 overflow-x-auto rounded-2xl border border-surface-200 bg-white p-1.5 dark:border-surface-800 dark:bg-surface-900 lg:flex-col lg:overflow-visible"
        >
          <RouterLink
            v-for="tab in tabs"
            :key="tab.name"
            :to="{ name: tab.name }"
            class="flex shrink-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-surface-600 transition hover:bg-surface-100 hover:text-surface-900 dark:text-surface-300 dark:hover:bg-surface-800 dark:hover:text-white lg:w-full"
            active-class="!bg-primary-50 !text-primary-700 dark:!bg-primary-500/15 dark:!text-primary-300"
          >
            <i :class="tab.icon" class="shrink-0 text-base" />
            <span class="truncate">{{ t(tab.key) }}</span>
          </RouterLink>
        </nav>
      </aside>

      <!-- محتوى التبويب -->
      <section class="min-w-0 flex-1">
        <RouterView />
      </section>
    </div>
  </div>
</template>
