# WORKLOG — سجل العمل (hr_dom_front)

> مدخلة بعد كل تاسك: ماذا أُنجز، الملفات الرئيسية، القرارات، الاختبارات.
>
> القالب (انسخه لكل مدخلة جديدة، الأحدث في الأعلى):
>
> ```
> ## [التاريخ] <task-id> — <العنوان>
> - ما أُنجز:
> - الملفات الرئيسية:
> - قرارات/ملاحظات:
> - الاختبارات:
> ```
>
> **ملاحظة:** المدخلات أدناه **بأثر رجعي** — أُعيد بناؤها من `git log` لأن السجل أُضيف بعد بدء العمل.
> التفاصيل الموسّعة (تحقّق حيّ، قرارات الباك المُمكِّنة) في `hr_dom_docs/WORKLOG.md` (السجل الموحّد).

---

## [2026-06-08] FE-12+ — ودجتات إنتاجية للّوحة
- ما أُنجز: إضافات للوحة المعلومات تزيد الإنتاجية: شريط **إجراءات سريعة** (اختصارات مُفلترة بالصلاحية: إدارة الموظفين/توليد الرواتب/مراجعة الإجازات/الورديات/التقارير/قواعد الرواتب)، و**أعلى المتأخّرين** (أعلى 5 بأيام التأخير من تقرير الحضور)، و**الموظفون حسب القسم** (عمودي)، و**في إجازة اليوم** (إجازات معتمدة تشمل تاريخ اليوم)، و**العطل القادمة** (من اليوم فصاعداً).
- الملفات الرئيسية: `src/features/home/HomeView.vue`، `src/locales/{ar,en}.json`.
- قرارات/ملاحظات: أُعيد استخدام جلب الحضور/الإجازات/المستخدمين القائم (دون نداءات إضافية إلا العطل). كل ودجت محميّ بصلاحيته وبحالة فارغة ودّية. لا اعتماديات جديدة. نُفِّذ على فرع `feature/FE-12-widgets`.
- الاختبارات: `type-check`+`build` خضراء، لا أخطاء console. تحقّق حيّ (Acme Admin): ٦ اختصارات + ٤ ودجتات جديدة بمنطق صحيح (لا تأخيرات، بدون قسم=2، لا أحد بإجازة اليوم لأن إجازة Test Worker 15–17 واليوم 8).

## [2026-06-08] FE-12 — لوحة المعلومات (Dashboard بمؤشّرات ورسوم)
- ما أُنجز: استُبدلت صفحة البداية النائبة بلوحة معلومات إدارية في `hr_dom_front` (`src/features/home/HomeView.vue`): بطاقات مؤشّرات (موظفون نشطون، أقسام، مواقع عمل، ورديات، إجازات معلّقة، أجهزة معلّقة)، قسم «بحاجة إلى إجراء» (روابط للإجازات/الأجهزة المعلّقة)، ورسوم بيانية: عمودي لحضور الشهر (حضور/غياب/تأخير/إجازة من تقرير الحضور)، وحلقي (donut) للإجازات حسب الحالة وللموظفين حسب الحالة، وبطاقة إجمالي صافي رواتب الشهر. **مكوّنات رسوم SVG خفيفة بلا أي اعتمادية جديدة** (`DonutChart`/`BarChart`).
- الملفات الرئيسية: `src/features/home/HomeView.vue`، `src/components/charts/{DonutChart,BarChart}.vue`، `src/locales/{ar,en}.json`.
- قرارات/ملاحظات: كل مصدر بيانات محميّ بصلاحيته (`auth.can`) و`try/catch` صامت — تظهر فقط الودجتات التي يملك المستخدم صلاحية بياناتها (Super Admin يرى الكل). الشهر الحالي يُحسب من وقت المتصفّح. تجميع الحضور من صفوف `reports/attendance`. لا اعتماديات جديدة (SVG يدوي). الحالة `review`.
- الاختبارات: `type-check`+`build` خضراء، لا أخطاء console. تحقّق حيّ (Acme Admin): البطاقات (نشطون 2، مواقع 1، ورديات 1)، donut الموظفين (2 نشط) والإجازات (1)، عمودي الحضور (غياب 4)، وبطاقة الرواتب (1,000,000 IQD / كشف واحد لشهر 2026-06).

