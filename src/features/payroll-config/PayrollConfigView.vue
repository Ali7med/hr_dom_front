<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ApiException } from '@/api/client'
import {
  currenciesApi, salaryRulesApi, penaltyRulesApi, bonusesApi,
  type Currency, type SalaryRule, type PenaltyRule, type Bonus,
  type OvertimeMode, type PenaltyAppliesTo, type DeductionType, type BonusType,
} from '@/api/payrollConfig'
import { usersApi, type User } from '@/api/users'

const { t } = useI18n()

type Tab = 'currencies' | 'salary' | 'penalties' | 'bonuses'
const tab = ref<Tab>('currencies')
const error = ref('')
const saving = ref(false)

const currencies = ref<Currency[]>([])
const salaryRules = ref<SalaryRule[]>([])
const penalties = ref<PenaltyRule[]>([])
const bonuses = ref<Bonus[]>([])
const users = ref<User[]>([])

function messageFor(e: unknown, fallback: string): string {
  return e instanceof ApiException ? e.message : fallback
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
  saving.value = true; error.value = ''
  try {
    const payload = { code: curForm.code.toUpperCase(), name: curForm.name, symbol: curForm.symbol || null }
    if (curForm.id === null) await currenciesApi.create(payload)
    else await currenciesApi.update(curForm.id, payload)
    curForm.open = false; await loadCurrencies()
  } catch (e) { error.value = messageFor(e, t('common.saveError')) } finally { saving.value = false }
}
async function removeCurrency(c: Currency) {
  if (!window.confirm(t('payConfig.confirmDeleteCurrency', { code: c.code }))) return
  error.value = ''
  try { await currenciesApi.remove(c.id); await loadCurrencies() } catch (e) { error.value = messageFor(e, t('common.saveError')) }
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
  saving.value = true; error.value = ''
  try {
    await salaryRulesApi.upsert(salForm.user_id, {
      base_salary: salForm.base_salary,
      currency_id: salForm.currency_id,
      overtime_mode: salForm.overtime_mode,
      overtime_value: salForm.overtime_mode === 'manual' ? null : salForm.overtime_value,
    })
    salForm.open = false; await loadSalary()
  } catch (e) { error.value = messageFor(e, t('common.saveError')) } finally { saving.value = false }
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
  saving.value = true; error.value = ''
  try {
    const payload = {
      applies_to: penForm.applies_to, from_minutes: penForm.from_minutes,
      to_minutes: penForm.to_minutes === '' ? null : Number(penForm.to_minutes),
      deduction_type: penForm.deduction_type, value: penForm.value,
    }
    if (penForm.id === null) await penaltyRulesApi.create(payload)
    else await penaltyRulesApi.update(penForm.id, payload)
    penForm.open = false; await loadPenalties()
  } catch (e) { error.value = messageFor(e, t('common.saveError')) } finally { saving.value = false }
}
async function removePenalty(p: PenaltyRule) {
  if (!window.confirm(t('payConfig.confirmDeletePenalty'))) return
  error.value = ''
  try { await penaltyRulesApi.remove(p.id); await loadPenalties() } catch (e) { error.value = messageFor(e, t('common.saveError')) }
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
  saving.value = true; error.value = ''
  try {
    const payload = { user_id: bonForm.user_id, period: bonForm.period, type: bonForm.type, amount: bonForm.amount, currency_id: bonForm.currency_id, reason: bonForm.reason }
    if (bonForm.id === null) await bonusesApi.create(payload)
    else await bonusesApi.update(bonForm.id, payload)
    bonForm.open = false; await loadBonuses()
  } catch (e) { error.value = messageFor(e, t('common.saveError')) } finally { saving.value = false }
}
async function removeBonus(b: Bonus) {
  if (!window.confirm(t('payConfig.confirmDeleteBonus'))) return
  error.value = ''
  try { await bonusesApi.remove(b.id); await loadBonuses() } catch (e) { error.value = messageFor(e, t('common.saveError')) }
}

const tabs: { key: Tab; label: string }[] = [
  { key: 'currencies', label: 'payConfig.tabCurrencies' },
  { key: 'salary', label: 'payConfig.tabSalary' },
  { key: 'penalties', label: 'payConfig.tabPenalties' },
  { key: 'bonuses', label: 'payConfig.tabBonuses' },
]
const canPickCurrencyUser = computed(() => currencies.value.length > 0 && users.value.length > 0)

