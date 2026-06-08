<script setup lang="ts">
import { computed } from 'vue'

interface Segment {
  label: string
  value: number
  color: string
}

const props = withDefaults(defineProps<{ segments: Segment[]; size?: number; thickness?: number }>(), {
  size: 160,
  thickness: 22,
})

const total = computed(() => props.segments.reduce((s, x) => s + x.value, 0))
const radius = computed(() => (props.size - props.thickness) / 2)
const circumference = computed(() => 2 * Math.PI * radius.value)

// يحسب القوس لكل شريحة كـ stroke-dasharray مع إزاحة تراكمية.
const arcs = computed(() => {
  const c = circumference.value
  let offset = 0
  return props.segments
    .filter((s) => s.value > 0)
    .map((s) => {
      const frac = total.value > 0 ? s.value / total.value : 0
      const len = frac * c
      const arc = { ...s, len, gap: c - len, offset: -offset }
      offset += len
      return arc
    })
})
</script>

<template>
  <div class="flex items-center gap-5">
    <div class="relative" :style="{ width: size + 'px', height: size + 'px' }">
      <svg :width="size" :height="size" :viewBox="`0 0 ${size} ${size}`" class="-rotate-90">
        <circle :cx="size / 2" :cy="size / 2" :r="radius" fill="none" :stroke-width="thickness" class="stroke-slate-100 dark:stroke-slate-800" />
        <circle
          v-for="(a, i) in arcs"
          :key="i"
          :cx="size / 2"
          :cy="size / 2"
          :r="radius"
          fill="none"
          :stroke="a.color"
          :stroke-width="thickness"
          :stroke-dasharray="`${a.len} ${a.gap}`"
          :stroke-dashoffset="a.offset"
          stroke-linecap="butt"
        />
      </svg>
      <div class="absolute inset-0 flex flex-col items-center justify-center">
        <span class="text-2xl font-bold text-slate-900 dark:text-white">{{ total }}</span>
        <slot name="centerLabel" />
      </div>
    </div>
    <ul class="space-y-1.5 text-sm">
      <li v-for="(s, i) in segments" :key="i" class="flex items-center gap-2">
        <span class="inline-block size-3 rounded-sm" :style="{ background: s.color }" />
        <span class="text-slate-600 dark:text-slate-300">{{ s.label }}</span>
        <span class="font-medium text-slate-900 dark:text-white">{{ s.value }}</span>
      </li>
    </ul>
  </div>
</template>
