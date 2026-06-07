import { apiClient, unwrap } from './client'

export interface GeoPolygon {
  type: 'Polygon'
  coordinates: number[][][] // [ring][point][lng,lat]
}

export interface GeoPoint {
  type: 'Point'
  coordinates: number[] // [lng, lat]
}

export interface WorkSite {
  id: number
  company_id: number | null
  name: string
  buffer_meters: number
  address: string | null
  is_active: boolean
  area: GeoPolygon | null
  center: GeoPoint | null
}

export interface WorkSitePayload {
  name: string
  buffer_meters?: number
  address?: string | null
  is_active?: boolean
  area: GeoPolygon
  center?: GeoPoint | null
}

export const workSitesApi = {
  list() {
    return unwrap<WorkSite[]>(apiClient.get('/work-sites'))
  },
  get(id: number) {
    return unwrap<WorkSite>(apiClient.get(`/work-sites/${id}`))
  },
  create(payload: WorkSitePayload) {
    return unwrap<WorkSite>(apiClient.post('/work-sites', payload))
  },
  update(id: number, payload: Partial<WorkSitePayload>) {
    return unwrap<WorkSite>(apiClient.put(`/work-sites/${id}`, payload))
  },
  remove(id: number) {
    return unwrap<{ deleted: boolean }>(apiClient.delete(`/work-sites/${id}`))
  },
}

// يبني GeoJSON Polygon مغلقاً من رؤوس [lng,lat] (≥3 رؤوس).
export function buildPolygon(vertices: number[][]): GeoPolygon | null {
  if (vertices.length < 3) return null
  const ring = [...vertices.map((v) => [v[0], v[1]]), [vertices[0][0], vertices[0][1]]]
  return { type: 'Polygon', coordinates: [ring] }
}

// مركز تقريبي (متوسّط الرؤوس) كـ GeoJSON Point.
export function centroidPoint(vertices: number[][]): GeoPoint | null {
  if (!vertices.length) return null
  const sum = vertices.reduce((a, v) => [a[0] + v[0], a[1] + v[1]], [0, 0])
  return { type: 'Point', coordinates: [sum[0] / vertices.length, sum[1] / vertices.length] }
}