## [2026-06-08] FE-11 — قواعد الرواتب (عملات/قواعد راتب/عقوبات/مكافآت)
- ما أُنجز: شاشة إدارة بأربعة تبويبات في `hr_dom_front` (`src/features/payroll-config/PayrollConfigView.vue`) فوق BE-30/BE-31: **العملات** (CRUD)، **قواعد الراتب** لكل موظف (أساسي/عملة/نمط الإضافي)، **شرائح العقوبات** (تأخير/غياب، نطاق دقائق، نسبة/ثابت)، و**المكافآت/البدلات/الخصومات** (لكل موظف/شهر). **بدون لمس العقد** (أنواع يدوية في `src/api/payrollConfig.ts`). أُنشئت لسدّ فجوة: BE-31 كان بلا واجهة.
- الملفات الرئيسية: `src/api/payrollConfig.ts`، `src/features/payroll-config/PayrollConfigView.vue`، `src/router/index.ts`، `src/layouts/AppLayout.vue`، `src/locales/{ar,en}.json`.
- قرارات/ملاحظات: الصلاحيات: العملات `currencies.view`/`currencies.manage`، الباقي `payroll.view`/`payroll.manage_rules`؛ المسار/التنقّل canAny. اختيار الموظف في قاعدة الراتب يحمّل قاعدته الحالية. لم يُلمَس العقد ولا الباك. الحالة `review`.
- الاختبارات: `type-check`+`build` خضراء، لا أخطاء console. تحقّق حيّ (Acme Admin): كل القراءات 200 (عملات/قواعد/عقوبات/مكافآت)؛ **إنشاء عملة IQD (201)** و**ضبط قاعدة راتب لـ Test Worker (1,000,000 IQD)** عبر الواجهة — بهذا تكتمل تهيئة بيانات FE-10. (توليد كشف الراتب نفسه مُنع بحاجز الأمان — خطوة واحدة يقوم بها المستخدم.)

## [2026-06-08] FE-10 — واجهة الرواتب
- ما أُنجز: شاشة رواتب في `hr_dom_front` (`src/features/payroll/PayrollView.vue`): فلتر الشهر/الموظف، عرض كشوف الفترة (قائمة: الموظف/الشهر/الأساسي/الخصومات/الصافي بعملة الكشف)، توليد الرواتب (`payroll.generate`)، تصدير Excel/PDF مباشر، ولوحة تفاصيل الكشف (الأساسي/الإضافي/المكافآت/الخصومات/الصافي + breakdown: أيام العمل/الأجر اليومي/التأخير/الغياب…). **بدون لمس العقد** (أنواع يدوية في `src/api/payroll.ts`).
- الملفات الرئيسية: `src/api/payroll.ts`، `src/features/payroll/PayrollView.vue`، `src/router/index.ts`، `src/layouts/AppLayout.vue`، `src/locales/{ar,en}.json`.
- قرارات/ملاحظات: أُعيد استخدام `saveBlob` من `reports.ts` للتنزيل. الصلاحيات: عرض/تصدير `payroll.view`، توليد `payroll.generate`. لم يُلمَس العقد ولا الباك. الحالة `review`.
- الاختبارات: `type-check`+`build` خضراء، لا أخطاء console. تحقّق حيّ جزئي (Acme Admin): الشاشة تُحمّل، `GET /payroll` = 200 (فارغ)، الفلاتر/الأزرار تعمل. **مسار البيانات الكامل (توليد كشف + تفاصيل) لم يُتحقَّق حيّاً** لأنه يتطلّب تهيئة عملة + قاعدة راتب لموظف — وهي تهيئة بيانات من نطاق جلسة الباك (احتُرم الحدّ، لم أُنشئها).

## [2026-06-08] FE-09 — التقارير
- ما أُنجز: شاشة تقارير في `hr_dom_front` (`src/features/reports/ReportsView.vue`): اختيار نوع التقرير (الحضور/التأخير والغياب/كشف الدوام) + فلاتر (من/إلى/الشهر/القسم/الموظف) + جدول ديناميكي يُبنى من `meta.report.headings` و`data` القادمين من الباك + تصدير مباشر Excel/PDF (تنزيل Blob). **بدون لمس العقد** (أنواع TypeScript يدوية في `src/api/reports.ts`) لتفادي التضارب مع جلسة الباك.
- الملفات الرئيسية: `src/api/reports.ts`، `src/features/reports/ReportsView.vue`، `src/router/index.ts`، `src/layouts/AppLayout.vue`، `src/locales/{ar,en}.json`.
- قرارات/ملاحظات: الأعمدة ديناميكية (عناوين معروفة تُترجَم، وأي عمود آخر يُعرض بمفتاحه). كشف الدوام يتطلّب اختيار موظف. التصدير عبر `responseType: 'blob'` + `saveBlob`. الصلاحية `reports.view`. لم يُلمَس العقد ولا الباك. الحالة `review`.
- الاختبارات: `type-check`+`build` خضراء، لا أخطاء console. تحقّق حيّ (Acme Admin): تقرير الحضور 200 (جدول مترجَم، صفّان)، التأخير والغياب 200 (أعمدة مختلفة، ٤ صفوف)، وتصدير Excel `?export=excel` 200.

