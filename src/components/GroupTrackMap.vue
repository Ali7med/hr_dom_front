<script lang="ts">
import type { TrackPoint } from '@/api/tracking'

// نموذج عرض لسلسلة موظف على الخريطة الجماعية (مُصدَّر لاستخدام الصفحة المستهلِكة).
export interface GroupSeries {
  userId: number
  name: string
  color: string
  visible: boolean
  points: TrackPoint[]
  lastSeenAt?: string | null
}
</script>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// خريطة جماعية (قراءة-فقط): مسارات عدّة موظفين، كلٌّ بلونه + علامتا بداية/نهاية واضحتان
// + علامة متحركة نابضة للمشغّل الزمني + وضع مباشر. يعيد استخدام نمط Leaflet/OSM من TrackMap (FE-46).
const props = defineProps<{
  series: GroupSeries[]
  mode: 'history' | 'live'
  // الوقت الحالي للمشغّل الزمني (epoch ms) — عند ضبطه تُرسَم علامة متحركة لكل موظف. الوضع التاريخي فقط.
  cursorTime?: number | null
}>()

const { t, locale } = useI18n()

const mapEl = ref<HTMLElement | null>(null)
let map: L.Map | null = null
let baseLayer: L.LayerGroup | null = null
let resizeObserver: ResizeObserver | null = null
const cursorMarkers = new Map<number, L.Marker>()
// فهرس النقاط/الأزمنة لكل موظف (لاستيفاء موضع العلامة المتحركة بكفاءة).
const seriesIndex = new Map<number, { pts: TrackPoint[]; times: number[] }>()

const DEFAULT_CENTER: L.LatLngExpression = [33.3152, 44.3661] // بغداد (احتياطي)
const DEFAULT_ZOOM = 11

