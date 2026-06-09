<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import DataTable, { type DataTablePageEvent } from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import MultiSelect from 'primevue/multiselect'
import Tag from 'primevue/tag'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
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
import PageHeader from '@/components/PageHeader.vue'

const { t } = useI18n()
const confirm = useConfirm()
const toast = useToast()

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
function notifyError(e: unknown, fallback: string): void {
  toast.add({ severity: 'error', summary: t('common.error'), detail: messageFor(e, fallback), life: 4000 })
}

async function loadUsers(): Promise<void> {
  loading.value = true
  try {
    const res = await usersApi.list({ search: search.value || undefined, page: page.value })
    users.value = res.data
    pagination.value = res.pagination ?? null
  } catch (e) {
    notifyError(e, t('common.loadError'))
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
    toast.add({ severity: 'success', summary: t('common.saved'), life: 2500 })
    await loadUsers()
  } catch (e) {
    notifyError(e, t('common.saveError'))
  } finally {
    saving.value = false
  }
}

function remove(u: User): void {
  confirm.require({
    message: t('users.confirmDelete', { name: u.name }),
    header: t('common.delete'),
    icon: 'pi pi-exclamation-triangle',
    acceptProps: { severity: 'danger', label: t('common.delete') },
    rejectProps: { severity: 'secondary', outlined: true, label: t('common.cancel') },
    accept: async () => {
      try {
        await usersApi.remove(u.id)
        toast.add({ severity: 'success', summary: t('common.deleted'), life: 2500 })
        await loadUsers()
      } catch (e) {
        notifyError(e, t('common.saveError'))
      }
    },
  })
}

function openPermissions(u: User): void {
  permUser.value = u
  directPermissions.value = []
}

