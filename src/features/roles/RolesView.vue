<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ApiException } from '@/api/client'
import { rolesApi, permissionsApi, type Role } from '@/api/roles'
import PermissionPicker from '@/components/PermissionPicker.vue'

const { t } = useI18n()

const roles = ref<Role[]>([])
const allPermissions = ref<string[]>([])
const loading = ref(false)
const saving = ref(false)
const error = ref('')

const showForm = ref(false)
const editingId = ref<number | null>(null)
const form = reactive<{ name: string; permissions: string[] }>({ name: '', permissions: [] })

function messageFor(e: unknown, fallback: string): string {
  return e instanceof ApiException ? e.message : fallback
}

async function load(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const [r, p] = await Promise.all([rolesApi.list(), permissionsApi.list()])
    roles.value = r
    allPermissions.value = p
  } catch (e) {
    error.value = messageFor(e, t('common.loadError'))
  } finally {
    loading.value = false
  }
}

function openCreate(): void {
  editingId.value = null
  form.name = ''
  form.permissions = []
  showForm.value = true
}

function openEdit(role: Role): void {
  editingId.value = role.id
  form.name = role.name
  form.permissions = [...role.permissions]
  showForm.value = true
}

async function submit(): Promise<void> {
  saving.value = true
  error.value = ''
  try {
    if (editingId.value === null) {
      await rolesApi.create({ name: form.name, permissions: form.permissions })
    } else {
      await rolesApi.update(editingId.value, { name: form.name, permissions: form.permissions })
    }
    showForm.value = false
    await load()
  } catch (e) {
    error.value = messageFor(e, t('common.saveError'))
  } finally {
    saving.value = false
  }
}

async function remove(role: Role): Promise<void> {
  if (!window.confirm(t('roles.confirmDelete', { name: role.name }))) return
  error.value = ''
  try {
    await rolesApi.remove(role.id)
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
      <h1 class="text-2xl font-bold text-slate-900 dark:text-white">{{ t('roles.title') }}</h1>
      <button
        v-can="'roles.manage'"
        type="button"
        class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
        @click="openCreate"
      >
        {{ t('roles.create') }}
      </button>
    </div>

    <p v-if="error" class="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300" role="alert">{{ error }}</p>

    <form
      v-if="showForm"
      class="mb-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
      @submit.prevent="submit"
    >
      <h2 class="font-semibold">{{ editingId === null ? t('roles.create') : t('roles.edit') }}</h2>
      <label class="block text-sm">
        <span class="mb-1 block font-medium text-slate-700 dark:text-slate-300">{{ t('roles.name') }}</span>
        <input v-model="form.name" type="text" required class="w-full max-w-sm rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
      </label>
      <div>
        <p class="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">{{ t('roles.permissions') }}</p>
        <PermissionPicker v-model="form.permissions" :all="allPermissions" />
      </div>
      <div class="flex gap-3">
        <button type="submit" :disabled="saving" class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60">
          {{ saving ? t('common.saving') : t('common.save') }}
        </button>
        <button type="button" class="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400" @click="showForm = false">
          {{ t('common.cancel') }}
        </button>
      </div>
    </form>

    <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <p v-if="loading" class="p-6 text-sm text-slate-500">{{ t('common.loading') }}</p>
      <p v-else-if="!roles.length" class="p-6 text-sm text-slate-500">{{ t('roles.empty') }}</p>
      <table v-else class="w-full text-start text-sm">
        <thead class="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          <tr>
            <th class="px-4 py-3 text-start">{{ t('roles.name') }}</th>
            <th class="px-4 py-3 text-start">{{ t('roles.permissionsCount') }}</th>
            <th class="px-4 py-3 text-end">{{ t('companies.actions') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
          <tr v-for="role in roles" :key="role.id">
            <td class="px-4 py-3 font-medium text-slate-900 dark:text-white">{{ role.name }}</td>
            <td class="px-4 py-3 text-slate-500">{{ role.permissions.length }}</td>
            <td class="px-4 py-3">
              <div class="flex justify-end gap-3">
                <button v-can="'roles.manage'" type="button" class="text-slate-600 hover:underline dark:text-slate-300" @click="openEdit(role)">{{ t('common.edit') }}</button>
                <button v-can="'roles.manage'" type="button" class="text-rose-600 hover:underline dark:text-rose-400" @click="remove(role)">{{ t('common.delete') }}</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
