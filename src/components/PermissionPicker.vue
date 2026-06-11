<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import Checkbox from 'primevue/checkbox'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import { groupPermissions } from '@/api/roles'

const props = defineProps<{
  all: string[]
  modelValue: string[]
  disabled?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [string[]] }>()

const { t } = useI18n()

const query = ref('')
const collapsed = ref<Set<string>>(new Set())

// تسمية المجموعة: permGroups.<key> أو المفتاح الخام.
function groupLabel(key: string): string {
  const k = `permGroups.${key}`
  const translated = t(k)
  return translated === k ? key : translated
}

// تسمية الإجراء فقط (المجموعة ظاهرة في رأس القسم، فلا داعي لتكرارها).
function actionLabel(perm: string): string {
  const idx = perm.indexOf('.')
  if (idx < 0) return groupLabel(perm)
  const action = perm.slice(idx + 1)
  const ak = `permActions.${action}`
  const at = t(ak)
  return at === ak ? action.replace(/_/g, ' ') : at
}

// مطابقة البحث: على المفتاح الخام + اسم المجموعة + اسم الإجراء (عربي/إنجليزي/خام).
function matches(perm: string): boolean {
  const q = query.value.trim().toLowerCase()
  if (!q) return true
  const group = perm.includes('.') ? perm.slice(0, perm.indexOf('.')) : perm
  return [perm, groupLabel(group), actionLabel(perm)].join(' ').toLowerCase().includes(q)
}

// المجموعات بعد الفلترة (تُخفى الفارغة)، مرتّبة بتسمية المجموعة.
const groups = computed<[string, string[]][]>(() => {
  const grouped = groupPermissions(props.all)
  return Object.entries(grouped)
    .map(([key, perms]) => [key, perms.filter(matches)] as [string, string[]])
    .filter(([, perms]) => perms.length > 0)
    .sort((a, b) => groupLabel(a[0]).localeCompare(groupLabel(b[0]), 'ar'))
})

const hasResults = computed(() => groups.value.length > 0)
const searching = computed(() => query.value.trim().length > 0)

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

function selectAll(): void {
  emit('update:modelValue', [...props.all])
}
function clearAll(): void {
  emit('update:modelValue', [])
}

// تحديد/إلغاء كل صلاحيات المجموعة المعروضة (المفلترة).
function groupSelectedCount(perms: string[]): number {
  return perms.filter((p) => props.modelValue.includes(p)).length
}
function groupAllSelected(perms: string[]): boolean {
  return perms.length > 0 && perms.every((p) => props.modelValue.includes(p))
}
function toggleGroup(perms: string[]): void {
  const set = new Set(props.modelValue)
  if (groupAllSelected(perms)) perms.forEach((p) => set.delete(p))
  else perms.forEach((p) => set.add(p))
  emit('update:modelValue', [...set])
}

// الطيّ: يُتجاهل أثناء البحث (تظهر كل النتائج).
function isCollapsed(key: string): boolean {
  return !searching.value && collapsed.value.has(key)
}
function toggleCollapse(key: string): void {
  const set = new Set(collapsed.value)
  if (set.has(key)) set.delete(key)
  else set.add(key)
  collapsed.value = set
}
function collapseAll(): void {
  collapsed.value = new Set(groups.value.map(([key]) => key))
}
function expandAll(): void {
  collapsed.value = new Set()
}
const allCollapsed = computed(
  () => groups.value.length > 0 && groups.value.every(([key]) => collapsed.value.has(key)),
)
</script>

<template>
  <div class="space-y-4">
    <!-- البحث -->
    <div class="relative">
      <i class="pi pi-search pointer-events-none absolute top-1/2 z-10 -translate-y-1/2 text-surface-400 ltr:left-3 rtl:right-3" />
      <InputText
        v-model="query"
        :placeholder="t('permPicker.search')"
        class="w-full ltr:pl-9 rtl:pr-9"
      />
      <button
        v-if="query"
        type="button"
        class="absolute top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-surface-400 transition hover:bg-surface-100 hover:text-surface-700 ltr:right-2 rtl:left-2 dark:hover:bg-surface-700"
        :aria-label="t('common.cancel')"
        @click="query = ''"
      >
        <i class="pi pi-times text-xs" />
      </button>
    </div>

    <!-- شريط الإجراءات -->
    <div class="flex flex-wrap items-center justify-between gap-2 border-b border-surface-200 pb-3 dark:border-surface-700">
      <span class="text-sm text-surface-500">
        {{ t('permPicker.selected', { n: selectedCount, total: all.length }) }}
      </span>
      <div class="flex flex-wrap gap-2">
        <Button
          type="button"
          size="small"
          severity="secondary"
          text
          :icon="allCollapsed ? 'pi pi-angle-double-down' : 'pi pi-angle-double-up'"
          :label="allCollapsed ? t('permPicker.expandAll') : t('permPicker.collapseAll')"
          :disabled="!hasResults || searching"
          @click="allCollapsed ? expandAll() : collapseAll()"
        />
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

    <!-- لا نتائج -->
    <p v-if="!hasResults" class="py-8 text-center text-sm text-surface-500">
      {{ t('permPicker.noResults', { q: query }) }}
    </p>

    <!-- المجموعات -->
    <div
      v-for="[group, perms] in groups"
      :key="group"
      class="overflow-hidden rounded-xl border border-surface-200 dark:border-surface-700"
    >
      <!-- رأس المجموعة: طيّ + تحديد الكل + العدّاد -->
      <div
        class="flex items-center gap-2 bg-surface-50 px-3 py-2.5 dark:bg-surface-800/50"
        :class="isCollapsed(group) ? '' : 'border-b border-surface-200 dark:border-surface-700'"
      >
        <Checkbox
          :model-value="groupAllSelected(perms)"
          :binary="true"
          :disabled="disabled"
          :indeterminate="groupSelectedCount(perms) > 0 && !groupAllSelected(perms)"
          @update:model-value="toggleGroup(perms)"
          @click.stop
        />
        <button
          type="button"
          class="flex flex-1 items-center justify-between gap-2 text-start"
          @click="toggleCollapse(group)"
        >
          <span class="text-sm font-semibold text-surface-800 dark:text-surface-200">{{ groupLabel(group) }}</span>
          <span class="flex items-center gap-2">
            <span
              class="rounded-full px-2 py-0.5 text-xs font-medium"
              :class="groupSelectedCount(perms) > 0
                ? 'bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-300'
                : 'bg-surface-200 text-surface-500 dark:bg-surface-700 dark:text-surface-400'"
            >{{ groupSelectedCount(perms) }}/{{ perms.length }}</span>
            <i
              class="pi pi-chevron-down text-xs text-surface-400 transition-transform"
              :class="isCollapsed(group) ? 'rtl:rotate-90 ltr:-rotate-90' : ''"
            />
          </span>
        </button>
      </div>

      <!-- صلاحيات المجموعة (الإجراء فقط) -->
      <div v-if="!isCollapsed(group)" class="grid grid-cols-1 gap-x-4 gap-y-2.5 p-3 sm:grid-cols-2">
        <label
          v-for="perm in perms"
          :key="perm"
          class="flex cursor-pointer items-center gap-2 text-sm"
          :title="perm"
        >
          <Checkbox
            :model-value="isChecked(perm)"
            :binary="true"
            :disabled="disabled"
            @update:model-value="toggle(perm)"
          />
          <span class="text-surface-700 dark:text-surface-300">{{ actionLabel(perm) }}</span>
        </label>
      </div>
    </div>
  </div>
</template>
