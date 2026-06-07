import { apiClient, unwrap, type Envelope } from './client'

export type UserStatus = 'active' | 'suspended' | 'left'

export interface User {
  id: number
  name: string
  employee_no: string | null
  email: string | null
  phone: string | null
  status: UserStatus
  department_id: number | null
  department: { id: number; name: string } | null
  roles: string[]
}

export interface Department {
  id: number
  name: string
  manager_user_id: number | null
  manager: { id: number; name: string } | null
  users_count: number
}

export interface UserListParams {
  search?: string
  department_id?: number
  status?: UserStatus
  per_page?: number
  page?: number
}

export interface Pagination {
  total: number
  per_page: number
  current_page: number
  last_page: number
}

export interface UserPayload {
  name: string
  employee_no: string
  email: string
  phone?: string | null
  password?: string
  department_id?: number | null
  status?: UserStatus
  roles?: string[]
}

export const usersApi = {
  async list(params: UserListParams = {}): Promise<{ data: User[]; pagination?: Pagination }> {
    const res = await apiClient.get<Envelope<User[]>>('/users', { params })
    return { data: res.data.data, pagination: res.data.meta?.pagination as Pagination | undefined }
  },
  get(id: number) {
    return unwrap<User>(apiClient.get(`/users/${id}`))
  },
  create(payload: UserPayload) {
    return unwrap<User>(apiClient.post('/users', payload))
  },
  update(id: number, payload: Partial<UserPayload>) {
    return unwrap<User>(apiClient.put(`/users/${id}`, payload))
  },
  remove(id: number) {
    return unwrap<{ deleted: boolean }>(apiClient.delete(`/users/${id}`))
  },
  syncRoles(id: number, roles: string[]) {
    return unwrap<{ roles: string[]; permissions: string[] }>(
      apiClient.post(`/users/${id}/roles`, { roles }),
    )
  },
  syncDirectPermissions(id: number, permissions: string[]) {
    return unwrap<{ direct_permissions: string[]; permissions: string[] }>(
      apiClient.post(`/users/${id}/permissions`, { permissions }),
    )
  },
}

export const departmentsApi = {
  list() {
    return unwrap<Department[]>(apiClient.get('/departments'))
  },
}
