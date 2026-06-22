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

const DEFAULT_CENTER: L.LatLngExpression = [33.3152, 44.3661] // بغداد (احتياطي)
const DEFAULT_ZOOM = 11

function fmt(d: string): string {
  try {
    return new Date(d).toLocaleString(locale.value === 'ar' ? 'ar' : 'en', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return d
  }
}

function render(): void {
  if (!map || !layer) return
  layer.clearLayers()
  const pts = props.points
  if (!pts.length) return
  const latlngs = pts.map((p) => [p.lat, p.lng] as L.LatLngTuple)

  L.polyline(latlngs, { color: '#4f46e5', weight: 3, opacity: 0.8 }).addTo(layer)

  pts.forEach((p, i) => {
    const isStart = i === 0
    const isEnd = i === pts.length - 1
    const color = isStart ? '#22c55e' : isEnd ? '#ef4444' : '#6366f1'
    const marker = L.circleMarker([p.lat, p.lng], {
      radius: isStart || isEnd ? 7 : 5,
      color,
      fillColor: color,
      fillOpacity: 0.9,
      weight: 2,
    }).addTo(layer!)
    const rows = [
      `<b>${fmt(p.recorded_at)}</b>`,
      p.accuracy != null ? `${t('tracking.accuracy')}: ${Math.round(p.accuracy)} m` : '',
      p.battery != null ? `${t('tracking.battery')}: ${p.battery}%` : '',
      p.is_mock ? `⚠ ${t('tracking.mock')}` : '',
    ].filter(Boolean)
    marker.bindPopup(`<div dir="ltr" style="font-size:12px;line-height:1.5">${rows.join('<br>')}</div>`)
  })

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
})

watch(() => props.points, () => render(), { deep: true })

onBeforeUnmount(() => {
  map?.remove()
  map = null
})
</script>

<template>
  <div ref="mapEl" class="h-96 w-full rounded-xl border border-surface-200 dark:border-surface-700" style="z-index: 0"></div>
</template>
