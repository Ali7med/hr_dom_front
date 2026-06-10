<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Button from 'primevue/button'
import Dialog from '@/components/AppDialog.vue'
import InputText from 'primevue/inputtext'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import { ApiException } from '@/api/client'
import {
  currenciesApi, salaryRulesApi, penaltyRulesApi, bonusesApi,
  type Currency, type SalaryRule, type PenaltyRule, type Bonus,
  type OvertimeMode, type PenaltyAppliesTo, type DeductionType, type BonusType,
} from '@/api/payrollConfig'
import { usersApi, type User } from '@/api/users'
import PageHeader from '@/components/PageHeader.vue'

const { t } = useI18n()
const confirm = useConfirm()
const toast = useToast()

type Tab = 'currencies' | 'salary' | 'penalties' | 'bonuses'
const tab = ref<Tab>('currencies')
const saving = ref(false)
const loading = ref(false)

const currencies = ref<Currency[]>([])
const salaryRules = ref<SalaryRule[]>([])
const penalties = ref<PenaltyRule[]>([])
const bonuses = ref<Bonus[]>([])
const users = ref<User[]>([])

function messageFor(e: unknown, fallback: string): string {
  return e instanceof ApiException ? e.message : fallback
}
function notifyError(e: unknown, fallback: string): void {
  toast.add({ severity: 'error', summary: t('common.error'), detail: messageFor(e, fallback), life: 4000 })
}
const userName = (id: number) => users.value.find((u) => u.id === id)?.name ?? `#${id}`
const curCode = (id: number) => currencies.value.find((c) => c.id === id)?.code ?? `#${id}`

async function loadCurrencies() { currencies.value = await currenciesApi.list() }
async function loadSalary() { salaryRules.value = await salaryRulesApi.list() }
async function loadPenalties() { penalties.value = await penaltyRulesApi.list() }
async function loadBonuses() { bonuses.value = await bonusesApi.list() }

// ===== العملات =====
const curForm = reactive({ open: false, id: null as number | null, code: '', name: '', symbol: '' })
function openCurrency(c?: Currency) {
  curForm.open = true; curForm.id = c?.id ?? null
  curForm.code = c?.code ?? ''; curForm.name = c?.name ?? ''; curForm.symbol = c?.symbol ?? ''
}
async function submitCurrency() {
  saving.value = true
  try {
    const payload = { code: curForm.code.toUpperCase(), name: curForm.name, symbol: curForm.symbol || null }
    if (curForm.id === null) await currenciesApi.create(payload)
    else await currenciesApi.update(curForm.id, payload)
    curForm.open = false
    toast.add({ severity: 'success', summary: t('common.saved'), life: 2500 })
    await loadCurrencies()
  } catch (e) { notifyError(e, t('common.saveError')) } finally { saving.value = false }
}
function removeCurrency(c: Currency) {
  confirm.require({
    message: t('payConfig.confirmDeleteCurrency', { code: c.code }),
    header: t('common.delete'),
    icon: 'pi pi-exclamation-triangle',
    acceptProps: { severity: 'danger', label: t('common.delete') },
    rejectProps: { severity: 'secondary', outlined: true, label: t('common.cancel') },
    accept: async () => {
      try {
        await currenciesApi.remove(c.id)
        toast.add({ severity: 'success', summary: t('common.deleted'), life: 2500 })
        await loadCurrencies()
      } catch (e) { notifyError(e, t('common.saveError')) }
    },
  })
}

// ===== قواعد الراتب =====
const salForm = reactive({ open: false, user_id: 0, base_salary: 0, currency_id: 0, overtime_mode: 'manual' as OvertimeMode, overtime_value: 0 })
async function openSalary(rule?: SalaryRule) {
  salForm.open = true
  salForm.user_id = rule?.user_id ?? users.value[0]?.id ?? 0
  salForm.base_salary = rule ? Number(rule.base_salary) : 0
  salForm.currency_id = rule?.currency_id ?? currencies.value[0]?.id ?? 0
  salForm.overtime_mode = rule?.overtime_mode ?? 'manual'
  salForm.overtime_value = rule?.overtime_value != null ? Number(rule.overtime_value) : 0
}
async function onSalaryUserChange() {
  if (!salForm.user_id) return
  try {
    const rule = await salaryRulesApi.forUser(salForm.user_id)
    if (rule) {
      salForm.base_salary = Number(rule.base_salary)
      salForm.currency_id = rule.currency_id
      salForm.overtime_mode = rule.overtime_mode
      salForm.overtime_value = rule.overtime_value != null ? Number(rule.overtime_value) : 0
    }
  } catch { /* لا قاعدة بعد */ }
}
async function submitSalary() {
  saving.value = true
  try {
    await salaryRulesApi.upsert(salForm.user_id, {
      base_salary: salForm.base_salary,
      currency_id: salForm.currency_id,
      overtime_mode: salForm.overtime_mode,
      overtime_value: salForm.overtime_mode === 'manual' ? null : salForm.overtime_value,
    })
    salForm.open = false
    toast.add({ severity: 'success', summary: t('common.saved'), life: 2500 })
    await loadSalary()
  } catch (e) { notifyError(e, t('common.saveError')) } finally { saving.value = false }
}

