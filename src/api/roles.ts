import { apiClient, unwrap } from './client'

export interface Role {
  id: number
  name: string
  company_id: number | null
  permissions: string[]
}

export interface RolePayload {
  name?: string
  permissions?: string[]
}

export const rolesApi = {
  list() {
    return unwrap<Role[]>(apiClient.get('/roles'))
  },
  create(payload: { name: string; permissions?: string[] }) {
    return unwrap<Role>(apiClient.post('/roles', payload))
  },
  update(id: number, payload: RolePayload) {
    return unwrap<Role>(apiClient.put(`/roles/${id}`, payload))
  },
  remove(id: number) {
    return unwrap<{ deleted: boolean }>(apiClient.delete(`/roles/${id}`))
  },
}

export const permissionsApi = {
  // قائمة بكل أسماء الصلاحيات (مرتّبة) — تُجمَّع في الواجهة حسب المجال.
  list() {
    return unwrap<string[]>(apiClient.get('/permissions'))
  },
}

// تجميع الصلاحيات حسب البادئة قبل النقطة (companies.view -> مجموعة "companies").
export function groupPermissions(perms: string[]): Record<string, string[]> {
  return perms.reduce<Record<string, string[]>>((acc, p) => {
    const group = p.includes('.') ? p.slice(0, p.indexOf('.')) : 'other'
    ;(acc[group] ??= []).push(p)
    return acc
  }, {})
}