## [2026-06-08] FE-08 — إدارة الإجازات والموافقات
- ما أُنجز: وحدة بثلاثة تبويبات في `hr_dom_front` (`src/features/leaves/LeavesView.vue`): **الطلبات** (قائمة بفلتر حالة + موافقة/رفض للمعلّقة + تقديم بالنيابة)، **أنواع الإجازات** (CRUD: الصنف/يتطلّب موافقة/يؤثّر على الرصيد/مدفوعة)، و**الأرصدة** (اختيار موظف → عرض أرصدته + ضبط set/increment). وتحت Contract-First: **استُكمل عقد BE-20** (مسارات `{id}` + فلاتر + أجسام الطلبات + مخطّطات Input) ثم أُعيد توليد الأنواع.
- الملفات الرئيسية: `src/api/leaves.ts`، `src/features/leaves/LeavesView.vue`، `src/router/index.ts`، `src/layouts/AppLayout.vue`، `src/locales/{ar,en}.json`، و`src/api/schema.ts` (مُعاد توليده).
- قرارات/ملاحظات: الصلاحيات: عرض `leaves.view`، اعتماد/رفض `leaves.approve`، أنواع/أرصدة `leaves.manage_balances`. يُقصّ التاريخ ISO إلى `YYYY-MM-DD`. أخطاء الباك (مثل «الرصيد غير كافٍ») تُعرض في تنبيه عبر `ApiException`. الحالة `review`.
- الاختبارات: `type-check` و`build` خضراء، لا أخطاء console. سلسلة حيّة كاملة مقابل الباك (Acme Admin): إنشاء نوع «إجازة سنوية» (201) → طلب بالنيابة لـ Test Worker (201، معلّقة) → موافقة مرفوضة بـ«الرصيد غير كافٍ» (عُرض الخطأ) → ضبط رصيد اعتيادي 10 (200) → موافقة ناجحة (الحالة «معتمدة»).

## [2026-06-08] FE-07 — موافقات إعادة ربط الأجهزة
- ما أُنجز: شاشة لوحة التحكم لطلبات إعادة ربط الأجهزة المعلّقة (`src/features/devices/DeviceRebindView.vue`): قائمة الطلبات (الموظف + الرقم الوظيفي + معرّف الجهاز الجديد + تاريخ الطلب) مع زرّي **موافقة/رفض** وتحديث، كلها بـ `v-can="'devices.rebind_approve'"`. وتحت Contract-First **وُثِّق عقد BE-11 أولاً** (كان غائباً) ثم أُعيد توليد الأنواع.
- الملفات الرئيسية: `src/api/devices.ts`، `src/features/devices/DeviceRebindView.vue`، `src/router/index.ts`، `src/layouts/AppLayout.vue`، `src/locales/{ar,en}.json`، و`src/api/schema.ts` (مُعاد توليده).
- قرارات/ملاحظات: العقد لـ BE-11 وُثّق في `hr_dom_docs` (وسم `Devices` + `BindDeviceInput`/`RebindRequestInput`). يُقصّ `created_at` إلى `YYYY-MM-DD`. الإجراءات تعطّل الصف أثناء التنفيذ. الحالة `review`.
- الاختبارات: `type-check` و`build` خضراء، لا أخطاء console. تحقّق حيّ مقابل الباك (Acme Admin): GET rebind-requests = 200 (حالة فارغة)، أُنشئ طلب تجريبي POST rebind-request = 201، ظهر في القائمة (Acme Admin/A001)، ثم موافقة POST approve = 200 وخرج من القائمة.

