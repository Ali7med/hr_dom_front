<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AppDialog from '@/components/AppDialog.vue'
import type { ReleaseItem, LocalizedText } from '@/api/releases'

// نافذة «ما الجديد» (FE-55) — تعرض ملاحظات الإصدارات بتصميم مطابق للصورة.
const props = defineProps<{ releases: ReleaseItem[] }>()
const visible = defineModel<boolean>('visible', { default: false })

const { t, locale } = useI18n()
const lang = computed<'ar' | 'en'>(() => (locale.value === 'ar' ? 'ar' : 'en'))

const tx = (x: LocalizedText) => x?.[lang.value] ?? x?.en ?? x?.ar ?? ''

function fmtDate(d: string): string {
  try {
    return new Intl.DateTimeFormat(lang.value === 'ar' ? 'ar' : 'en', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date(d))
  } catch {
    return d
  }
}

// الأقسام بالترتيب — تُعرض فقط غير الفارغة.
const SECTIONS = [
  { key: 'new', label: 'whatsNew.new', dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400' },
  { key: 'improved', label: 'whatsNew.improved', dot: 'bg-sky-500', text: 'text-sky-600 dark:text-sky-400' },
  { key: 'fixed', label: 'whatsNew.fixed', dot: 'bg-amber-500', text: 'text-amber-600 dark:text-amber-400' },
] as const

const sectionsOf = (r: ReleaseItem) =>
  SECTIONS.map((s) => ({ ...s, items: r.entries?.[s.key] ?? [] })).filter((s) => s.items.length > 0)
</script>

<template>
  <AppDialog
    v-model:visible="visible"
    modal
    :show-header="false"
    :style="{ width: '34rem' }"
    :breakpoints="{ '640px': '95vw' }"
    content-class="!p-0"
  >
    <div class="flex max-h-[80vh] flex-col">
      <!-- الرأس -->
      <div class="flex items-center justify-between border-b border-surface-200 px-5 py-4 dark:border-surface-700">
        <div class="flex items-center gap-2.5">
          <span class="grid size-9 place-items-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-500/15 dark:text-primary-300">
            <i class="pi pi-megaphone text-lg" />
          </span>
          <h2 class="text-base font-bold text-surface-900 dark:text-white">{{ t('whatsNew.title') }}</h2>
        </div>
        <button
          type="button"
          class="grid size-8 place-items-center rounded-lg text-surface-500 transition hover:bg-surface-100 dark:hover:bg-surface-800"
          :aria-label="t('common.close')"
          @click="visible = false"
        >
          <i class="pi pi-times" />
        </button>
      </div>

      <!-- المحتوى -->
      <div class="overflow-y-auto px-5 py-4">
        <p v-if="!releases.length" class="py-10 text-center text-sm text-surface-500">
          <i class="pi pi-inbox mb-2 block text-2xl text-surface-300 dark:text-surface-600" />
          {{ t('whatsNew.empty') }}
        </p>

        <div v-else class="divide-y divide-surface-200 dark:divide-surface-700">
          <section v-for="r in releases" :key="r.id" class="py-4 first:pt-0 last:pb-0">
            <!-- التاريخ + شارة النسخة -->
            <div class="mb-3 flex items-center justify-between gap-3">
              <span class="text-xs font-medium text-surface-500">{{ fmtDate(r.released_at) }}</span>
              <span
                class="rounded-md bg-surface-100 px-2 py-0.5 font-mono text-xs font-semibold text-surface-600 dark:bg-surface-800 dark:text-surface-300"
                dir="ltr"
              >v{{ r.version }}</span>
            </div>

            <h3 v-if="r.title" class="mb-3 text-sm font-bold text-surface-900 dark:text-white">{{ tx(r.title) }}</h3>

            <div v-for="s in sectionsOf(r)" :key="s.key" class="mb-3 last:mb-0">
              <div class="mb-1.5 flex items-center gap-2">
                <span class="size-1.5 rounded-full" :class="s.dot"></span>
                <span class="text-[11px] font-bold uppercase tracking-wide" :class="s.text">{{ t(s.label) }}</span>
              </div>
              <ul class="space-y-1 ps-4">
                <li
                  v-for="(item, i) in s.items"
                  :key="i"
                  class="list-disc text-sm leading-relaxed text-surface-700 marker:text-surface-300 dark:text-surface-300 dark:marker:text-surface-600"
                >
                  {{ tx(item) }}
                </li>
              </ul>
            </div>
          </section>
        </div>
      </div>
    </div>
  </AppDialog>
</template>
