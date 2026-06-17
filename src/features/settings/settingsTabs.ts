// تبويبات صفحة الإعدادات (الضبط الإداري) — مصدر واحد يستخدمه الموجّه والـ SettingsLayout.
export interface SettingsTab {
  name: string // اسم المسار (يبقى كما كان قبل النقل تحت /settings)
  key: string // مفتاح i18n للعنوان
  icon: string // PrimeIcon
  permission: string | string[] // صلاحية (أو أيٌّ منها) للوصول
}

export const settingsTabs: SettingsTab[] = [
  { name: 'companies', key: 'nav.companies', icon: 'pi pi-building', permission: 'companies.view' },
  { name: 'users', key: 'nav.users', icon: 'pi pi-users', permission: 'users.view' },
  { name: 'roles', key: 'nav.roles', icon: 'pi pi-shield', permission: 'roles.view' },
  { name: 'work-sites', key: 'nav.worksites', icon: 'pi pi-map-marker', permission: 'work_sites.view' },
  {
    name: 'schedule',
    key: 'nav.schedule',
    icon: 'pi pi-calendar',
    permission: ['shifts.view', 'schedules.view', 'holidays.view'],
  },
  { name: 'device-requests', key: 'nav.deviceRequests', icon: 'pi pi-mobile', permission: 'devices.rebind_approve' },
  {
    name: 'payroll-config',
    key: 'nav.payrollConfig',
    icon: 'pi pi-sliders-h',
    permission: ['currencies.view', 'salary_rules.view', 'penalty_rules.view', 'bonuses.view'],
  },
  { name: 'notification-settings', key: 'nav.notificationSettings', icon: 'pi pi-send', permission: 'notification_settings.manage' },
  { name: 'backups', key: 'nav.backups', icon: 'pi pi-database', permission: 'backups.manage' },
]

// كل صلاحيات الضبط مجموعةً — للوصول لصفحة الإعدادات يكفي امتلاك أيٍّ منها.
export const allSettingsPermissions = settingsTabs.flatMap((t) =>
  typeof t.permission === 'string' ? [t.permission] : t.permission,
)