// ===== العقوبات =====
const penForm = reactive({ open: false, id: null as number | null, applies_to: 'late' as PenaltyAppliesTo, from_minutes: 0, to_minutes: '' as number | '', deduction_type: 'percent' as DeductionType, value: 0 })
function openPenalty(p?: PenaltyRule) {
  penForm.open = true; penForm.id = p?.id ?? null
  penForm.applies_to = p?.applies_to ?? 'late'
  penForm.from_minutes = p?.from_minutes ?? 0
  penForm.to_minutes = p?.to_minutes ?? ''
  penForm.deduction_type = p?.deduction_type ?? 'percent'
  penForm.value = p ? Number(p.value) : 0
}
async function submitPenalty() {
  saving.value = true
  try {
    const payload = {
      applies_to: penForm.applies_to, from_minutes: penForm.from_minutes,
      to_minutes: penForm.to_minutes === '' ? null : Number(penForm.to_minutes),
      deduction_type: penForm.deduction_type, value: penForm.value,
    }
    if (penForm.id === null) await penaltyRulesApi.create(payload)
    else await penaltyRulesApi.update(penForm.id, payload)
    penForm.open = false
    toast.add({ severity: 'success', summary: t('common.saved'), life: 2500 })
    await loadPenalties()
  } catch (e) { notifyError(e, t('common.saveError')) } finally { saving.value = false }
}
function removePenalty(p: PenaltyRule) {
  confirm.require({
    message: t('payConfig.confirmDeletePenalty'),
    header: t('common.delete'),
    icon: 'pi pi-exclamation-triangle',
    acceptProps: { severity: 'danger', label: t('common.delete') },
    rejectProps: { severity: 'secondary', outlined: true, label: t('common.cancel') },
    accept: async () => {
      try {
        await penaltyRulesApi.remove(p.id)
        toast.add({ severity: 'success', summary: t('common.deleted'), life: 2500 })
        await loadPenalties()
      } catch (e) { notifyError(e, t('common.saveError')) }
    },
  })
}

// ===== المكافآت =====
const bonForm = reactive({ open: false, id: null as number | null, user_id: 0, period: '', type: 'bonus' as BonusType, amount: 0, currency_id: 0, reason: '' })
function openBonus(b?: Bonus) {
  bonForm.open = true; bonForm.id = b?.id ?? null
  bonForm.user_id = b?.user_id ?? users.value[0]?.id ?? 0
  bonForm.period = b?.period ?? ''
  bonForm.type = b?.type ?? 'bonus'
  bonForm.amount = b ? Number(b.amount) : 0
  bonForm.currency_id = b?.currency_id ?? currencies.value[0]?.id ?? 0
  bonForm.reason = b?.reason ?? ''
}
async function submitBonus() {
  saving.value = true
  try {
    const payload = { user_id: bonForm.user_id, period: bonForm.period, type: bonForm.type, amount: bonForm.amount, currency_id: bonForm.currency_id, reason: bonForm.reason }
    if (bonForm.id === null) await bonusesApi.create(payload)
    else await bonusesApi.update(bonForm.id, payload)
    bonForm.open = false
    toast.add({ severity: 'success', summary: t('common.saved'), life: 2500 })
    await loadBonuses()
  } catch (e) { notifyError(e, t('common.saveError')) } finally { saving.value = false }
}
function removeBonus(b: Bonus) {
  confirm.require({
    message: t('payConfig.confirmDeleteBonus'),
    header: t('common.delete'),
    icon: 'pi pi-exclamation-triangle',
    acceptProps: { severity: 'danger', label: t('common.delete') },
    rejectProps: { severity: 'secondary', outlined: true, label: t('common.cancel') },
    accept: async () => {
      try {
        await bonusesApi.remove(b.id)
        toast.add({ severity: 'success', summary: t('common.deleted'), life: 2500 })
        await loadBonuses()
      } catch (e) { notifyError(e, t('common.saveError')) }
    },
  })
}

