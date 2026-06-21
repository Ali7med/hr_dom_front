<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import Select from 'primevue/select'
import Message from 'primevue/message'
import PageHeader from '@/components/PageHeader.vue'
import { ApiException } from '@/api/client'
import { usersApi, type User } from '@/api/users'
import { saveBlob } from '@/api/reports'
import { officialDocumentsApi, type OfficialDocType } from '@/api/officialDocuments'

const { t } = useI18n()
const toast = useToast()

const users = ref<User[]>([])
const loadingUsers = ref(false)
const generating = ref(false)

const docTypes: { value: OfficialDocType; key: string }[] = [
  { value: 'salary-certificate', key: 'officialDocuments.salaryCertificate' },
  { value: 'employment-letter', key: 'officialDocuments.employmentLetter' },
]

const form = reactive({
  user_id: 0,
  type: 'salary-certificate' as OfficialDocType,
  period: '', // YYYY-MM — لشهادة الراتب فقط (فارغ = أحدث كشف).
})

const isSalaryCert = computed(() => form.type === 'salary-certificate')
const selectedUser = computed(() => users.value.find((u) => u.id === form.user_id))
const canGenerate = computed(() => !!form.user_id && !generating.value)

async function loadUsers(): Promise<void> {
  loadingUsers.value = true
  try {
    const res = await usersApi.list({ per_page: 200, status: 'active' })
    users.value = res.data
  } catch {
    // قائمة الموظفين اختيارية للتحميل — تُعرَض رسالة عند الفشل.
    toast.add({ severity: 'error', summary: t('common.error'), detail: t('common.loadError'), life: 4000 })
  } finally {
    loadingUsers.value = false
  }
}

function fileName(): string {
  const u = selectedUser.value
  const who = u?.employee_no || u?.id || form.user_id
  const suffix = isSalaryCert.value && form.period ? `-${form.period}` : ''
  return `${form.type}-${who}${suffix}.pdf`
}

async function generate(): Promise<void> {
  if (!canGenerate.value) return
  generating.value = true
  try {
    const period = isSalaryCert.value && form.period ? form.period : undefined
    const blob = await officialDocumentsApi.downloadForUser(form.user_id, form.type, period)
    saveBlob(blob, fileName())
    toast.add({ severity: 'success', summary: t('officialDocuments.generated'), life: 2500 })
  } catch (e) {
    // التنزيل blob فالرسالة الموحّدة عامّة — نُعيّن حسب رمز الحالة.
    const status = e instanceof ApiException ? e.status : undefined
    const detail =
      status === 404
        ? t('officialDocuments.notAvailable')
        : status === 422
          ? t('officialDocuments.unsupportedType')
          : t('officialDocuments.generateError')
    toast.add({ severity: 'error', summary: t('common.error'), detail, life: 4500 })
  } finally {
    generating.value = false
  }
}

onMounted(loadUsers)
</script>

<template>
  <div class="mx-auto max-w-2xl">
    <PageHeader :title="t('officialDocuments.title')" :subtitle="t('officialDocuments.subtitle')" />

    <Message severity="info" :closable="false" class="mb-5">{{ t('officialDocuments.note') }}</Message>

    <div class="rounded-2xl border border-surface-200 bg-white p-6 dark:border-surface-800 dark:bg-surface-900">
      <div class="grid gap-4">
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('officialDocuments.employee') }}</span>
          <Select
            v-model.number="form.user_id"
            :options="users"
            option-label="name"
            option-value="id"
            filter
            :loading="loadingUsers"
            :placeholder="t('officialDocuments.selectEmployee')"
            fluid
          >
            <template #option="{ option }">
              <div class="flex flex-col">
                <span>{{ option.name }}</span>
                <span v-if="option.employee_no" class="text-xs text-surface-500" dir="ltr">{{ option.employee_no }}</span>
              </div>
            </template>
          </Select>
        </label>

        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('officialDocuments.docType') }}</span>
          <Select v-model="form.type" :options="docTypes" option-value="value" fluid>
            <template #value="{ value }">{{ t(docTypes.find((d) => d.value === value)?.key ?? '') }}</template>
            <template #option="{ option }">{{ t(option.key) }}</template>
          </Select>
        </label>

        <!-- الفترة لشهادة الراتب فقط (اختيارية) -->
        <label v-if="isSalaryCert" class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('officialDocuments.period') }}</span>
          <input v-model="form.period" type="month" class="field" />
          <span class="mt-1 block text-xs text-surface-500">{{ t('officialDocuments.periodHint') }}</span>
        </label>

        <div class="mt-1 flex justify-end">
          <Button
            icon="pi pi-file-pdf"
            :label="generating ? t('common.loading') : t('officialDocuments.generate')"
            :loading="generating"
            :disabled="!canGenerate"
            @click="generate"
          />
        </div>
      </div>
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
