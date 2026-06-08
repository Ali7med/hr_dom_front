// تخزين تفضيلات لوحة المعلومات لكل مستخدم.
//
// حالياً: localStorage (لكل متصفّح/مستخدم). جاهز للتبديل إلى نقطة باك
// `GET/PUT /me/preferences` للمزامنة عبر الأجهزة عند توفّرها — انظر
// hr_dom_docs/backend-tasks/BE-FE12-dashboard-preferences.md
//
// شكل التفضيلات: { layout: string[] } — قائمة معرّفات الودجتات بالترتيب.

export interface DashboardPrefs {
  layout: string[]
}

const VERSION = 'v1'
const key = (userId: number | string) => `hr_dom.dashboard.${VERSION}.${userId}`

export const dashboardPrefs = {
  load(userId: number | string): DashboardPrefs | null {
    try {
      const raw = localStorage.getItem(key(userId))
      if (!raw) return null
      const parsed = JSON.parse(raw) as DashboardPrefs
      if (parsed && Array.isArray(parsed.layout)) return parsed
    } catch {
      // تجاهل المخزون التالف
    }
    return null
  },
  save(userId: number | string, prefs: DashboardPrefs): void {
    try {
      localStorage.setItem(key(userId), JSON.stringify(prefs))
    } catch {
      // localStorage ممتلئ/معطّل — تجاهل
    }
  },
  clear(userId: number | string): void {
    try {
      localStorage.removeItem(key(userId))
    } catch {
      // تجاهل
    }
  },
}
