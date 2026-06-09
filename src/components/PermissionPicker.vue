<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Checkbox from 'primevue/checkbox'
import { groupPermissions } from '@/api/roles'

const props = defineProps<{
  all: string[]
  modelValue: string[]
  disabled?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [string[]] }>()

const { t } = useI18n()

const groups = computed(() => groupPermissions(props.all))

function isChecked(perm: string): boolean {
  return props.modelValue.includes(perm)
}

function toggle(perm: string): void {
  const next = isChecked(perm)
    ? props.modelValue.filter((p) => p !== perm)
    : [...props.modelValue, perm]
  emit('update:modelValue', next)
}

function groupLabel(key: string): string {
  // مفتاح ترجمة اختياري permGroups.<key>، وإلا اعرض المفتاح نفسه.
  const k = `permGroups.${key}`
  const translated = t(k)
  return translated === k ? key : translated
}
</script>

<template>
  <div class="space-y-4">
    <fieldset
      v-for="(perms, group) in groups"
      :key="group"
      class="rounded-xl border border-surface-200 p-4 dark:border-surface-700"
    >
      <legend class="px-1 text-sm font-semibold text-surface-700 dark:text-surface-300">
        {{ groupLabel(group) }}
      </legend>
      <div class="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <label v-for="perm in perms" :key="perm" class="flex items-center gap-2 text-sm">
          <Checkbox
            :model-value="isChecked(perm)"
            :binary="true"
            :disabled="disabled"
            @update:model-value="toggle(perm)"
          />
          <span class="font-mono text-xs">{{ perm }}</span>
        </label>
      </div>
    </fieldset>
  </div>
</template>
