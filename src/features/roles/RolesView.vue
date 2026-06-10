<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Dialog from '@/components/AppDialog.vue'
import InputText from 'primevue/inputtext'
import Tag from 'primevue/tag'
import { ApiException } from '@/api/client'
import { rolesApi, permissionsApi, type Role } from '@/api/roles'
import PageHeader from '@/components/PageHeader.vue'
import PermissionPicker from '@/components/PermissionPicker.vue'

const { t } = useI18n()
const confirm = useConfirm()
const toast = useToast()

const roles = ref<Role[]>([])
const allPermissions = ref<string[]>([])
const loading = ref(false)
const saving = ref(false)

const showForm = ref(false)
const editingId = ref<number | null>(null)
const form = reactive<{ name: string; permissions: string[] }>({ name: '', permissions: [] })

function messageFor(e: unknown, fallback: string): string {
  return e instanceof ApiException ? e.message : fallback
}
function notifyError(e: unknown, fallback: string): void {
  toast.add({ severity: 'error', summary: t('common.error'), detail: messageFor(e, fallback), life: 4000 })
}

async function load(): Promise<void> {
  loading.value = true
  try {
    const [r, p] = await Promise.all([rolesApi.list(), permissionsApi.list()])
    roles.value = r
    allPermissions.value = p
  } catch (e) {
    notifyError(e, t('common.loadError'))
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
  try {
    if (editingId.value === null) {
      await rolesApi.create({ name: form.name, permissions: form.permissions })
    } else {
      await rolesApi.update(editingId.value, { name: form.name, permissions: form.permissions })
    }
    showForm.value = false
    toast.add({ severity: 'success', summary: t('common.saved'), life: 2500 })
    await load()
  } catch (e) {
    notifyError(e, t('common.saveError'))
  } finally {
    saving.value = false
  }
}

function remove(role: Role): void {
  confirm.require({
    message: t('roles.confirmDelete', { name: role.name }),
    header: t('common.delete'),
    icon: 'pi pi-exclamation-triangle',
    acceptProps: { severity: 'danger', label: t('common.delete') },
    rejectProps: { severity: 'secondary', outlined: true, label: t('common.cancel') },
    accept: async () => {
      try {
        await rolesApi.remove(role.id)
        toast.add({ severity: 'success', summary: t('common.deleted'), life: 2500 })
        await load()
      } catch (e) {
        notifyError(e, t('common.saveError'))
      }
    },
  })
}

onMounted(load)
</script>

<template>
  <div class="mx-auto max-w-4xl">
    <PageHeader :title="t('roles.title')">
      <template #actions>
        <Button v-can="'roles.create'" :label="t('roles.create')" icon="pi pi-plus" @click="openCreate" />
      </template>
    </PageHeader>

    <div class="overflow-hidden rounded-2xl border border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
      <DataTable
        :value="roles"
        :loading="loading"
        paginator
        :rows="10"
        :rows-per-page-options="[10, 20, 50]"
        data-key="id"
        striped-rows
        removable-sort
      >
        <template #empty>
          <p class="py-6 text-center text-sm text-surface-500">{{ t('roles.empty') }}</p>
        </template>

        <Column field="name" :header="t('roles.name')" sortable>
          <template #body="{ data }">
            <span class="font-medium text-surface-900 dark:text-white">{{ data.name }}</span>
          </template>
        </Column>
        <Column :header="t('roles.permissionsCount')">
          <template #body="{ data }">
            <Tag :value="String(data.permissions.length)" severity="secondary" />
          </template>
        </Column>
        <Column :header="t('companies.actions')" class="text-end">
          <template #body="{ data }">
            <div class="flex justify-end gap-1">
              <Button
                v-can="'roles.update'"
                v-tooltip.top="t('common.edit')"
                icon="pi pi-pencil"
                severity="secondary"
                text
                rounded
                @click="openEdit(data)"
              />
              <Button
                v-can="'roles.delete'"
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

    <!-- نموذج الإنشاء/التعديل -->
    <Dialog
      v-model:visible="showForm"
      modal
      :header="editingId === null ? t('roles.create') : t('roles.edit')"
      :style="{ width: '48rem' }"
      :breakpoints="{ '960px': '95vw' }"
    >
      <form class="space-y-4 pt-2" @submit.prevent="submit">
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('roles.name') }}</span>
          <InputText v-model="form.name" required fluid />
        </label>
        <div>
          <p class="mb-2 text-sm font-medium text-surface-700 dark:text-surface-300">{{ t('roles.permissions') }}</p>
          <PermissionPicker v-model="form.permissions" :all="allPermissions" />
        </div>

        <div class="mt-2 flex justify-end gap-2">
          <Button type="button" :label="t('common.cancel')" severity="secondary" text @click="showForm = false" />
          <Button type="submit" :label="saving ? t('common.saving') : t('common.save')" icon="pi pi-check" :loading="saving" />
        </div>
      </form>
    </Dialog>
  </div>
</template>