function fmt(d: string): string {
  try {
    return new Date(d).toLocaleString(locale.value === 'ar' ? 'ar' : 'en', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return d
  }
}

function popupHtml(p: TrackPoint, name: string): string {
  const rows = [
    `<b>${name}</b>`,
    fmt(p.recorded_at),
    p.accuracy != null ? `${t('tracking.accuracy')}: ${Math.round(p.accuracy)} m` : '',
    p.battery != null ? `${t('tracking.battery')}: ${p.battery}%` : '',
    p.is_mock ? `⚠ ${t('tracking.mock')}` : '',
  ].filter(Boolean)
  return `<div dir="ltr" style="font-size:12px;line-height:1.5">${rows.join('<br>')}</div>`
}

// علامة بداية (دائرة + ▶) أو نهاية (مربّعة + 🏁) بلون الموظف — شكلان مختلفان ليُميَّزا بصرياً.
function endpointIcon(color: string, kind: 'start' | 'end'): L.DivIcon {
  const glyph = kind === 'start' ? '▶' : '🏁'
  return L.divIcon({
    className: 'trk-divicon',
    html: `<span class="trk-pin trk-${kind}" style="--c:${color}">${glyph}</span>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}

// علامة متحركة نابضة (للمشغّل الزمني) بلون الموظف.
function cursorIcon(color: string): L.DivIcon {
  return L.divIcon({
    className: 'trk-divicon',
    html: `<span class="trk-cursor" style="--c:${color}"><span class="trk-ping"></span></span>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  })
}

function rebuild(): void {
  if (!map || !baseLayer) return
  baseLayer.clearLayers()
  seriesIndex.clear()

  const visible = props.series.filter((s) => s.visible && s.points.length > 0)
  const labelPermanent = visible.length <= 10 // تفادي تكدّس التسميات الدائمة
  const allLatLngs: L.LatLngTuple[] = []

  for (const s of visible) {
    const latlngs = s.points.map((p) => [p.lat, p.lng] as L.LatLngTuple)
    allLatLngs.push(...latlngs)
    seriesIndex.set(s.userId, {
      pts: s.points,
      times: s.points.map((p) => new Date(p.recorded_at).getTime()),
    })

    if (props.mode === 'history') {
      L.polyline(latlngs, { color: s.color, weight: 4, opacity: 0.85 }).addTo(baseLayer)
      // علامتا البداية (▶) والنهاية (🏁) بلون الموظف.
      const start = s.points[0]
      const end = s.points[s.points.length - 1]
      L.marker([start.lat, start.lng], { icon: endpointIcon(s.color, 'start') })
        .addTo(baseLayer)
        .bindPopup(popupHtml(start, `${s.name} · ${t('tracking.startPoint')}`))
      if (end !== start) {
        L.marker([end.lat, end.lng], { icon: endpointIcon(s.color, 'end') })
          .addTo(baseLayer)
          .bindPopup(popupHtml(end, `${s.name} · ${t('tracking.endPoint')}`))
      }
    } else {
      // مباشر: أثر حديث خفيف (متقطّع) + علامة الموقع الحالي بلون الموظف.
      if (latlngs.length > 1) {
        L.polyline(latlngs, { color: s.color, weight: 2, opacity: 0.5, dashArray: '4 4' }).addTo(baseLayer)
      }
      const cur = s.points[s.points.length - 1]
      const marker = L.circleMarker([cur.lat, cur.lng], {
        radius: 8,
        color: '#fff',
        fillColor: s.color,
        fillOpacity: 1,
        weight: 3,
      })
        .addTo(baseLayer)
        .bindPopup(popupHtml(cur, s.name))
      marker.bindTooltip(s.name, { permanent: labelPermanent, direction: 'top', className: 'group-track-label' })
    }
  }

  if (allLatLngs.length) {
    map.fitBounds(L.latLngBounds(allLatLngs), { padding: [40, 40], maxZoom: 16 })
  }
  updateCursor()
}

// موضع مستوفىً للموظف عند الوقت t (epoch ms) ضمن نقاطه المرتّبة تصاعدياً.
function positionAt(pts: TrackPoint[], times: number[], tMs: number): L.LatLngTuple | null {
  if (!pts.length) return null
  if (tMs <= times[0]) return [pts[0].lat, pts[0].lng]
  const last = pts.length - 1
  if (tMs >= times[last]) return [pts[last].lat, pts[last].lng]
  let i = 0
  while (i < last && times[i + 1] <= tMs) i++
  const t0 = times[i]
  const t1 = times[i + 1]
  const f = t1 === t0 ? 0 : (tMs - t0) / (t1 - t0)
  const a = pts[i]
  const b = pts[i + 1]
  return [a.lat + (b.lat - a.lat) * f, a.lng + (b.lng - a.lng) * f]
}

function updateCursor(): void {
  if (!map || !baseLayer) return
  const tMs = props.cursorTime
  // إزالة العلامات المتحركة عند الوضع المباشر أو غياب الوقت أو إخفاء الموظف.
  if (props.mode !== 'history' || tMs == null) {
    cursorMarkers.forEach((m) => m.remove())
    cursorMarkers.clear()
    return
  }
  const visibleIds = new Set(props.series.filter((s) => s.visible).map((s) => s.userId))
  // أزل علامات الموظفين غير المرئيين.
  for (const [id, m] of cursorMarkers) {
    if (!visibleIds.has(id) || !seriesIndex.has(id)) {
      m.remove()
      cursorMarkers.delete(id)
    }
  }
  for (const s of props.series) {
    if (!s.visible) continue
    const idx = seriesIndex.get(s.userId)
    if (!idx) continue
    const pos = positionAt(idx.pts, idx.times, tMs)
    if (!pos) continue
    let marker = cursorMarkers.get(s.userId)
    if (!marker) {
      marker = L.marker(pos, { icon: cursorIcon(s.color), zIndexOffset: 1000 })
      marker.bindTooltip(s.name, { permanent: true, direction: 'top', className: 'group-track-label' })
      marker.addTo(baseLayer)
      cursorMarkers.set(s.userId, marker)
    } else {
      marker.setLatLng(pos)
    }
  }
}

onMounted(() => {
  if (!mapEl.value) return
  map = L.map(mapEl.value).setView(DEFAULT_CENTER, DEFAULT_ZOOM)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap',
    maxZoom: 19,
  }).addTo(map)
  baseLayer = L.layerGroup().addTo(map)
  rebuild()
  setTimeout(() => map?.invalidateSize(), 120)
  // أعِد حساب حجم الخريطة عند تغيّر أبعاد الحاوية (ملء الشاشة/تبديل التخطيط).
  resizeObserver = new ResizeObserver(() => map?.invalidateSize())
  resizeObserver.observe(mapEl.value)
})

// إعادة البناء عند تغيّر السلاسل أو الوضع؛ تحديث خفيف للعلامة المتحركة عند تحريك المؤشّر.
watch(() => props.series, () => rebuild(), { deep: true })
watch(() => props.mode, () => rebuild())
watch(() => props.cursorTime, () => updateCursor())

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  map?.remove()
  map = null
  baseLayer = null
  cursorMarkers.clear()
})
</script>

<template>
  <div ref="mapEl" class="size-full min-h-80 rounded-xl border border-surface-200 dark:border-surface-700" style="z-index: 0"></div>
</template>

<style>
.group-track-label {
  font-size: 11px;
  font-weight: 600;
  background: rgba(255, 255, 255, 0.92);
  border: none;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  padding: 1px 6px;
}
.group-track-label::before {
  display: none;
}

/* علامات المسير المخصّصة — إزالة خلفية divIcon الافتراضية. */
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
/* مؤشّر المشغّل الزمني: نقطة نابضة بلون الموظف. */
.trk-cursor {
  position: relative;
  display: block;
  width: 18px;
  height: 18px;
}
.trk-cursor::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: var(--c);
  border: 3px solid #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.5);
}
.trk-ping {
  position: absolute;
  inset: -5px;
  border-radius: 50%;
  border: 2px solid var(--c);
  animation: trkping 1.1s ease-out infinite;
}
@keyframes trkping {
  0% {
    transform: scale(0.55);
    opacity: 0.9;
  }
  100% {
    transform: scale(1.9);
    opacity: 0;
  }
}
</style>
