<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { notificationsApi, type NotificationItem, type NotificationSeverity } from '@/api/notifications'

// جرس الإشعارات الموحّد في النابار (FE-52) — يستهلك BE-96.
// شارة بعدّاد غير المقروء (استطلاع ~30ث) + لوحة منسدلة بالـ feed، تعليم مقروء + انتقال للمصدر.
const { t, locale } = useI18n()
const router = useRouter()

const open = ref(false)
const loading = ref(false)
const items = ref<NotificationItem[]>([])
const unread = ref(0)
let poll: number | undefined

// أيقونة/لون حسب الشدّة.
const SEVERITY: Record<NotificationSeverity, { icon: string; cls: string }> = {
  info: { icon: 'pi-info-circle', cls: 'text-sky-500' },
  success: { icon: 'pi-check-circle', cls: 'text-emerald-500' },
  warning: { icon: 'pi-exclamation-triangle', cls: 'text-amber-500' },
  error: { icon: 'pi-times-circle', cls: 'text-rose-500' },
}
const sev = (s: NotificationSeverity) => SEVERITY[s] ?? SEVERITY.info

const badge = computed(() => (unread.value > 99 ? '99+' : String(unread.value)))

function rel(d: string): string {
  try {
    const diff = Date.now() - new Date(d).getTime()
    const min = Math.round(diff / 60000)
    const rtf = new Intl.RelativeTimeFormat(locale.value === 'ar' ? 'ar' : 'en', { numeric: 'auto' })
    if (min < 1) return t('notifications.now')
    if (min < 60) return rtf.format(-min, 'minute')
    const hr = Math.round(min / 60)
    if (hr < 24) return rtf.format(-hr, 'hour')
    return rtf.format(-Math.round(hr / 24), 'day')
  } catch {
    return d
  }
}

async function refreshCount(): Promise<void> {
  try {
    unread.value = await notificationsApi.unreadCount()
  } catch {
    /* تجاهل بهدوء (الجرس لا يكسر النابار) */
  }
}

async function loadFeed(): Promise<void> {
  loading.value = true
  try {
    const feed = await notificationsApi.list({ per_page: 20 })
    items.value = feed.items
    unread.value = feed.unreadCount
  } catch {
    items.value = []
  } finally {
    loading.value = false
  }
}

function toggle(): void {
  open.value = !open.value
  if (open.value) void loadFeed()
}

async function onItemClick(n: NotificationItem): Promise<void> {
  if (!n.read_at) {
    n.read_at = new Date().toISOString()
    unread.value = Math.max(0, unread.value - 1)
    notificationsApi.markRead(n.id).catch(() => void refreshCount())
  }
  open.value = false
  if (n.link) {
    if (/^https?:\/\//i.test(n.link)) window.open(n.link, '_blank', 'noopener')
    else void router.push(n.link)
  }
}

async function markAll(): Promise<void> {
  unread.value = 0
  items.value = items.value.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() }))
  try {
    await notificationsApi.markAllRead()
  } catch {
    void refreshCount()
  }
}

onMounted(() => {
  void refreshCount()
  poll = window.setInterval(() => void refreshCount(), 30000)
})
onBeforeUnmount(() => {
  if (poll) clearInterval(poll)
})
</script>

<template>
  <div class="relative">
    <button
      type="button"
      class="relative grid size-10 place-items-center rounded-xl text-surface-600 transition hover:bg-surface-100 dark:text-surface-300 dark:hover:bg-surface-800"
      :title="t('notifications.title')"
      :aria-label="t('notifications.title')"
      @click="toggle"
    >
      <i class="pi pi-bell text-lg" />
      <span
        v-if="unread > 0"
        class="absolute -top-0.5 grid min-w-[1.1rem] place-items-center rounded-full bg-rose-500 px-1 text-[10px] font-bold leading-4 text-white ltr:-right-0.5 rtl:-left-0.5"
        dir="ltr"
      >{{ badge }}</span>
    </button>

    <!-- خلفية لإغلاق اللوحة عند النقر خارجها -->
    <div v-if="open" class="fixed inset-0 z-30" @click="open = false"></div>

    <!-- اللوحة المنسدلة -->
    <div
      v-if="open"
      class="absolute z-40 mt-2 w-[22rem] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-surface-200 bg-white shadow-xl ltr:right-0 rtl:left-0 dark:border-surface-700 dark:bg-surface-900"
    >
      <div class="flex items-center justify-between border-b border-surface-100 px-4 py-3 dark:border-surface-800">
        <h3 class="text-sm font-semibold text-surface-800 dark:text-surface-100">{{ t('notifications.title') }}</h3>
        <button
          type="button"
          class="text-xs font-medium text-primary-600 transition hover:underline disabled:opacity-40 dark:text-primary-400"
          :disabled="unread === 0"
          @click="markAll"
        >{{ t('notifications.markAllRead') }}</button>
      </div>

      <div class="max-h-[24rem] overflow-y-auto">
        <p v-if="loading" class="px-4 py-8 text-center text-sm text-surface-500">{{ t('common.loading') }}</p>
        <p v-else-if="!items.length" class="px-4 py-10 text-center text-sm text-surface-500">
          <i class="pi pi-inbox mb-2 block text-2xl text-surface-300 dark:text-surface-600" />
          {{ t('notifications.empty') }}
        </p>
        <ul v-else class="divide-y divide-surface-100 dark:divide-surface-800">
          <li v-for="n in items" :key="n.id">
            <button
              type="button"
              class="flex w-full items-start gap-3 px-4 py-3 text-start transition hover:bg-surface-50 dark:hover:bg-surface-800"
              :class="{ 'bg-primary-50/60 dark:bg-primary-500/10': !n.read_at }"
              @click="onItemClick(n)"
            >
              <i class="pi mt-0.5 shrink-0 text-base" :class="[sev(n.severity).icon, sev(n.severity).cls]" />
              <span class="min-w-0 flex-1">
                <span class="flex items-center gap-2">
                  <span class="min-w-0 flex-1 truncate text-sm font-medium text-surface-800 dark:text-surface-100">{{ n.title }}</span>
                  <span v-if="!n.read_at" class="size-2 shrink-0 rounded-full bg-primary-500"></span>
                </span>
                <span v-if="n.body" class="mt-0.5 block line-clamp-2 text-xs text-surface-500">{{ n.body }}</span>
                <span class="mt-1 block text-[11px] text-surface-400" dir="auto">{{ rel(n.created_at) }}</span>
              </span>
              <i v-if="n.link" class="pi pi-angle-left mt-1 shrink-0 text-xs text-surface-300 rtl:rotate-180 dark:text-surface-600" />
            </button>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