async function saveDirectPermissions(): Promise<void> {
  if (!permUser.value) return
  saving.value = true
  try {
    await usersApi.syncDirectPermissions(permUser.value.id, directPermissions.value)
    permUser.value = null
    toast.add({ severity: 'success', summary: t('common.saved'), life: 2500 })
  } catch (e) {
    notifyError(e, t('common.saveError'))
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

// ترقيم من جهة الخادم: صفحة DataTable تُترجَم إلى رقم صفحة (1-based).
function onPage(e: DataTablePageEvent): void {
  goPage(e.page + 1)
}

function statusSeverity(status: UserStatus): string {
  if (status === 'active') return 'success'
  if (status === 'suspended') return 'warn'
  return 'secondary'
}

onMounted(() => {
  loadUsers()
  loadRefs()
})
</script>

<template>
  <div class="mx-auto max-w-5xl">
    <PageHeader :title="t('nav.users')">
      <template #actions>
        <Button v-can="'users.create'" :label="t('users.create')" icon="pi pi-plus" @click="openCreate" />
      </template>
    </PageHeader>

    <form class="mb-4 flex gap-2" @submit.prevent="doSearch">
      <IconField class="w-full max-w-xs">
        <InputIcon class="pi pi-search" />
        <InputText v-model="search" type="search" :placeholder="t('users.searchPlaceholder')" fluid />
      </IconField>
      <Button type="submit" :label="t('users.search')" severity="secondary" outlined />
    </form>

    <!-- الجدول -->
    <div class="overflow-hidden rounded-2xl border border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
      <DataTable
        :value="users"
        :loading="loading"
        lazy
        paginator
        :rows="pagination?.per_page ?? 10"
        :rows-per-page-options="[10, 20, 50]"
        :total-records="pagination?.total ?? 0"
        :first="((pagination?.current_page ?? 1) - 1) * (pagination?.per_page ?? 10)"
        data-key="id"
        striped-rows
        removable-sort
        @page="onPage"
      >
        <template #empty>
          <p class="py-6 text-center text-sm text-surface-500">{{ t('users.empty') }}</p>
        </template>

        <Column field="name" :header="t('users.name')" sortable>
          <template #body="{ data }">
            <span class="font-medium text-surface-900 dark:text-white">{{ data.name }}</span>
          </template>
        </Column>
        <Column field="employee_no" :header="t('users.employeeNo')">
          <template #body="{ data }">
            <span class="font-mono text-xs text-surface-500">{{ data.employee_no || '—' }}</span>
          </template>
        </Column>
        <Column field="email" :header="t('users.email')">
          <template #body="{ data }">
            <span class="text-surface-500">{{ data.email || '—' }}</span>
          </template>
        </Column>
        <Column field="status" :header="t('users.status')">
          <template #body="{ data }">
            <Tag :value="t('userStatus.' + data.status)" :severity="statusSeverity(data.status)" />
          </template>
        </Column>
        <Column field="roles" :header="t('users.roles')">
          <template #body="{ data }">
            <span class="text-xs text-surface-500">{{ data.roles.join('، ') || '—' }}</span>
          </template>
        </Column>
        <Column :header="t('companies.actions')" class="text-end">
          <template #body="{ data }">
            <div class="flex justify-end gap-1">
              <Button
                v-can="'permissions.assign'"
                v-tooltip.top="t('users.permissions')"
                icon="pi pi-key"
                severity="warn"
                text
                rounded
                @click="openPermissions(data)"
              />
              <Button
                v-can="'users.update'"
                v-tooltip.top="t('common.edit')"
                icon="pi pi-pencil"
                severity="secondary"
                text
                rounded
                @click="openEdit(data)"
              />
              <Button
                v-can="'users.delete'"
                v-tooltip.top="t('common.delete')"
                icon="pi pi-trash"
                severity="danger"
                text
                rounded
                @click="remove(data)"
              />
            </div>
          </template>
        </Column>
      </DataTable>
    </div>

    <!-- نموذج المستخدم -->
    <Dialog
      v-model:visible="showForm"
      modal
      :header="editingId === null ? t('users.create') : t('users.edit')"
      :style="{ width: '36rem' }"
      :breakpoints="{ '640px': '95vw' }"
    >
      <form class="grid gap-4 pt-2 sm:grid-cols-2" @submit.prevent="submit">
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('users.name') }}</span>
          <InputText v-model="form.name" type="text" required fluid />
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('users.employeeNo') }}</span>
          <InputText v-model="form.employee_no" type="text" required fluid />
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('users.email') }}</span>
          <InputText v-model="form.email" type="email" required fluid />
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('users.phone') }}</span>
          <InputText v-model="form.phone" type="text" fluid />
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">
            {{ t('users.password') }}
            <span v-if="editingId !== null" class="text-xs text-surface-500">({{ t('users.passwordKeep') }})</span>
          </span>
          <InputText v-model="form.password" type="password" :required="editingId === null" autocomplete="new-password" fluid />
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('users.department') }}</span>
          <Select
            v-model="form.department_id"
            :options="departments"
            option-label="name"
            option-value="id"
            :placeholder="t('users.noDepartment')"
            show-clear
            fluid
          />
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('users.status') }}</span>
          <Select
            v-model="form.status"
            :options="STATUSES"
            :option-label="(s) => t('userStatus.' + s)"
            fluid
          />
        </label>
        <label class="block text-sm sm:col-span-2">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('users.roles') }}</span>
          <MultiSelect
            v-model="form.roles"
            :options="roles"
            option-label="name"
            option-value="name"
            :placeholder="t('users.noRoles')"
            display="chip"
            filter
            show-clear
            fluid
          />
        </label>

        <div class="mt-2 flex justify-end gap-2 sm:col-span-2">
          <Button type="button" :label="t('common.cancel')" severity="secondary" text @click="showForm = false" />
          <Button type="submit" :label="saving ? t('common.saving') : t('common.save')" icon="pi pi-check" :loading="saving" />
        </div>
      </form>
    </Dialog>

    <!-- محرّر الصلاحيات المباشرة -->
    <Dialog
      :visible="permUser !== null"
      modal
      :header="permUser ? t('users.directPermissionsFor', { name: permUser.name }) : ''"
      :style="{ width: '36rem' }"
      :breakpoints="{ '640px': '95vw' }"
      @update:visible="(v) => { if (!v) permUser = null }"
    >
      <div class="space-y-4 pt-2">
        <Tag severity="warn" :value="t('users.directPermissionsWarning')" class="!whitespace-normal !text-start" />
        <PermissionPicker v-model="directPermissions" :all="allPermissions" />
        <div class="mt-2 flex justify-end gap-2">
          <Button type="button" :label="t('common.cancel')" severity="secondary" text @click="permUser = null" />
          <Button
            type="button"
            :label="saving ? t('common.saving') : t('common.save')"
            icon="pi pi-check"
            :loading="saving"
            @click="saveDirectPermissions"
          />
        </div>
      </div>
    </Dialog>
  </div>
</template>
