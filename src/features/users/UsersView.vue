<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ApiException } from '@/api/client'
import {
  usersApi,
  departmentsApi,
  type User,
  type Department,
  type Pagination,
  type UserStatus,
} from '@/api/users'
import { rolesApi, permissionsApi, type Role } from '@/api/roles'
import PermissionPicker from '@/components/PermissionPicker.vue'

const { t } = useI18n()

const STATUSES: UserStatus[] = ['active', 'suspended', 'left']

const users = ref<User[]>([])
const departments = ref<Department[]>([])
const roles = ref<Role[]>([])
const allPermissions = ref<string[]>([])
const pagination = ref<Pagination | null>(null)
const search = ref('')
const page = ref(1)

const loading = ref(false)
const saving = ref(false)
const error = ref('')

// نموذج إنشاء/تعديل المستخدم.
const showForm = ref(false)
const editingId = ref<number | null>(null)
const form = reactive({
  name: '',
  employee_no: '',
  email: '',
  phone: '',
  password: '',
  department_id: null as number | null,
  status: 'active' as UserStatus,
  roles: [] as string[],
})

// محرّر الصلاحيات المباشرة (يستبدل الصلاحيات المباشرة بالكامل).
const permUser = ref<User | null>(null)
const directPermissions = ref<string[]>([])

function messageFor(e: unknown, fallback: string): string {
  return e instanceof ApiException ? e.message : fallback
}

async function loadUsers(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const res = await usersApi.list({ search: search.value || undefined, page: page.value })
    users.value = res.data
    pagination.value = res.pagination ?? null
  } catch (e) {
    error.value = messageFor(e, t('common.loadError'))
  } finally {
    loading.value = false
  }
}

async function loadRefs(): Promise<void> {
  try {
    const [d, r, p] = await Promise.all([
      departmentsApi.list(),
      rolesApi.list(),
      permissionsApi.list(),
    ])
    departments.value = d
    roles.value = r
    allPermissions.value = p
  } catch {
    // المراجع اختيارية للعرض؛ تجاهل الأخطاء غير الحرجة.
  }
}

function toggleRole(name: string): void {
  const i = form.roles.indexOf(name)
  if (i === -1) form.roles.push(name)
  else form.roles.splice(i, 1)
}

function openCreate(): void {
  editingId.value = null
  Object.assign(form, {
    name: '', employee_no: '', email: '', phone: '', password: '',
    department_id: null, status: 'active' as UserStatus, roles: [] as string[],
  })
  showForm.value = true
}

function openEdit(u: User): void {
  editingId.value = u.id
  Object.assign(form, {
    name: u.name, employee_no: u.employee_no ?? '', email: u.email ?? '',
    phone: u.phone ?? '', password: '', department_id: u.department_id,
    status: u.status, roles: [...u.roles],
  })
  showForm.value = true
}

async function submit(): Promise<void> {
  saving.value = true
  error.value = ''
  try {
    if (editingId.value === null) {
      await usersApi.create({
        name: form.name, employee_no: form.employee_no, email: form.email,
        phone: form.phone || null, password: form.password,
        department_id: form.department_id, status: form.status, roles: form.roles,
      })
    } else {
      const payload: Record<string, unknown> = {
        name: form.name, employee_no: form.employee_no, email: form.email,
        phone: form.phone || null, department_id: form.department_id,
        status: form.status, roles: form.roles,
      }
      if (form.password) payload.password = form.password
      await usersApi.update(editingId.value, payload)
    }
    showForm.value = false
    await loadUsers()
  } catch (e) {
    error.value = messageFor(e, t('common.saveError'))
  } finally {
    saving.value = false
  }
}

async function remove(u: User): Promise<void> {
  if (!window.confirm(t('users.confirmDelete', { name: u.name }))) return
  error.value = ''
  try {
    await usersApi.remove(u.id)
    await loadUsers()
  } catch (e) {
    error.value = messageFor(e, t('common.saveError'))
  }
}