## [2026-06-08] FE-06 — الورديات والجدولة والعطل
- ما أُنجز: وحدة بثلاثة تبويبات في `hr_dom_front`: **الورديات** (`/shifts` — اسم، بدء/انتهاء، ساعات، دقائق سماح، وسم «تمتد بعد منتصف الليل»)، **جداول الموظفين** (`/schedules` — إسناد موظف لوردية بنمط أسبوعي أو تاريخ محدّد، مع عرض «كل <يوم>»)، و**العطل الرسمية** (`/holidays` — تاريخ + اسم). CRUD كامل لكلٍّ بـ `v-can`.
- الملفات الرئيسية: `src/api/schedule.ts`، `src/features/schedule/ScheduleView.vue`، `src/router/index.ts`، `src/layouts/AppLayout.vue`، `src/locales/{ar,en}.json`، و`src/api/schema.ts` (مُعاد توليده).
- قرارات/ملاحظات: تحت Contract-First **وُثِّق العقد لـ BE-12 أولاً** (كان نائب TODO) في `hr_dom_docs` ثم أُعيد توليد الأنواع. الصلاحيات: الورديات/العطل بـ `shifts.manage`، الجداول بـ `schedules.manage` (لا `.view` في الباك)؛ المسار محميّ بـ canAny للاثنتين، وعنصر التنقّل يدعم قائمة صلاحيات. `weekday` باصطلاح Carbon (0=الأحد…6=السبت). يُقصّ التاريخ القادم من الباك (ISO كامل) إلى `YYYY-MM-DD` للعرض ولحقول `type=date`. الوقت يُقصّ إلى `HH:MM`. الحالة `review`.
- الاختبارات: `type-check` و`build` يمرّان (chunk كسول 15.9KB)، لا أخطاء console. تحقّق حيّ مقابل الباك (Acme Admin): إنشاء وردية (201)، إسناد جدول أسبوعي «كل الأحد» (201)، إضافة عطلة (201)، وحذف عطلة (200) — كلها عبر الشبكة الحيّة.

## [2026-06-07] FE-05 — محرّر المواقع على الخريطة
- ما أُنجز: وحدة مواقع العمل — قائمة/إنشاء/تعديل/حذف، ومحرّر خريطة (Leaflet + OpenStreetMap) لرسم نطاق geofence بالنقر (مضلّع) مع تراجع/مسح وتحميل المضلّع القائم. تُبنى الهندسة كـ GeoJSON Polygon (حلقة مغلقة، [lng,lat]) مع حساب المركز تلقائياً. الإجراءات بـ `v-can` (`work_sites.view`/`manage`).
- الملفات الرئيسية: `src/api/worksites.ts`، `src/components/GeofenceMap.vue`، `src/features/worksites/WorkSitesView.vue`، `src/router/index.ts`، `src/layouts/AppLayout.vue`، `src/locales/{ar,en}.json` (+ حزمة `leaflet`).
- قرارات/ملاحظات: Leaflet+OSM (مجاني بلا مفتاح، يناسب RTL). رسم المضلّع بالنقر دون leaflet-draw. الخريطة في chunk كسول يُحمَّل عند `/work-sites`. `circleMarker` للرؤوس لتفادي مشكلة أيقونات Leaflet مع الباندلر.
- الاختبارات: `type-check` و`build` يمرّان، لا أخطاء console؛ تحقّق حيّ مقابل الباك (حفظ موقع وإرجاعه GeoJSON صالحاً).

## [2026-06-07] FE-04 — المستخدمون والأدوار والصلاحيات
- ما أُنجز: وحدة المستخدمين — قائمة/بحث/ترقيم، إنشاء/تعديل/حذف مستخدم (قسم، حالة، أدوار)، إدارة الأدوار مع منتقي صلاحيات مجمّع حسب المجال، وإسناد صلاحيات مباشرة لمستخدم. الإجراءات بـ `v-can` (`users.manage`/`roles.manage`/`permissions.assign`).
- الملفات الرئيسية: `src/api/{users,roles}.ts`، `src/components/PermissionPicker.vue`، `src/features/{users/UsersView,roles/RolesView}.vue`، `src/router/index.ts`، `src/layouts/AppLayout.vue`، `src/locales/{ar,en}.json`.
- قرارات/ملاحظات: محرّر الصلاحيات المباشرة بدلالة استبدال (مع تحذير) لأن `GET /users/{id}` لا يُرجِع الصلاحيات الحالية — تحسين باك مقترح لاحقاً.
- الاختبارات: `type-check` و`build` يمرّان؛ تحقّق حيّ مقابل الباك (Company Admin).

