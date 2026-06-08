<script setup lang="ts">
import { computed } from 'vue'

interface Bar {
  label: string
  value: number
  color: string
}

const props = defineProps<{ bars: Bar[]; unit?: string }>()

const max = computed(() => Math.max(1, ...props.bars.map((b) => b.value)))
const pct = (v: number) => Math.round((v / max.value) * 100)
</script>

<template>
  <div class="space-y-3">
    <div v-for="(b, i) in bars" :key="i">
      <div class="mb-1 flex items-center justify-between text-sm">
        <span class="text-slate-600 dark:text-slate-300">{{ b.label }}</span>
        <span class="font-medium text-slate-900 dark:text-white">{{ b.value }}<span v-if="unit" class="text-slate-400"> {{ unit }}</span></span>
      </div>
      <div class="h-2.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <div class="h-full rounded-full transition-all" :style="{ width: pct(b.value) + '%', background: b.color }" />
      </div>
    </div>
  </div>
</template>
