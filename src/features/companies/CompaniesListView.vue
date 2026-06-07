<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ApiException } from '@/api/client'
import { companiesApi, type Company } from '@/api/companies'

const { t } = useI18n()

const companies = ref<Company[]>([])
const loading = ref(false)
const error = ref('')
const saving = ref(false)

// نموذج الإنشاء/التعديل.
const showForm = ref(false)
const editingId = ref<number | null>(null)
const form = reactive({
  name: '',
  slug: '',
  timezone: '',
  base_currency_id: null as number | null,
  source_company_id: null as number | null,
})

function messageFor(e: unknown, fallback: string): string {
  return e instanceof ApiException ? e.message : fallback
}

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    companies.value = await companiesApi.list()
  } catch (e) {
    error.value = messageFor(e, t('common.loadError'))
  } finally {
    loading.value = false
  }
}

function openCreate(): void {
  editingId.value = null
  form.name = ''
  form.slug = ''
  form.timezone = ''
  form.base_currency_id = null
  form.source_company_id = null
  showForm.value = true
}

function openEdit(c: Company): void {
  editingId.value = c.id
  form.name = c.name
  form.slug = c.slug
  form.timezone = c.timezone ?? ''
  form.base_currency_id = c.base_currency_id
  form.source_company_id = null
  showForm.value = true
}

async function submit(): Promise<void> {
  saving.value = true
  error.value = ''
  try {
    if (editingId.value === null) {
      await companiesApi.create({
        name: form.name,
        slug: form.slug,
        timezone: form.timezone || null,
        base_currency_id: form.base_currency_id,
        source_company_id: form.source_company_id,
      })
    } else {
      await companiesApi.update(editingId.value, {
        name: form.name,
        slug: form.slug,
        timezone: form.timezone || null,
        base_currency_id: form.base_currency_id,
      })
    }
    showForm.value = false
    await load()
  } catch (e) {
    error.value = messageFor(e, t('common.saveError'))
  } finally {
    saving.value = false
  }
}

async function remove(c: Company): Promise<void> {
  if (!window.confirm(t('companies.confirmDelete', { name: c.name }))) return
  error.value = ''
  try {
    await companiesApi.remove(c.id)
    await load()
  } catch (e) {
    error.value = messageFor(e, t('common.saveError'))
  }
}

onMounted(load)
</script>

<template>
  <div class="mx-auto max-w-4xl">
    <div class="mb-6 flex items-center justify-between gap-4">
      <h1 class="text-2xl font-bold text-slate-900 dark:text-white">{{ t('companies.title') }}</h1>
      <button
        v-can="'companies.manage'"
        type="button"
        class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
        @click="openCreate"
      >
        {{ t('companies.create') }}
      </button>
    </div>

    <p
      v-if="error"
      class="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300"
      role="alert"
    >
      {{ error }}
    </p>

    <!-- نموذج الإنشاء/التعديل -->
    <form
      v-if="showForm"
      class="mb-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
      @submit.prevent="submit"
    >
      <h2 class="font-semibold">
        {{ editingId === null ? t('companies.create') : t('companies.edit') }}
      </h2>
      <div class="grid gap-4 sm:grid-cols-2">
        <label class="block text-sm">
          <span class="mb-1 block font-medium text-slate-700 dark:text-slate-300">{{ t('companies.name') }}</span>
          <input v-model="form.name" type="text" required class="field" />
        </label>
        <label class="block text-sm">
          <span class="mb-1 block font-medium text-slate-700 dark:text-slate-300">{{ t('companies.slug') }}</span>
          <input v-model="form.slug" type="text" required class="field" />
        </label>
        <label class="block text-sm">
          <span class="mb-1 block font-medium text-slate-700 dark:text-slate-300">{{ t('companies.timezone') }}</span>
          <input v-model="form.timezone" type="text" placeholder="Asia/Baghdad" class="field" />
        </label>
        <label class="block text-sm">
          <span class="mb-1 block font-medium text-slate-700 dark:text-slate-300">{{ t('companies.baseCurrencyId') }}</span>
          <input v-model.number="form.base_currency_id" type="number" min="1" class="field" />
        </label>
        <label v-if="editingId === null && companies.length" class="block text-sm sm:col-span-2">
          <span class="mb-1 block font-medium text-slate-700 dark:text-slate-300">{{ t('companies.fromTemplate') }}</span>
          <select v-model.number="form.source_company_id" class="field">
            <option :value="null">{{ t('companies.noTemplate') }}</option>
            <option v-for="c in companies" :key="c.id" :value="c.id">{{ c.name }}</option>
          </select>
        </label>
      </div>
      <div class="flex gap-3">
        <button
          type="submit"
          :disabled="saving"
          class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
        >
          {{ saving ? t('common.saving') : t('common.save') }}
        </button>
        <button type="button" class="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400" @click="showForm = false">
          {{ t('common.cancel') }}
        </button>
      </div>
    </form>

    <!-- الجدول -->
    <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <p v-if="loading" class="p-6 text-sm text-slate-500">{{ t('common.loading') }}</p>
      <p v-else-if="!companies.length" class="p-6 text-sm text-slate-500">{{ t('companies.empty') }}</p>
      <table v-else class="w-full text-start text-sm">
        <thead class="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          <tr>
            <th class="px-4 py-3 text-start">{{ t('companies.name') }}</th>
            <th class="px-4 py-3 text-start">{{ t('companies.slug') }}</th>
            <th class="px-4 py-3 text-start">{{ t('companies.timezone') }}</th>
            <th class="px-4 py-3 text-start">{{ t('companies.status') }}</th>
            <th class="px-4 py-3 text-end">{{ t('companies.actions') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
          <tr v-for="c in companies" :key="c.id">
            <td class="px-4 py-3 font-medium text-slate-900 dark:text-white">{{ c.name }}</td>
            <td class="px-4 py-3 font-mono text-xs text-slate-500">{{ c.slug }}</td>
            <td class="px-4 py-3 text-slate-500">{{ c.timezone || '—' }}</td>
            <td class="px-4 py-3">
              <span
                class="rounded-full px-2 py-0.5 text-xs"
                :class="c.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'"
              >
                {{ c.is_active ? t('companies.active') : t('companies.inactive') }}
              </span>
            </td>
            <td class="px-4 py-3">
              <div class="flex justify-end gap-3">
                <RouterLink :to="{ name: 'company-settings', params: { id: c.id } }" class="text-indigo-600 hover:underline dark:text-indigo-400">
                  {{ t('companies.settings') }}
                </RouterLink>
                <button v-can="'companies.manage'" type="button" class="text-slate-600 hover:underline dark:text-slate-300" @click="openEdit(c)">
                  {{ t('common.edit') }}
                </button>
                <button v-can="'companies.manage'" type="button" class="text-rose-600 hover:underline dark:text-rose-400" @click="remove(c)">
                  {{ t('common.delete') }}
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.field {
  width: 100%;
  border-radius: 0.5rem;
  border: 1px solid rgb(203 213 225);
  background: #fff;
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  color: rgb(15 23 42);
  outline: none;
}
.field:focus {
  border-color: rgb(99 102 241);
  box-shadow: 0 0 0 2px rgb(99 102 241 / 0.3);
}
:global(.dark) .field {
  border-color: rgb(51 65 85);
  background: rgb(30 41 59);
  color: #fff;
}
</style>