function openPermissions(u: User): void {
  permUser.value = u
  directPermissions.value = []
}

async function saveDirectPermissions(): Promise<void> {
  if (!permUser.value) return
  saving.value = true
  error.value = ''
  try {
    await usersApi.syncDirectPermissions(permUser.value.id, directPermissions.value)
    permUser.value = null
  } catch (e) {
    error.value = messageFor(e, t('common.saveError'))
  } finally {
    saving.value = false
  }
}

function doSearch(): void {
  page.value = 1
  loadUsers()
}

function goPage(p: number): void {
  page.value = p
  loadUsers()
}

onMounted(() => {
  loadUsers()
  loadRefs()
})
</script>

<template>
  <div class="mx-auto max-w-5xl">
    <div class="mb-6 flex items-center justify-between gap-4">
      <h1 class="text-2xl font-bold text-slate-900 dark:text-white">{{ t('nav.users') }}</h1>
      <button
        v-can="'users.manage'"
        type="button"
        class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
        @click="openCreate"
      >
        {{ t('users.create') }}
      </button>
    </div>

    <form class="mb-4 flex gap-2" @submit.prevent="doSearch">
      <input v-model="search" type="search" :placeholder="t('users.searchPlaceholder')" class="w-full max-w-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
      <button type="submit" class="rounded-lg border border-slate-300 px-4 py-2 text-sm dark:border-slate-700">{{ t('users.search') }}</button>
    </form>

    <p v-if="error" class="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300" role="alert">{{ error }}</p>

    <!-- نموذج المستخدم -->
    <form v-if="showForm" class="mb-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900" @submit.prevent="submit">
      <h2 class="font-semibold">{{ editingId === null ? t('users.create') : t('users.edit') }}</h2>
      <div class="grid gap-4 sm:grid-cols-2">
        <label class="block text-sm"><span class="lbl">{{ t('users.name') }}</span><input v-model="form.name" type="text" required class="field" /></label>
        <label class="block text-sm"><span class="lbl">{{ t('users.employeeNo') }}</span><input v-model="form.employee_no" type="text" required class="field" /></label>
        <label class="block text-sm"><span class="lbl">{{ t('users.email') }}</span><input v-model="form.email" type="email" required class="field" /></label>
        <label class="block text-sm"><span class="lbl">{{ t('users.phone') }}</span><input v-model="form.phone" type="text" class="field" /></label>
        <label class="block text-sm">
          <span class="lbl">{{ t('users.password') }} <span v-if="editingId !== null" class="text-xs text-slate-400">({{ t('users.passwordKeep') }})</span></span>
          <input v-model="form.password" type="password" :required="editingId === null" autocomplete="new-password" class="field" />
        </label>
        <label class="block text-sm">
          <span class="lbl">{{ t('users.department') }}</span>
          <select v-model.number="form.department_id" class="field">
            <option :value="null">{{ t('users.noDepartment') }}</option>
            <option v-for="d in departments" :key="d.id" :value="d.id">{{ d.name }}</option>
          </select>
        </label>
        <label class="block text-sm">
          <span class="lbl">{{ t('users.status') }}</span>
          <select v-model="form.status" class="field">
            <option v-for="s in STATUSES" :key="s" :value="s">{{ t('userStatus.' + s) }}</option>
          </select>
        </label>
      </div>
      <div>
        <p class="lbl">{{ t('users.roles') }}</p>
        <div class="flex flex-wrap gap-3">
          <span v-if="!roles.length" class="text-xs text-slate-400">{{ t('users.noRoles') }}</span>
          <label v-for="r in roles" :key="r.id" class="flex items-center gap-2 text-sm">
            <input type="checkbox" class="size-4" :checked="form.roles.includes(r.name)" @change="toggleRole(r.name)" />
            {{ r.name }}
          </label>
        </div>
      </div>
      <div class="flex gap-3">
        <button type="submit" :disabled="saving" class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60">{{ saving ? t('common.saving') : t('common.save') }}</button>
        <button type="button" class="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400" @click="showForm = false">{{ t('common.cancel') }}</button>
      </div>
    </form>

    <!-- محرّر الصلاحيات المباشرة -->
    <div v-if="permUser" class="mb-6 space-y-4 rounded-2xl border border-amber-300 bg-amber-50/50 p-6 dark:border-amber-800 dark:bg-amber-950/30">
      <h2 class="font-semibold">{{ t('users.directPermissionsFor', { name: permUser.name }) }}</h2>
      <p class="rounded-lg bg-amber-100 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900 dark:text-amber-200">{{ t('users.directPermissionsWarning') }}</p>
      <PermissionPicker v-model="directPermissions" :all="allPermissions" />
      <div class="flex gap-3">
        <button type="button" :disabled="saving" class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60" @click="saveDirectPermissions">{{ saving ? t('common.saving') : t('common.save') }}</button>
        <button type="button" class="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400" @click="permUser = null">{{ t('common.cancel') }}</button>
      </div>
    </div>

    <!-- الجدول -->
    <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <p v-if="loading" class="p-6 text-sm text-slate-500">{{ t('common.loading') }}</p>
      <p v-else-if="!users.length" class="p-6 text-sm text-slate-500">{{ t('users.empty') }}</p>
      <table v-else class="w-full text-start text-sm">
        <thead class="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">
          <tr>
            <th class="px-4 py-3 text-start">{{ t('users.name') }}</th>
            <th class="px-4 py-3 text-start">{{ t('users.employeeNo') }}</th>
            <th class="px-4 py-3 text-start">{{ t('users.email') }}</th>
            <th class="px-4 py-3 text-start">{{ t('users.status') }}</th>
            <th class="px-4 py-3 text-start">{{ t('users.roles') }}</th>
            <th class="px-4 py-3 text-end">{{ t('companies.actions') }}</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
          <tr v-for="u in users" :key="u.id">
            <td class="px-4 py-3 font-medium text-slate-900 dark:text-white">{{ u.name }}</td>
            <td class="px-4 py-3 font-mono text-xs text-slate-500">{{ u.employee_no || '—' }}</td>
            <td class="px-4 py-3 text-slate-500">{{ u.email || '—' }}</td>
            <td class="px-4 py-3">{{ t('userStatus.' + u.status) }}</td>
            <td class="px-4 py-3 text-xs text-slate-500">{{ u.roles.join('، ') || '—' }}</td>
            <td class="px-4 py-3">
              <div class="flex justify-end gap-3">
                <button v-can="'permissions.assign'" type="button" class="text-amber-600 hover:underline dark:text-amber-400" @click="openPermissions(u)">{{ t('users.permissions') }}</button>
                <button v-can="'users.manage'" type="button" class="text-slate-600 hover:underline dark:text-slate-300" @click="openEdit(u)">{{ t('common.edit') }}</button>
                <button v-can="'users.manage'" type="button" class="text-rose-600 hover:underline dark:text-rose-400" @click="remove(u)">{{ t('common.delete') }}</button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- ترقيم -->
    <div v-if="pagination && pagination.last_page > 1" class="mt-4 flex items-center justify-center gap-3 text-sm">
      <button :disabled="page <= 1" class="rounded-lg border border-slate-300 px-3 py-1 disabled:opacity-40 dark:border-slate-700" @click="goPage(page - 1)">‹</button>
      <span>{{ pagination.current_page }} / {{ pagination.last_page }}</span>
      <button :disabled="page >= pagination.last_page" class="rounded-lg border border-slate-300 px-3 py-1 disabled:opacity-40 dark:border-slate-700" @click="goPage(page + 1)">›</button>
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
.lbl {
  margin-bottom: 0.25rem;
  display: block;
  font-weight: 500;
  font-size: 0.875rem;
  color: rgb(51 65 85);
}
:global(.dark) .lbl {
  color: rgb(203 213 225);
}
</style>
