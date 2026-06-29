<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useToast } from 'primevue/usetoast'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Password from 'primevue/password'
import PageHeader from '@/components/PageHeader.vue'
import { ApiException } from '@/api/client'
import { useAuthStore } from '@/stores/auth'
import { accountApi } from '@/api/account'

const { t } = useI18n()
const toast = useToast()
const auth = useAuthStore()

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function notifyError(e: unknown, fallback: string): void {
  // BE-97 قد لا يكون منشوراً بعد (404/405) — نعرض الرسالة فقط دون انكسار.
  const msg = e instanceof ApiException ? e.message : fallback
  toast.add({ severity: 'error', summary: t('common.error'), detail: msg, life: 4000 })
}

// ===== بطاقة كلمة المرور =====
const pwForm = reactive({ current: '', next: '', confirm: '' })
const changingPassword = ref(false)

async function submitPassword(): Promise<void> {
  if (!pwForm.current || !pwForm.next || !pwForm.confirm) {
    toast.add({ severity: 'warn', summary: t('common.error'), detail: t('account.requiredField'), life: 4000 })
    return
  }
  if (pwForm.next.length < 8) {
    toast.add({ severity: 'warn', summary: t('common.error'), detail: t('account.passwordTooShort'), life: 4000 })
    return
  }
  if (pwForm.next !== pwForm.confirm) {
    toast.add({ severity: 'warn', summary: t('common.error'), detail: t('account.passwordMismatch'), life: 4000 })
    return
  }
  changingPassword.value = true
  try {
    await accountApi.changePassword({
      current_password: pwForm.current,
      new_password: pwForm.next,
      new_password_confirmation: pwForm.confirm,
    })
    pwForm.current = ''
    pwForm.next = ''
    pwForm.confirm = ''
    toast.add({ severity: 'success', summary: t('account.passwordChanged'), life: 3000 })
  } catch (e) {
    notifyError(e, t('common.saveError'))
  } finally {
    changingPassword.value = false
  }
}

// ===== بطاقة الإيميل =====
const emailForm = reactive({ next: '', password: '' })
const changingEmail = ref(false)

async function submitEmail(): Promise<void> {
  if (!emailForm.next || !emailForm.password) {
    toast.add({ severity: 'warn', summary: t('common.error'), detail: t('account.requiredField'), life: 4000 })
    return
  }
  if (!EMAIL_RE.test(emailForm.next.trim())) {
    toast.add({ severity: 'warn', summary: t('common.error'), detail: t('account.emailInvalid'), life: 4000 })
    return
  }
  changingEmail.value = true
  try {
    await accountApi.changeEmail({
      new_email: emailForm.next.trim(),
      current_password: emailForm.password,
    })
    // تحديث المستخدم الحالي من /auth/me ليعكس الإيميل الجديد.
    await auth.fetchUser()
    emailForm.next = ''
    emailForm.password = ''
    toast.add({ severity: 'success', summary: t('account.emailChanged'), life: 3000 })
  } catch (e) {
    notifyError(e, t('common.saveError'))
  } finally {
    changingEmail.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-3xl">
    <PageHeader :title="t('account.title')" />

    <div class="grid gap-6 lg:grid-cols-2">
      <!-- بطاقة كلمة المرور -->
      <section class="rounded-2xl border border-surface-200 bg-white p-5 dark:border-surface-800 dark:bg-surface-900">
        <div class="mb-4 flex items-center gap-3">
          <span class="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-500/15 dark:text-primary-300">
            <i class="pi pi-lock text-xl" />
          </span>
          <div class="min-w-0">
            <h2 class="text-sm font-semibold text-surface-800 dark:text-surface-100">{{ t('account.passwordTitle') }}</h2>
            <p class="text-xs text-surface-500">{{ t('account.passwordDesc') }}</p>
          </div>
        </div>
        <div class="grid gap-4">
          <label class="block text-sm">
            <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('account.currentPassword') }}</span>
            <Password v-model="pwForm.current" :feedback="false" toggle-mask fluid :input-props="{ autocomplete: 'current-password' }" />
          </label>
          <label class="block text-sm">
            <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('account.newPassword') }}</span>
            <Password v-model="pwForm.next" :feedback="false" toggle-mask fluid :input-props="{ autocomplete: 'new-password' }" />
            <span class="mt-1 block text-xs text-surface-500">{{ t('account.passwordHint') }}</span>
          </label>
          <label class="block text-sm">
            <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('account.confirmPassword') }}</span>
            <Password v-model="pwForm.confirm" :feedback="false" toggle-mask fluid :input-props="{ autocomplete: 'new-password' }" />
          </label>
          <div>
            <Button :label="t('account.changePassword')" icon="pi pi-check" :loading="changingPassword" @click="submitPassword" />
          </div>
        </div>
      </section>

      <!-- بطاقة الإيميل -->
      <section class="rounded-2xl border border-surface-200 bg-white p-5 dark:border-surface-800 dark:bg-surface-900">
        <div class="mb-4 flex items-center gap-3">
          <span class="grid size-11 shrink-0 place-items-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-500/15 dark:text-primary-300">
            <i class="pi pi-envelope text-xl" />
          </span>
          <div class="min-w-0">
            <h2 class="text-sm font-semibold text-surface-800 dark:text-surface-100">{{ t('account.emailTitle') }}</h2>
            <p class="text-xs text-surface-500">{{ t('account.emailDesc') }}</p>
          </div>
        </div>
        <div class="grid gap-4">
          <label class="block text-sm">
            <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('account.currentEmail') }}</span>
            <InputText :model-value="auth.user?.email ?? ''" readonly fluid dir="ltr" />
          </label>
          <label class="block text-sm">
            <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('account.newEmail') }}</span>
            <InputText v-model="emailForm.next" fluid dir="ltr" :input-props="{ autocomplete: 'off' }" />
          </label>
          <label class="block text-sm">
            <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('account.emailPassword') }}</span>
            <Password v-model="emailForm.password" :feedback="false" toggle-mask fluid :input-props="{ autocomplete: 'current-password' }" />
          </label>
          <div>
            <Button :label="t('account.changeEmail')" icon="pi pi-check" :loading="changingEmail" @click="submitEmail" />
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