onMounted(async () => {
  error.value = ''
  try {
    const [us] = await Promise.all([usersApi.list({ per_page: 100 })])
    users.value = us.data
    await Promise.all([loadCurrencies(), loadSalary(), loadPenalties(), loadBonuses()])
  } catch (e) { error.value = messageFor(e, t('common.loadError')) }
})
</script>

<template>
  <div class="mx-auto max-w-5xl">
    <h1 class="mb-6 text-2xl font-bold text-slate-900 dark:text-white">{{ t('payConfig.title') }}</h1>

    <div class="mb-6 flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-800">
      <button v-for="tb in tabs" :key="tb.key" type="button"
        class="-mb-px border-b-2 px-4 py-2 text-sm font-medium transition"
        :class="tab === tb.key ? 'border-indigo-600 text-indigo-700 dark:text-indigo-300' : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'"
        @click="tab = tb.key">{{ t(tb.label) }}</button>
    </div>

    <p v-if="error" class="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:bg-rose-950 dark:text-rose-300" role="alert">{{ error }}</p>

    <!-- ===== العملات ===== -->
    <section v-if="tab === 'currencies'">
      <div class="mb-4 flex justify-end"><button v-can="'currencies.create'" type="button" class="btn-primary" @click="openCurrency()">{{ t('payConfig.addCurrency') }}</button></div>
      <form v-if="curForm.open" class="mb-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900" @submit.prevent="submitCurrency">
        <h2 class="font-semibold">{{ curForm.id === null ? t('payConfig.addCurrency') : t('payConfig.editCurrency') }}</h2>
        <div class="grid gap-4 sm:grid-cols-3">
          <label class="block text-sm"><span class="lbl">{{ t('payConfig.code') }}</span><input v-model="curForm.code" type="text" required maxlength="3" minlength="3" class="field uppercase" placeholder="USD" /></label>
          <label class="block text-sm"><span class="lbl">{{ t('payConfig.currencyName') }}</span><input v-model="curForm.name" type="text" required maxlength="50" class="field" /></label>
          <label class="block text-sm"><span class="lbl">{{ t('payConfig.symbol') }}</span><input v-model="curForm.symbol" type="text" maxlength="8" class="field" /></label>
        </div>
        <div class="flex gap-3"><button type="submit" :disabled="saving" class="btn-primary disabled:opacity-60">{{ saving ? t('common.saving') : t('common.save') }}</button><button type="button" class="btn-ghost" @click="curForm.open = false">{{ t('common.cancel') }}</button></div>
      </form>
      <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <p v-if="!currencies.length" class="p-6 text-sm text-slate-500">{{ t('payConfig.emptyCurrencies') }}</p>
        <table v-else class="w-full text-start text-sm">
          <thead class="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400"><tr><th class="px-4 py-3 text-start">{{ t('payConfig.code') }}</th><th class="px-4 py-3 text-start">{{ t('payConfig.currencyName') }}</th><th class="px-4 py-3 text-start">{{ t('payConfig.symbol') }}</th><th class="px-4 py-3 text-end">{{ t('companies.actions') }}</th></tr></thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            <tr v-for="c in currencies" :key="c.id">
              <td class="px-4 py-3 font-medium text-slate-900 dark:text-white" dir="ltr">{{ c.code }}</td>
              <td class="px-4 py-3 text-slate-500">{{ c.name }}</td>
              <td class="px-4 py-3 text-slate-500">{{ c.symbol || '—' }}</td>
              <td class="px-4 py-3"><div class="flex justify-end gap-3"><button v-can="'currencies.update'" type="button" class="text-slate-600 hover:underline dark:text-slate-300" @click="openCurrency(c)">{{ t('common.edit') }}</button><button v-can="'currencies.delete'" type="button" class="text-rose-600 hover:underline dark:text-rose-400" @click="removeCurrency(c)">{{ t('common.delete') }}</button></div></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- ===== قواعد الراتب ===== -->
    <section v-else-if="tab === 'salary'">
      <div class="mb-4 flex justify-end"><button v-can="'salary_rules.manage'" type="button" class="btn-primary disabled:opacity-50" :disabled="!canPickCurrencyUser" @click="openSalary()">{{ t('payConfig.setSalary') }}</button></div>
      <p v-if="!canPickCurrencyUser" class="mb-4 text-sm text-amber-600 dark:text-amber-400">{{ t('payConfig.needCurrencyUser') }}</p>
      <form v-if="salForm.open" class="mb-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900" @submit.prevent="submitSalary">
        <h2 class="font-semibold">{{ t('payConfig.setSalary') }}</h2>
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="block text-sm"><span class="lbl">{{ t('payConfig.employee') }}</span><select v-model.number="salForm.user_id" class="field" @change="onSalaryUserChange"><option v-for="u in users" :key="u.id" :value="u.id">{{ u.name }}</option></select></label>
          <label class="block text-sm"><span class="lbl">{{ t('payConfig.baseSalary') }}</span><input v-model.number="salForm.base_salary" type="number" min="0" step="0.01" required class="field" /></label>
          <label class="block text-sm"><span class="lbl">{{ t('payConfig.currency') }}</span><select v-model.number="salForm.currency_id" required class="field"><option v-for="c in currencies" :key="c.id" :value="c.id">{{ c.code }}</option></select></label>
          <label class="block text-sm"><span class="lbl">{{ t('payConfig.overtimeMode') }}</span><select v-model="salForm.overtime_mode" class="field"><option value="manual">{{ t('payConfig.otManual') }}</option><option value="percent">{{ t('payConfig.otPercent') }}</option><option value="fixed_per_hour">{{ t('payConfig.otFixed') }}</option></select></label>
          <label v-if="salForm.overtime_mode !== 'manual'" class="block text-sm"><span class="lbl">{{ t('payConfig.overtimeValue') }}</span><input v-model.number="salForm.overtime_value" type="number" min="0" step="0.01" class="field" /></label>
        </div>
        <div class="flex gap-3"><button type="submit" :disabled="saving" class="btn-primary disabled:opacity-60">{{ saving ? t('common.saving') : t('common.save') }}</button><button type="button" class="btn-ghost" @click="salForm.open = false">{{ t('common.cancel') }}</button></div>
      </form>
      <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <p v-if="!salaryRules.length" class="p-6 text-sm text-slate-500">{{ t('payConfig.emptySalary') }}</p>
        <table v-else class="w-full text-start text-sm">
          <thead class="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400"><tr><th class="px-4 py-3 text-start">{{ t('payConfig.employee') }}</th><th class="px-4 py-3 text-start">{{ t('payConfig.baseSalary') }}</th><th class="px-4 py-3 text-start">{{ t('payConfig.currency') }}</th><th class="px-4 py-3 text-start">{{ t('payConfig.overtimeMode') }}</th><th class="px-4 py-3 text-end">{{ t('companies.actions') }}</th></tr></thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            <tr v-for="r in salaryRules" :key="r.id">
              <td class="px-4 py-3 font-medium text-slate-900 dark:text-white">{{ userName(r.user_id) }}</td>
              <td class="px-4 py-3 text-slate-500" dir="ltr">{{ Number(r.base_salary).toLocaleString('en-US') }}</td>
              <td class="px-4 py-3 text-slate-500" dir="ltr">{{ r.currency?.code ?? curCode(r.currency_id) }}</td>
              <td class="px-4 py-3 text-slate-500">{{ t('payConfig.ot' + (r.overtime_mode === 'manual' ? 'Manual' : r.overtime_mode === 'percent' ? 'Percent' : 'Fixed')) }}</td>
              <td class="px-4 py-3"><div class="flex justify-end"><button v-can="'salary_rules.manage'" type="button" class="text-slate-600 hover:underline dark:text-slate-300" @click="openSalary(r)">{{ t('common.edit') }}</button></div></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- ===== العقوبات ===== -->
    <section v-else-if="tab === 'penalties'">
      <div class="mb-4 flex justify-end"><button v-can="'penalty_rules.create'" type="button" class="btn-primary" @click="openPenalty()">{{ t('payConfig.addPenalty') }}</button></div>
      <form v-if="penForm.open" class="mb-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900" @submit.prevent="submitPenalty">
        <h2 class="font-semibold">{{ penForm.id === null ? t('payConfig.addPenalty') : t('payConfig.editPenalty') }}</h2>
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="block text-sm"><span class="lbl">{{ t('payConfig.appliesTo') }}</span><select v-model="penForm.applies_to" class="field"><option value="late">{{ t('payConfig.late') }}</option><option value="absence">{{ t('payConfig.absence') }}</option></select></label>
          <label class="block text-sm"><span class="lbl">{{ t('payConfig.deductionType') }}</span><select v-model="penForm.deduction_type" class="field"><option value="percent">{{ t('payConfig.percent') }}</option><option value="fixed">{{ t('payConfig.fixed') }}</option></select></label>
          <label class="block text-sm"><span class="lbl">{{ t('payConfig.fromMinutes') }}</span><input v-model.number="penForm.from_minutes" type="number" min="0" required class="field" /></label>
          <label class="block text-sm"><span class="lbl">{{ t('payConfig.toMinutes') }}</span><input v-model="penForm.to_minutes" type="number" min="0" class="field" :placeholder="t('payConfig.openEnded')" /></label>
          <label class="block text-sm"><span class="lbl">{{ t('payConfig.value') }}</span><input v-model.number="penForm.value" type="number" min="0" step="0.01" required class="field" /></label>
        </div>
        <div class="flex gap-3"><button type="submit" :disabled="saving" class="btn-primary disabled:opacity-60">{{ saving ? t('common.saving') : t('common.save') }}</button><button type="button" class="btn-ghost" @click="penForm.open = false">{{ t('common.cancel') }}</button></div>
      </form>
      <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <p v-if="!penalties.length" class="p-6 text-sm text-slate-500">{{ t('payConfig.emptyPenalties') }}</p>
        <table v-else class="w-full text-start text-sm">
          <thead class="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400"><tr><th class="px-4 py-3 text-start">{{ t('payConfig.appliesTo') }}</th><th class="px-4 py-3 text-start">{{ t('payConfig.range') }}</th><th class="px-4 py-3 text-start">{{ t('payConfig.deductionType') }}</th><th class="px-4 py-3 text-start">{{ t('payConfig.value') }}</th><th class="px-4 py-3 text-end">{{ t('companies.actions') }}</th></tr></thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            <tr v-for="p in penalties" :key="p.id">
              <td class="px-4 py-3 font-medium text-slate-900 dark:text-white">{{ t('payConfig.' + p.applies_to) }}</td>
              <td class="px-4 py-3 text-slate-500" dir="ltr">{{ p.from_minutes }}–{{ p.to_minutes ?? '∞' }} {{ t('payConfig.min') }}</td>
              <td class="px-4 py-3 text-slate-500">{{ t('payConfig.' + p.deduction_type) }}</td>
              <td class="px-4 py-3 text-slate-500" dir="ltr">{{ p.value }}{{ p.deduction_type === 'percent' ? '%' : '' }}</td>
              <td class="px-4 py-3"><div class="flex justify-end gap-3"><button v-can="'penalty_rules.update'" type="button" class="text-slate-600 hover:underline dark:text-slate-300" @click="openPenalty(p)">{{ t('common.edit') }}</button><button v-can="'penalty_rules.delete'" type="button" class="text-rose-600 hover:underline dark:text-rose-400" @click="removePenalty(p)">{{ t('common.delete') }}</button></div></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- ===== المكافآت ===== -->
    <section v-else>
      <div class="mb-4 flex justify-end"><button v-can="'bonuses.create'" type="button" class="btn-primary disabled:opacity-50" :disabled="!canPickCurrencyUser" @click="openBonus()">{{ t('payConfig.addBonus') }}</button></div>
      <form v-if="bonForm.open" class="mb-6 space-y-4 rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900" @submit.prevent="submitBonus">
        <h2 class="font-semibold">{{ bonForm.id === null ? t('payConfig.addBonus') : t('payConfig.editBonus') }}</h2>
        <div class="grid gap-4 sm:grid-cols-2">
          <label class="block text-sm"><span class="lbl">{{ t('payConfig.employee') }}</span><select v-model.number="bonForm.user_id" class="field"><option v-for="u in users" :key="u.id" :value="u.id">{{ u.name }}</option></select></label>
          <label class="block text-sm"><span class="lbl">{{ t('payConfig.period') }}</span><input v-model="bonForm.period" type="month" required class="field" /></label>
          <label class="block text-sm"><span class="lbl">{{ t('payConfig.bonusType') }}</span><select v-model="bonForm.type" class="field"><option value="bonus">{{ t('payConfig.bonus') }}</option><option value="allowance">{{ t('payConfig.allowance') }}</option><option value="deduction">{{ t('payConfig.deduction') }}</option></select></label>
          <label class="block text-sm"><span class="lbl">{{ t('payConfig.amount') }}</span><input v-model.number="bonForm.amount" type="number" step="0.01" required class="field" /></label>
          <label class="block text-sm"><span class="lbl">{{ t('payConfig.currency') }}</span><select v-model.number="bonForm.currency_id" required class="field"><option v-for="c in currencies" :key="c.id" :value="c.id">{{ c.code }}</option></select></label>
          <label class="block text-sm"><span class="lbl">{{ t('payConfig.reason') }}</span><input v-model="bonForm.reason" type="text" required maxlength="255" class="field" /></label>
        </div>
        <div class="flex gap-3"><button type="submit" :disabled="saving" class="btn-primary disabled:opacity-60">{{ saving ? t('common.saving') : t('common.save') }}</button><button type="button" class="btn-ghost" @click="bonForm.open = false">{{ t('common.cancel') }}</button></div>
      </form>
      <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <p v-if="!bonuses.length" class="p-6 text-sm text-slate-500">{{ t('payConfig.emptyBonuses') }}</p>
        <table v-else class="w-full text-start text-sm">
          <thead class="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400"><tr><th class="px-4 py-3 text-start">{{ t('payConfig.employee') }}</th><th class="px-4 py-3 text-start">{{ t('payConfig.period') }}</th><th class="px-4 py-3 text-start">{{ t('payConfig.bonusType') }}</th><th class="px-4 py-3 text-start">{{ t('payConfig.amount') }}</th><th class="px-4 py-3 text-start">{{ t('payConfig.reason') }}</th><th class="px-4 py-3 text-end">{{ t('companies.actions') }}</th></tr></thead>
          <tbody class="divide-y divide-slate-100 dark:divide-slate-800">
            <tr v-for="b in bonuses" :key="b.id">
              <td class="px-4 py-3 font-medium text-slate-900 dark:text-white">{{ b.user?.name ?? userName(b.user_id) }}</td>
              <td class="px-4 py-3 text-slate-500" dir="ltr">{{ b.period }}</td>
              <td class="px-4 py-3 text-slate-500">{{ t('payConfig.' + b.type) }}</td>
              <td class="px-4 py-3 text-slate-500" dir="ltr">{{ Number(b.amount).toLocaleString('en-US') }} {{ b.currency?.code ?? curCode(b.currency_id) }}</td>
              <td class="px-4 py-3 text-slate-500">{{ b.reason }}</td>
              <td class="px-4 py-3"><div class="flex justify-end gap-3"><button v-can="'bonuses.update'" type="button" class="text-slate-600 hover:underline dark:text-slate-300" @click="openBonus(b)">{{ t('common.edit') }}</button><button v-can="'bonuses.delete'" type="button" class="text-rose-600 hover:underline dark:text-rose-400" @click="removeBonus(b)">{{ t('common.delete') }}</button></div></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<style scoped>
.field { width: 100%; border-radius: 0.5rem; border: 1px solid rgb(203 213 225); background: #fff; padding: 0.5rem 0.75rem; font-size: 0.875rem; color: rgb(15 23 42); outline: none; }
.field:focus { border-color: rgb(99 102 241); box-shadow: 0 0 0 2px rgb(99 102 241 / 0.3); }
.uppercase { text-transform: uppercase; }
:global(.dark) .field { border-color: rgb(51 65 85); background: rgb(30 41 59); color: #fff; }
.lbl { margin-bottom: 0.25rem; display: block; font-weight: 500; font-size: 0.875rem; color: rgb(51 65 85); }
:global(.dark) .lbl { color: rgb(203 213 225); }
.btn-primary { border-radius: 0.5rem; background: rgb(79 70 229); padding: 0.5rem 1rem; font-size: 0.875rem; font-weight: 500; color: #fff; transition: background 0.15s; }
.btn-primary:hover { background: rgb(67 56 202); }
.btn-ghost { border-radius: 0.5rem; padding: 0.5rem 1rem; font-size: 0.875rem; font-weight: 500; color: rgb(71 85 105); }
:global(.dark) .btn-ghost { color: rgb(148 163 184); }
</style>
