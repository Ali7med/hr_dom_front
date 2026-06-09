import { apiClient, unwrap } from './client'

// تخزين تفضيلات لوحة المعلومات لكل مستخدم.
//
// المصدر الموثوق: نقطة الباك `GET/PUT /me/preferences` (BE-FE12) — مزامنة عبر
// الأجهزة. و`localStorage` يُستخدم كـ **كاش فوري/غير متصل**: قراءة فورية عند
// الإقلاع ثم تحديث من الخادم، وكتابة محليّة + إرسال للخادم عند كل تغيير.
//
// شكل تفضيلات اللوحة على الخادم: { dashboard: { layout: string[] } }.

export interface DashboardPrefs {
  layout: string[]
}

const VERSION = 'v1'
const key = (userId: number | string) => `hr_dom.dashboard.${VERSION}.${userId}`

function readLocal(userId: number | string): DashboardPrefs | null {
  try {
    const raw = localStorage.getItem(key(userId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as DashboardPrefs
    if (parsed && Array.isArray(parsed.layout)) return parsed
  } catch {
    // تجاهل المخزون التالف
  }
  return null
}

function writeLocal(userId: number | string, prefs: DashboardPrefs): void {
  try {
    localStorage.setItem(key(userId), JSON.stringify(prefs))
  } catch {
    // localStorage ممتلئ/معطّل — تجاهل
  }
}

export const dashboardPrefs = {
  // كاش محلّي فوري (متزامن) — للعرض المبدئي قبل ردّ الخادم.
  loadLocal(userId: number | string): DashboardPrefs | null {
    return readLocal(userId)
  },

  // المصدر الموثوق: تفضيلات المستخدم من الخادم (أو null إن لم تُحفَظ بعد/تعذّر).
  async loadRemote(): Promise<DashboardPrefs | null> {
    try {
      const data = await unwrap<{ dashboard?: { layout?: string[] } }>(apiClient.get('/me/preferences'))
      const layout = data?.dashboard?.layout
      if (Array.isArray(layout)) return { layout }
    } catch {
      // غير مصادق/الشبكة مقطوعة — نعتمد الكاش المحلّي
    }
    return null
  },

  // حفظ تغيير المستخدم: كتابة محليّة فورية + مزامنة للخادم (تتحمّل الفشل).
  save(userId: number | string, prefs: DashboardPrefs): void {
    writeLocal(userId, prefs)
    apiClient.put('/me/preferences', { dashboard: { layout: prefs.layout } }).catch(() => {
      // فشل المزامنة — يبقى المحفوظ محليّاً
    })
  },

  // تحديث الكاش المحلّي فقط (بعد جلب من الخادم) دون إعادة إرسال.
  cache(userId: number | string, prefs: DashboardPrefs): void {
    writeLocal(userId, prefs)
  },

  clear(userId: number | string): void {
    try {
      localStorage.removeItem(key(userId))
    } catch {
      // تجاهل
    }
  },
}