const canPickCurrencyUser = computed(() => currencies.value.length > 0 && users.value.length > 0)

onMounted(async () => {
  loading.value = true
  try {
    const [us] = await Promise.all([usersApi.list({ per_page: 100 })])
    users.value = us.data
    await Promise.all([loadCurrencies(), loadSalary(), loadPenalties(), loadBonuses()])
  } catch (e) { notifyError(e, t('common.loadError')) } finally { loading.value = false }
})
</script>

<template>
  <div class="mx-auto max-w-5xl">
    <PageHeader :title="t('payConfig.title')" />

    <Tabs :value="tab" @update:value="(v) => (tab = v as Tab)">
      <TabList>
        <Tab value="currencies">{{ t('payConfig.tabCurrencies') }}</Tab>
        <Tab value="salary">{{ t('payConfig.tabSalary') }}</Tab>
        <Tab value="penalties">{{ t('payConfig.tabPenalties') }}</Tab>
        <Tab value="bonuses">{{ t('payConfig.tabBonuses') }}</Tab>
      </TabList>

      <TabPanels>
        <!-- ===== العملات ===== -->
        <TabPanel value="currencies">
          <div class="mb-4 flex justify-end">
            <Button v-can="'currencies.create'" :label="t('payConfig.addCurrency')" icon="pi pi-plus" @click="openCurrency()" />
          </div>
          <div class="overflow-hidden rounded-2xl border border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
            <DataTable
              :value="currencies"
              :loading="loading"
              paginator
              :rows="10"
              :rows-per-page-options="[10, 20, 50]"
              data-key="id"
              striped-rows
              removable-sort
            >
              <template #empty>
                <p class="py-6 text-center text-sm text-surface-500">{{ t('payConfig.emptyCurrencies') }}</p>
              </template>
              <Column field="code" :header="t('payConfig.code')" sortable>
                <template #body="{ data }">
                  <span class="font-medium text-surface-900 dark:text-white" dir="ltr">{{ data.code }}</span>
                </template>
              </Column>
              <Column field="name" :header="t('payConfig.currencyName')" sortable>
                <template #body="{ data }"><span class="text-surface-500">{{ data.name }}</span></template>
              </Column>
              <Column field="symbol" :header="t('payConfig.symbol')">
                <template #body="{ data }"><span class="text-surface-500">{{ data.symbol || '—' }}</span></template>
              </Column>
              <Column :header="t('companies.actions')" class="text-end">
                <template #body="{ data }">
                  <div class="flex justify-end gap-1">
                    <Button
                      v-can="'currencies.update'"
                      v-tooltip.top="t('common.edit')"
                      icon="pi pi-pencil"
                      severity="secondary"
                      text
                      rounded
                      @click="openCurrency(data)"
                    />
                    <Button
                      v-can="'currencies.delete'"
                      v-tooltip.top="t('common.delete')"
                      icon="pi pi-trash"
                      severity="danger"
                      text
                      rounded
                      @click="removeCurrency(data)"
                    />
                  </div>
                </template>
              </Column>
            </DataTable>
          </div>
        </TabPanel>

        <!-- ===== قواعد الراتب ===== -->
        <TabPanel value="salary">
          <div class="mb-4 flex justify-end">
            <Button v-can="'salary_rules.manage'" :label="t('payConfig.setSalary')" icon="pi pi-plus" :disabled="!canPickCurrencyUser" @click="openSalary()" />
          </div>
          <p v-if="!canPickCurrencyUser" class="mb-4 text-sm text-amber-600 dark:text-amber-400">{{ t('payConfig.needCurrencyUser') }}</p>
          <div class="overflow-hidden rounded-2xl border border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
            <DataTable
              :value="salaryRules"
              :loading="loading"
              paginator
              :rows="10"
              :rows-per-page-options="[10, 20, 50]"
              data-key="id"
              striped-rows
              removable-sort
            >
              <template #empty>
                <p class="py-6 text-center text-sm text-surface-500">{{ t('payConfig.emptySalary') }}</p>
              </template>
              <Column :header="t('payConfig.employee')">
                <template #body="{ data }">
                  <span class="font-medium text-surface-900 dark:text-white">{{ userName(data.user_id) }}</span>
                </template>
              </Column>
              <Column :header="t('payConfig.baseSalary')">
                <template #body="{ data }">
                  <span class="text-surface-500" dir="ltr">{{ Number(data.base_salary).toLocaleString('en-US') }}</span>
                </template>
              </Column>
              <Column :header="t('payConfig.currency')">
                <template #body="{ data }">
                  <span class="text-surface-500" dir="ltr">{{ data.currency?.code ?? curCode(data.currency_id) }}</span>
                </template>
              </Column>
              <Column :header="t('payConfig.overtimeMode')">
                <template #body="{ data }">
                  <span class="text-surface-500">{{ t('payConfig.ot' + (data.overtime_mode === 'manual' ? 'Manual' : data.overtime_mode === 'percent' ? 'Percent' : 'Fixed')) }}</span>
                </template>
              </Column>
              <Column :header="t('companies.actions')" class="text-end">
                <template #body="{ data }">
                  <div class="flex justify-end">
                    <Button
                      v-can="'salary_rules.manage'"
                      v-tooltip.top="t('common.edit')"
                      icon="pi pi-pencil"
                      severity="secondary"
                      text
                      rounded
                      @click="openSalary(data)"
                    />
                  </div>
                </template>
              </Column>
            </DataTable>
          </div>
        </TabPanel>

        <!-- ===== العقوبات ===== -->
        <TabPanel value="penalties">
          <div class="mb-4 flex justify-end">
            <Button v-can="'penalty_rules.create'" :label="t('payConfig.addPenalty')" icon="pi pi-plus" @click="openPenalty()" />
          </div>
          <div class="overflow-hidden rounded-2xl border border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
            <DataTable
              :value="penalties"
              :loading="loading"
              paginator
              :rows="10"
              :rows-per-page-options="[10, 20, 50]"
              data-key="id"
              striped-rows
              removable-sort
            >
              <template #empty>
                <p class="py-6 text-center text-sm text-surface-500">{{ t('payConfig.emptyPenalties') }}</p>
              </template>
              <Column :header="t('payConfig.appliesTo')">
                <template #body="{ data }">
                  <span class="font-medium text-surface-900 dark:text-white">{{ t('payConfig.' + data.applies_to) }}</span>
                </template>
              </Column>
              <Column :header="t('payConfig.range')">
                <template #body="{ data }">
                  <span class="text-surface-500" dir="ltr">{{ data.from_minutes }}–{{ data.to_minutes ?? '∞' }} {{ t('payConfig.min') }}</span>
                </template>
              </Column>
              <Column :header="t('payConfig.deductionType')">
                <template #body="{ data }"><span class="text-surface-500">{{ t('payConfig.' + data.deduction_type) }}</span></template>
              </Column>
              <Column :header="t('payConfig.value')">
                <template #body="{ data }">
                  <span class="text-surface-500" dir="ltr">{{ data.value }}{{ data.deduction_type === 'percent' ? '%' : '' }}</span>
                </template>
              </Column>
              <Column :header="t('companies.actions')" class="text-end">
                <template #body="{ data }">
                  <div class="flex justify-end gap-1">
                    <Button
                      v-can="'penalty_rules.update'"
                      v-tooltip.top="t('common.edit')"
                      icon="pi pi-pencil"
                      severity="secondary"
                      text
                      rounded
                      @click="openPenalty(data)"
                    />
                    <Button
                      v-can="'penalty_rules.delete'"
                      v-tooltip.top="t('common.delete')"
                      icon="pi pi-trash"
                      severity="danger"
                      text
                      rounded
                      @click="removePenalty(data)"
                    />
                  </div>
                </template>
              </Column>
            </DataTable>
          </div>
        </TabPanel>

        <!-- ===== المكافآت ===== -->
        <TabPanel value="bonuses">
          <div class="mb-4 flex justify-end">
            <Button v-can="'bonuses.create'" :label="t('payConfig.addBonus')" icon="pi pi-plus" :disabled="!canPickCurrencyUser" @click="openBonus()" />
          </div>
          <div class="overflow-hidden rounded-2xl border border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
            <DataTable
              :value="bonuses"
              :loading="loading"
              paginator
              :rows="10"
              :rows-per-page-options="[10, 20, 50]"
              data-key="id"
              striped-rows
              removable-sort
            >
              <template #empty>
                <p class="py-6 text-center text-sm text-surface-500">{{ t('payConfig.emptyBonuses') }}</p>
              </template>
              <Column :header="t('payConfig.employee')">
                <template #body="{ data }">
                  <span class="font-medium text-surface-900 dark:text-white">{{ data.user?.name ?? userName(data.user_id) }}</span>
                </template>
              </Column>
              <Column :header="t('payConfig.period')">
                <template #body="{ data }"><span class="text-surface-500" dir="ltr">{{ data.period }}</span></template>
              </Column>
              <Column :header="t('payConfig.bonusType')">
                <template #body="{ data }"><span class="text-surface-500">{{ t('payConfig.' + data.type) }}</span></template>
              </Column>
              <Column :header="t('payConfig.amount')">
                <template #body="{ data }">
                  <span class="text-surface-500" dir="ltr">{{ Number(data.amount).toLocaleString('en-US') }} {{ data.currency?.code ?? curCode(data.currency_id) }}</span>
                </template>
              </Column>
              <Column :header="t('payConfig.reason')">
                <template #body="{ data }"><span class="text-surface-500">{{ data.reason }}</span></template>
              </Column>
              <Column :header="t('companies.actions')" class="text-end">
                <template #body="{ data }">
                  <div class="flex justify-end gap-1">
                    <Button
                      v-can="'bonuses.update'"
                      v-tooltip.top="t('common.edit')"
                      icon="pi pi-pencil"
                      severity="secondary"
                      text
                      rounded
                      @click="openBonus(data)"
                    />
                    <Button
                      v-can="'bonuses.delete'"
                      v-tooltip.top="t('common.delete')"
                      icon="pi pi-trash"
                      severity="danger"
                      text
                      rounded
                      @click="removeBonus(data)"
                    />
                  </div>
                </template>
              </Column>
            </DataTable>
          </div>
        </TabPanel>
      </TabPanels>
    </Tabs>

    <!-- نموذج العملة -->
    <Dialog
      v-model:visible="curForm.open"
      modal
      :header="curForm.id === null ? t('payConfig.addCurrency') : t('payConfig.editCurrency')"
      :style="{ width: '34rem' }"
      :breakpoints="{ '640px': '95vw' }"
    >
      <form class="grid gap-4 pt-2 sm:grid-cols-3" @submit.prevent="submitCurrency">
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('payConfig.code') }}</span>
          <InputText v-model="curForm.code" required maxlength="3" minlength="3" class="uppercase" placeholder="USD" fluid />
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('payConfig.currencyName') }}</span>
          <InputText v-model="curForm.name" required maxlength="50" fluid />
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('payConfig.symbol') }}</span>
          <InputText v-model="curForm.symbol" maxlength="8" fluid />
        </label>
        <div class="mt-2 flex justify-end gap-2 sm:col-span-3">
          <Button type="button" :label="t('common.cancel')" severity="secondary" text @click="curForm.open = false" />
          <Button type="submit" :label="saving ? t('common.saving') : t('common.save')" icon="pi pi-check" :loading="saving" />
        </div>
      </form>
    </Dialog>

    <!-- نموذج قاعدة الراتب -->
    <Dialog
      v-model:visible="salForm.open"
      modal
      :header="t('payConfig.setSalary')"
      :style="{ width: '34rem' }"
      :breakpoints="{ '640px': '95vw' }"
    >
      <form class="grid gap-4 pt-2 sm:grid-cols-2" @submit.prevent="submitSalary">
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('payConfig.employee') }}</span>
          <Select
            v-model="salForm.user_id"
            :options="users"
            option-label="name"
            option-value="id"
            fluid
            @change="onSalaryUserChange"
          />
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('payConfig.baseSalary') }}</span>
          <InputNumber v-model="salForm.base_salary" :min="0" :min-fraction-digits="0" :max-fraction-digits="2" fluid />
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('payConfig.currency') }}</span>
          <Select
            v-model="salForm.currency_id"
            :options="currencies"
            option-label="code"
            option-value="id"
            fluid
          />
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('payConfig.overtimeMode') }}</span>
          <Select
            v-model="salForm.overtime_mode"
            :options="[
              { value: 'manual', label: t('payConfig.otManual') },
              { value: 'percent', label: t('payConfig.otPercent') },
              { value: 'fixed_per_hour', label: t('payConfig.otFixed') },
            ]"
            option-label="label"
            option-value="value"
            fluid
          />
        </label>
        <label v-if="salForm.overtime_mode !== 'manual'" class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('payConfig.overtimeValue') }}</span>
          <InputNumber v-model="salForm.overtime_value" :min="0" :min-fraction-digits="0" :max-fraction-digits="2" fluid />
        </label>
        <div class="mt-2 flex justify-end gap-2 sm:col-span-2">
          <Button type="button" :label="t('common.cancel')" severity="secondary" text @click="salForm.open = false" />
          <Button type="submit" :label="saving ? t('common.saving') : t('common.save')" icon="pi pi-check" :loading="saving" />
        </div>
      </form>
    </Dialog>

    <!-- نموذج العقوبة -->
    <Dialog
      v-model:visible="penForm.open"
      modal
      :header="penForm.id === null ? t('payConfig.addPenalty') : t('payConfig.editPenalty')"
      :style="{ width: '34rem' }"
      :breakpoints="{ '640px': '95vw' }"
    >
      <form class="grid gap-4 pt-2 sm:grid-cols-2" @submit.prevent="submitPenalty">
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('payConfig.appliesTo') }}</span>
          <Select
            v-model="penForm.applies_to"
            :options="[
              { value: 'late', label: t('payConfig.late') },
              { value: 'absence', label: t('payConfig.absence') },
            ]"
            option-label="label"
            option-value="value"
            fluid
          />
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('payConfig.deductionType') }}</span>
          <Select
            v-model="penForm.deduction_type"
            :options="[
              { value: 'percent', label: t('payConfig.percent') },
              { value: 'fixed', label: t('payConfig.fixed') },
            ]"
            option-label="label"
            option-value="value"
            fluid
          />
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('payConfig.fromMinutes') }}</span>
          <InputNumber v-model="penForm.from_minutes" :min="0" :use-grouping="false" fluid />
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('payConfig.toMinutes') }}</span>
          <InputNumber :model-value="penForm.to_minutes === '' ? null : penForm.to_minutes" @update:model-value="penForm.to_minutes = ($event ?? '')" :min="0" :use-grouping="false" :placeholder="t('payConfig.openEnded')" fluid />
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('payConfig.value') }}</span>
          <InputNumber v-model="penForm.value" :min="0" :min-fraction-digits="0" :max-fraction-digits="2" fluid />
        </label>
        <div class="mt-2 flex justify-end gap-2 sm:col-span-2">
          <Button type="button" :label="t('common.cancel')" severity="secondary" text @click="penForm.open = false" />
          <Button type="submit" :label="saving ? t('common.saving') : t('common.save')" icon="pi pi-check" :loading="saving" />
        </div>
      </form>
    </Dialog>

    <!-- نموذج المكافأة -->
    <Dialog
      v-model:visible="bonForm.open"
      modal
      :header="bonForm.id === null ? t('payConfig.addBonus') : t('payConfig.editBonus')"
      :style="{ width: '34rem' }"
      :breakpoints="{ '640px': '95vw' }"
    >
      <form class="grid gap-4 pt-2 sm:grid-cols-2" @submit.prevent="submitBonus">
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('payConfig.employee') }}</span>
          <Select
            v-model="bonForm.user_id"
            :options="users"
            option-label="name"
            option-value="id"
            fluid
          />
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('payConfig.period') }}</span>
          <InputText v-model="bonForm.period" type="month" required fluid />
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('payConfig.bonusType') }}</span>
          <Select
            v-model="bonForm.type"
            :options="[
              { value: 'bonus', label: t('payConfig.bonus') },
              { value: 'allowance', label: t('payConfig.allowance') },
              { value: 'deduction', label: t('payConfig.deduction') },
            ]"
            option-label="label"
            option-value="value"
            fluid
          />
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('payConfig.amount') }}</span>
          <InputNumber v-model="bonForm.amount" :min-fraction-digits="0" :max-fraction-digits="2" fluid />
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('payConfig.currency') }}</span>
          <Select
            v-model="bonForm.currency_id"
            :options="currencies"
            option-label="code"
            option-value="id"
            fluid
          />
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-surface-700 dark:text-surface-300">{{ t('payConfig.reason') }}</span>
          <InputText v-model="bonForm.reason" required maxlength="255" fluid />
        </label>
        <div class="mt-2 flex justify-end gap-2 sm:col-span-2">
          <Button type="button" :label="t('common.cancel')" severity="secondary" text @click="bonForm.open = false" />
          <Button type="submit" :label="saving ? t('common.saving') : t('common.save')" icon="pi pi-check" :loading="saving" />
        </div>
      </form>
    </Dialog>
  </div>
</template>
