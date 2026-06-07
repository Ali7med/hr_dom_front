<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { buildPolygon, type GeoPolygon } from '@/api/worksites'

const props = withDefaults(
  defineProps<{ modelValue: GeoPolygon | null; editable?: boolean }>(),
  { editable: true },
)
const emit = defineEmits<{ 'update:modelValue': [GeoPolygon | null] }>()

const { t } = useI18n()

// رؤوس المضلّع بترتيب GeoJSON [lng, lat].
const vertices = ref<number[][]>([])
const mapEl = ref<HTMLElement | null>(null)
let map: L.Map | null = null
let drawLayer: L.LayerGroup | null = null

const DEFAULT_CENTER: L.LatLngExpression = [33.3152, 44.3661] // بغداد
const DEFAULT_ZOOM = 11

function emitPolygon(): void {
  emit('update:modelValue', buildPolygon(vertices.value))
}

function render(): void {
  if (!map || !drawLayer) return
  drawLayer.clearLayers()
  const latlngs = vertices.value.map((v) => [v[1], v[0]] as L.LatLngTuple)

  if (latlngs.length >= 3) {
    L.polygon(latlngs, { color: '#4f46e5', fillColor: '#6366f1', fillOpacity: 0.25 }).addTo(drawLayer)
  } else if (latlngs.length === 2) {
    L.polyline(latlngs, { color: '#4f46e5' }).addTo(drawLayer)
  }
  latlngs.forEach((ll, i) => {
    L.circleMarker(ll, {
      radius: 5,
      color: '#4338ca',
      fillColor: i === 0 ? '#22c55e' : '#fff',
      fillOpacity: 1,
      weight: 2,
    }).addTo(drawLayer!)
  })
}

function undo(): void {
  vertices.value.pop()
  render()
  emitPolygon()
}

function clear(): void {
  vertices.value = []
  render()
  emitPolygon()
}

onMounted(() => {
  if (!mapEl.value) return
  map = L.map(mapEl.value).setView(DEFAULT_CENTER, DEFAULT_ZOOM)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
    maxZoom: 19,
  }).addTo(map)
  drawLayer = L.layerGroup().addTo(map)

  // تحميل المضلّع القائم (إن وُجد) — نُسقط نقطة الإغلاق.
  const ring = props.modelValue?.coordinates?.[0]
  if (ring && ring.length >= 4) {
    vertices.value = ring.slice(0, -1).map((p) => [p[0], p[1]])
    render()
    const bounds = L.latLngBounds(vertices.value.map((v) => [v[1], v[0]] as L.LatLngTuple))
    map.fitBounds(bounds, { padding: [30, 30] })
  }

  if (props.editable) {
    map.on('click', (e: L.LeafletMouseEvent) => {
      vertices.value.push([e.latlng.lng, e.latlng.lat])
      render()
      emitPolygon()
    })
  }

  // الخريطة قد تُركَّب داخل نموذج مخفي — أعِد حساب الحجم بعد الظهور.
  setTimeout(() => map?.invalidateSize(), 120)
})

onBeforeUnmount(() => {
  map?.remove()
  map = null
})
</script>

<template>
  <div class="space-y-2">
    <div v-if="editable" class="flex items-center gap-3 text-sm">
      <span class="text-slate-500 dark:text-slate-400">{{ t('worksites.drawHint') }}</span>
      <span class="text-xs text-slate-400">({{ t('worksites.points', { n: vertices.length }) }})</span>
      <button type="button" class="ms-auto rounded-lg border border-slate-300 px-3 py-1 text-xs dark:border-slate-700" @click="undo">{{ t('worksites.undo') }}</button>
      <button type="button" class="rounded-lg border border-slate-300 px-3 py-1 text-xs dark:border-slate-700" @click="clear">{{ t('worksites.clear') }}</button>
    </div>
    <div ref="mapEl" class="h-80 w-full rounded-xl border border-slate-200 dark:border-slate-700" style="z-index: 0"></div>
  </div>
</template>
