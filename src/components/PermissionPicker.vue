<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import Checkbox from 'primevue/checkbox'
import Button from 'primevue/button'
import { groupPermissions } from '@/api/roles'

const props = defineProps<{
  all: string[]
  modelValue: string[]
  disabled?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [string[]] }>()

const { t } = useI18n()

const groups = computed(() => groupPermissions(props.all))
const selectedCount = computed(() => props.all.filter((p) => props.modelValue.includes(p)).length)
const allSelected = computed(() => props.all.length > 0 && selectedCount.value === props.all.length)

function isChecked(perm: string): boolean {
  return props.modelValue.includes(perm)
}

function toggle(perm: string): void {
  const next = isChecked(perm)
    ? props.modelValue.filter((p) => p !== perm)
    : [...props.modelValue, perm]
  emit('update:modelValue', next)
}

// تحديد الكل / إلغاء تحديد الكل (على مستوى كل الصلاحيات).
function selectAll(): void {
  emit('update:modelValue', [...props.all])
}
function clearAll(): void {
  emit('update:modelValue', [])
}

// تحديد/إلغاء كل صلاحيات مجموعة واحدة.
function groupAllSelected(perms: string[]): boolean {
  return perms.every((p) => props.modelValue.includes(p))
}
function toggleGroup(perms: string[]): void {
  const set = new Set(props.modelValue)
  if (groupAllSelected(perms)) perms.forEach((p) => set.delete(p))
  else perms.forEach((p) => set.add(p))
  emit('update:modelValue', [...set])
}

function groupLabel(key: string): string {
  // مفتاح ترجمة اختياري permGroups.<key>، وإلا اعرض المفتاح نفسه.
  const k = `permGroups.${key}`
  const translated = t(k)
  return translated === k ? key : translated
}

// تسمية الصلاحية بلغة الواجهة: «<المورد> — <الإجراء>» (مع رجوع للمفتاح الخام إن غاب).
function permLabel(perm: string): string {
  const idx = perm.indexOf('.')
  const resource = idx >= 0 ? perm.slice(0, idx) : perm
  const action = idx >= 0 ? perm.slice(idx + 1) : ''
  if (!action) return groupLabel(resource)
  const ak = `permActions.${action}`
  const at = t(ak)
  return `${groupLabel(resource)} — ${at === ak ? action.replace(/_/g, ' ') : at}`
}
</script>

<template>
  <div class="space-y-4">
    <!-- شريط تحديد الكل / إلغاء التحديد + عدّاد المُحدَّد -->
    <div class="flex flex-wrap items-center justify-between gap-2 border-b border-surface-200 pb-3 dark:border-surface-700">
      <span class="text-sm text-surface-500">
        {{ t('permPicker.selected', { n: selectedCount, total: all.length }) }}
      </span>
      <div class="flex gap-2">
        <Button
          type="button"
          size="small"
          severity="secondary"
          outlined
          icon="pi pi-check-square"
          :label="t('permPicker.selectAll')"
          :disabled="disabled || allSelected"
          @click="selectAll"
        />
        <Button
          type="button"
          size="small"
          severity="secondary"
          outlined
          icon="pi pi-stop"
          :label="t('permPicker.clearAll')"
          :disabled="disabled || selectedCount === 0"
          @click="clearAll"
        />
      </div>
    </div>

    <fieldset
      v-for="(perms, group) in groups"
      :key="group"
      class="rounded-xl border border-surface-200 p-4 dark:border-surface-700"
    >
      <legend class="px-1">
        <label class="flex cursor-pointer items-center gap-2 text-sm font-semibold text-surface-700 dark:text-surface-300">
          <Checkbox
            :model-value="groupAllSelected(perms)"
            :binary="true"
            :disabled="disabled"
            @update:model-value="toggleGroup(perms)"
          />
          {{ groupLabel(group) }}
        </label>
      </legend>
      <div class="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <label v-for="perm in perms" :key="perm" class="flex items-center gap-2 text-sm" :title="perm">
          <Checkbox
            :model-value="isChecked(perm)"
            :binary="true"
            :disabled="disabled"
            @update:model-value="toggle(perm)"
          />
          <span>{{ permLabel(perm) }}</span>
        </label>
      </div>
    </fieldset>
  </div>
</template>
