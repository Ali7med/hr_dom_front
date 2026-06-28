<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { TrackPoint } from '@/api/tracking'

// خريطة قراءة-فقط لعرض خط مسير موظف (polyline + نقاط بوقتها). يعيد استخدام نمط Leaflet من FE-05.
const props = defineProps<{ points: TrackPoint[] }>()
const { t, locale } = useI18n()

const mapEl = ref<HTMLElement | null>(null)
let map: L.Map | null = null
let layer: L.LayerGroup | null = null
let resizeObserver: ResizeObserver | null = null

const DEFAULT_CENTER: L.LatLngExpression = [33.3152, 44.3661] // بغداد (احتياطي)
const DEFAULT_ZOOM = 11

function fmt(d: string): string {
  try {
    return new Date(d).toLocaleString(locale.value === 'ar' ? 'ar' : 'en', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return d
  }
}

// علامة بداية (خضراء + ▶) أو نهاية (حمراء مربّعة + 🏁) — لونان وشكلان مختلفان للتمييز.
function endpointIcon(kind: 'start' | 'end'): L.DivIcon {
  const color = kind === 'start' ? '#22c55e' : '#ef4444'
  const glyph = kind === 'start' ? '▶' : '🏁'
  return L.divIcon({
    className: 'trk-divicon',
    html: `<span class="trk-pin trk-${kind}" style="--c:${color}">${glyph}</span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}

function popup(p: TrackPoint, label?: string): string {
  const rows = [
    label ? `<b>${label}</b>` : '',
    `<b>${fmt(p.recorded_at)}</b>`,
    p.accuracy != null ? `${t('tracking.accuracy')}: ${Math.round(p.accuracy)} m` : '',
    p.battery != null ? `${t('tracking.battery')}: ${p.battery}%` : '',
    p.is_mock ? `⚠ ${t('tracking.mock')}` : '',
  ].filter(Boolean)
  return `<div dir="ltr" style="font-size:12px;line-height:1.5">${rows.join('<br>')}</div>`
}

function render(): void {
  if (!map || !layer) return
  layer.clearLayers()
  const pts = props.points
  if (!pts.length) return
  const latlngs = pts.map((p) => [p.lat, p.lng] as L.LatLngTuple)

  L.polyline(latlngs, { color: '#4f46e5', weight: 4, opacity: 0.85 }).addTo(layer)

  // النقاط الوسطى: دوائر صغيرة خفيفة.
  pts.forEach((p, i) => {
    if (i === 0 || i === pts.length - 1) return
    L.circleMarker([p.lat, p.lng], {
      radius: 4,
      color: '#6366f1',
      fillColor: '#6366f1',
      fillOpacity: 0.85,
      weight: 1,
    })
      .addTo(layer!)
      .bindPopup(popup(p))
  })

  // علامتا البداية والنهاية مع تسمية دائمة واضحة.
  const start = pts[0]
  const end = pts[pts.length - 1]
  L.marker([start.lat, start.lng], { icon: endpointIcon('start') })
    .addTo(layer)
    .bindPopup(popup(start, t('tracking.startPoint')))
    .bindTooltip(t('tracking.startPoint'), { permanent: true, direction: 'top', className: 'group-track-label' })
  if (end !== start) {
    L.marker([end.lat, end.lng], { icon: endpointIcon('end'), zIndexOffset: 1000 })
      .addTo(layer)
      .bindPopup(popup(end, t('tracking.endPoint')))
      .bindTooltip(t('tracking.endPoint'), { permanent: true, direction: 'top', className: 'group-track-label' })
  }

  map.fitBounds(L.latLngBounds(latlngs), { padding: [40, 40], maxZoom: 16 })
}

onMounted(() => {
  if (!mapEl.value) return
  map = L.map(mapEl.value).setView(DEFAULT_CENTER, DEFAULT_ZOOM)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
    maxZoom: 19,
  }).addTo(map)
  layer = L.layerGroup().addTo(map)
  render()
  // قد تُركَّب الخريطة بعد تبويب/تحميل — أعِد حساب الحجم.
  setTimeout(() => map?.invalidateSize(), 120)
  // أعِد الحساب عند تغيّر أبعاد الحاوية (ملء الشاشة).
  resizeObserver = new ResizeObserver(() => map?.invalidateSize())
  resizeObserver.observe(mapEl.value)
})

watch(() => props.points, () => render(), { deep: true })

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  map?.remove()
  map = null
})
</script>

<template>
  <div ref="mapEl" class="size-full min-h-80 rounded-xl border border-surface-200 dark:border-surface-700" style="z-index: 0"></div>
</template>

<style>
/* علامات البداية/النهاية المخصّصة (مشتركة مع GroupTrackMap عبر .trk-*). */
.trk-divicon {
  background: transparent;
  border: none;
}
.trk-pin {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  background: var(--c);
  color: #fff;
  border: 2px solid #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
  font-size: 13px;
  line-height: 1;
}
.trk-start {
  border-radius: 50%;
}
.trk-end {
  border-radius: 7px;
}
</style>