## [2026-06-07] FE-03 — الشركات والإعدادات
- ما أُنجز: وحدة الشركات — قائمة/إنشاء/تعديل/حذف، وصفحة إعدادات الشركة (ساعات اليوم، دقائق السماح، أيام نهاية الأسبوع، الإجازة الزمنية، قنوات الإشعار)، واستيراد الإعدادات من شركة قالب. الإجراءات بـ `v-can="'companies.manage'"`، والمسارات بـ `companies.view`.
- الملفات الرئيسية: `src/api/companies.ts`، `src/features/companies/{CompaniesListView,CompanySettingsView}.vue`، `src/router/index.ts`، `src/layouts/AppLayout.vue`، `src/locales/{ar,en}.json`.
- قرارات/ملاحظات: لا يوجد `GET /currencies` بعد فـ`base_currency_id` حقل رقمي اختياري.
- الاختبارات: `type-check` و`build` يمرّان؛ تحقّق حيّ مقابل الباك (إنشاء شركة + حفظ إعدادات + استيراد قالب).

## [2026-06-07] FE-02 — الحماية بالصلاحيات
- ما أُنجز: طبقة تخويل — `can()/canAny()/hasRole()` و`isSuperAdmin` في متجر الجلسة، توجيه `v-can`، حارس مسارات على `meta.permission` يحوّل لصفحة 403، صفحة 403 ودّية، وفلترة روابط الشريط الجانبي بالصلاحية. أُضيف مسار `/users` محميّ بـ `users.view` كأول مستهلك.
- الملفات الرئيسية: `src/stores/auth.ts`، `src/directives/can.ts`، `src/router/index.ts`، `src/layouts/AppLayout.vue`، `src/features/{errors/ForbiddenView,users/UsersView,home/HomeView}.vue`، `src/api/auth.ts`، `src/locales/{ar,en}.json`.
- قرارات/ملاحظات: Super Admin يتجاوز كل الفحوص عبر `is_super_admin` من الـ API. فلترة قوائم التنقّل عبر `can()`، و`v-can` للعناصر المفردة. (مكّنه تغيير باك: `is_super_admin` في `/auth/me`.)
- الاختبارات: `type-check` و`build` يمرّان؛ تحقّق متصفّح حيّ مقابل الباك.

## [2026-06-07] FE-01 — الدخول والتخطيط والثيم (+SSO)
- ما أُنجز: دخول كامل — شاشة دخول (مُعرّف/كلمة مرور) مع خطوة 2FA، واستبدال كود SSO داخل حارس الموجّه مع مسح الكود من الرابط، وتجديد توكن صامت (single-flight) عند 401، ومتجر جلسة كامل، وتخطيط رئيسي (Sidebar/Topbar) مع تبديل لغة/مظهر ودعم RTL، وحُرّاس مصادقة.
- الملفات الرئيسية: `src/api/auth.ts`، `src/api/client.ts`، `src/stores/auth.ts`، `src/features/auth/LoginView.vue`، `src/layouts/AppLayout.vue`، `src/router/index.ts`، `src/main.ts`، `src/locales/{ar,en}.json`.
- قرارات/ملاحظات: استبدال SSO داخل `beforeEach` لا عبر `replaceState`. تهريب `@` في رسائل i18n عبر `{'@'}`.
- الاختبارات: `npm run type-check` و`npm run build` يمرّان؛ تحقّق متصفّح (إعادة توجيه الحارس، تبديل اللغة/المظهر/RTL، مسح كود SSO).

## [2026-06-07] FE-00 — تهيئة Vue 3
- ما أُنجز: مشروع Vue 3 + Vite + TypeScript مع Tailwind v4 / Pinia / vue-i18n (RTL + ثيم). إعداد `apiClient` (axios + الغلاف `{data,meta,errors}`)، وتوليد الأنواع من العقد (`npm run generate:api` → `src/api/schema.ts`).
- الملفات الرئيسية: هيكل المشروع، `src/api/client.ts`، `src/locales/`، `src/stores/ui.ts`، `vite.config.ts`، `src/style.css`.
- قرارات/ملاحظات: Contract-First — العميل يُولَّد من العقد (لا نداءات API يدوية). العربية افتراضية + RTL، النمط الغامق عبر `.dark` على `<html>`.
- الاختبارات: تشغيل المشروع فارغاً + تدقيق العقد.
