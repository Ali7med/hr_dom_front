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
const locating = ref(false)
let map: L.Map | null = null
let drawLayer: L.LayerGroup | null = null
let meMarker: L.CircleMarker | null = null

const DEFAULT_CENTER: L.LatLngExpression = [33.3152, 44.3661] // بغداد (احتياطي)
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

// علّم موقع المستخدم الحالي على الخريطة.
function markMe(lat: number, lng: number): void {
  if (!map) return
  if (meMarker) meMarker.remove()
  meMarker = L.circleMarker([lat, lng], {
    radius: 7,
    color: '#0ea5e9',
    fillColor: '#0ea5e9',
    fillOpacity: 0.9,
    weight: 3,
  }).addTo(map)
}

// انتقل إلى موقع المستخدم الحالي (زر GPS).
function locateMe(opts: { fly?: boolean } = {}): void {
  if (!('geolocation' in navigator) || !map) return
  locating.value = true
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      locating.value = false
      const { latitude: lat, longitude: lng } = pos.coords
      markMe(lat, lng)
      if (opts.fly) map?.flyTo([lat, lng], 16, { duration: 0.8 })
      else map?.setView([lat, lng], 16)
    },
    () => { locating.value = false }, // رُفض الإذن/تعذّر — نبقى على الموضع الحالي
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
  )
}

// زر GPS كعنصر تحكّم داخل الخريطة.
function addLocateControl(): void {
  if (!map) return
  const LocateControl = L.Control.extend({
    options: { position: 'topleft' },
    onAdd() {
      const btn = L.DomUtil.create('a', 'leaflet-bar leaflet-control hr-locate-btn')
      btn.href = '#'
      btn.title = t('worksites.locateMe')
      btn.setAttribute('role', 'button')
      btn.innerHTML = '<span style="font-size:16px;line-height:30px">📍</span>'
      L.DomEvent.on(btn, 'click', (e) => {
        L.DomEvent.preventDefault(e)
        L.DomEvent.stopPropagation(e)
        locateMe({ fly: true })
      })
      return btn
    },
  })
  map.addControl(new LocateControl())
}

onMounted(() => {
  if (!mapEl.value) return
  map = L.map(mapEl.value).setView(DEFAULT_CENTER, DEFAULT_ZOOM)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
    maxZoom: 19,
  }).addTo(map)
  drawLayer = L.layerGroup().addTo(map)
  addLocateControl()

  // تحميل المضلّع القائم (إن وُجد) — نُسقط نقطة الإغلاق.
  const ring = props.modelValue?.coordinates?.[0]
  if (ring && ring.length >= 4) {
    vertices.value = ring.slice(0, -1).map((p) => [p[0], p[1]])
    render()
    const bounds = L.latLngBounds(vertices.value.map((v) => [v[1], v[0]] as L.LatLngTuple))
    map.fitBounds(bounds, { padding: [30, 30] })
  } else if (props.editable) {
    // موقع جديد: افتح مباشرة على الموقع الحالي للمستخدم (الافتراضي).
    locateMe()
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
    <div v-if="editable" class="flex flex-wrap items-center gap-3 text-sm">
      <span class="text-surface-500 dark:text-surface-400">{{ t('worksites.drawHint') }}</span>
      <span class="text-xs text-surface-400">({{ t('worksites.points', { n: vertices.length }) }})</span>
      <button
        type="button"
        class="ms-auto inline-flex items-center gap-1.5 rounded-lg border border-surface-300 px-3 py-1 text-xs text-surface-600 transition hover:bg-surface-100 disabled:opacity-60 dark:border-surface-700 dark:text-surface-300 dark:hover:bg-surface-800"
        :disabled="locating"
        @click="locateMe({ fly: true })"
      >
        <i class="pi" :class="locating ? 'pi-spin pi-spinner' : 'pi-map-marker'" />
        {{ t('worksites.locateMe') }}
      </button>
      <button type="button" class="rounded-lg border border-surface-300 px-3 py-1 text-xs text-surface-600 transition hover:bg-surface-100 dark:border-surface-700 dark:text-surface-300 dark:hover:bg-surface-800" @click="undo">{{ t('worksites.undo') }}</button>
      <button type="button" class="rounded-lg border border-surface-300 px-3 py-1 text-xs text-surface-600 transition hover:bg-surface-100 dark:border-surface-700 dark:text-surface-300 dark:hover:bg-surface-800" @click="clear">{{ t('worksites.clear') }}</button>
    </div>
    <div ref="mapEl" class="h-80 w-full rounded-xl border border-surface-200 dark:border-surface-700" style="z-index: 0"></div>
  </div>
</template>
