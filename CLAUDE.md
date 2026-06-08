# CLAUDE.md — hr_dom_front (لوحة التحكم)

لوحة إدارة نظام حضور وانصراف متعدد الشركات. هذا المشروع هو **الفرونت فقط** (Vue 3 + Vite + TypeScript). مصدر الحقيقة للعقد ولوحة التتبّع في مستودع `hr_dom_docs` (المجاور).

## مبادئ ملزمة
- **Contract-First:** لا تُكتب نداءات API يدوياً. الأنواع تُولَّد من `hr_dom_docs/contract/openapi.yaml` عبر `npm run generate:api`، ويُعاد التوليد عند كل تغيير على العقد. الملف `src/api/schema.ts` مولّد — لا يُحرّر يدوياً.
- **الصيغة الموحّدة:** كل ردود الـ API بالشكل `{ data, meta, errors }`. استخدم `apiClient`/`unwrap` من `src/api/client.ts`؛ الأخطاء تُرفع كـ `ApiException` (تحمل `code/message/field` ورمز الحالة).
- **i18n أولاً:** كل نص معروض عبر `vue-i18n` (عربي/إنجليزي) — لا نصوص ثابتة في القوالب. العربية هي الافتراضية، والاتجاه RTL.
- **التسمية:** الكود بالإنجليزية (`camelCase`/`PascalCase`)؛ حقول/مسارات الـ API بـ `snake_case` كما في العقد.
- **الأمان:** لا أسرار في الكود؛ القيم في `.env` (المتغيّرات بـ `VITE_`). التوكنات في `localStorage` عبر `tokenStorage`.

## البنية
- `src/api/` — `client.ts` (axios + interceptors + الغلاف)، `tokenStorage.ts`، `schema.ts` (مولّد).
- `src/stores/` — Pinia: `auth` (الجلسة/التوكنات)، `ui` (الثيم + اللغة + RTL، محفوظان).
- `src/router/` — Vue Router (lazy-loaded views).
- `src/locales/` — `index.ts` (إعداد i18n، `legacy:false`) + `ar.json`/`en.json`.
- `src/features/<feature>/` — شاشات كل وحدة. `src/components/` — مكوّنات مشتركة.
- اسم مستعار: `@` → `src`.

## التنسيق (Tailwind v4)
- `@import 'tailwindcss'` في `src/style.css`.
- النمط الغامق عبر صنف `.dark` على `<html>` (`@custom-variant dark`)، يُضبط من متجر `ui` ومن سكربت مبكر في `index.html` لتفادي الوميض.

## البيئة
- `VITE_API_BASE_URL` — عنوان الـ API (افتراضي `http://localhost:8000/api/v1`). انظر `hr_dom_docs/ENVIRONMENTS.md`.
- قبل جاهزية الباك: خادم Prism الوهمي على `http://127.0.0.1:4010`.

## أوامر
- تطوير: `npm run dev` (المنفذ 5173)
- بناء + فحص أنواع: `npm run build` · فحص أنواع فقط: `npm run type-check`
- توليد أنواع الـ API: `npm run generate:api`

## Git
- فرع لكل تاسك: `feature/<task-id>` (مثل `feature/FE-01`).
- Conventional Commits: `feat(FE-01): ...`.
- حدّث حالة التاسك في `hr_dom_docs/PROGRESS.md`.
- **لا دمج بلا أخضر:** لا يُدمج فرع قبل أن يمرّ `npm run type-check` و`npm run build`.
- لا تكسر/تحذف/تعيد هيكلة بنية قائمة (وحدات، مسارات، أنواع مولّدة)؛ ابنِ فوقها فقط.

## الذاكرة المرتبطة (اقرأها)
@CONVENTIONS.md
@WORKLOG.md
@PROGRESS.md

(`CONVENTIONS.md`/`WORKLOG.md`/`PROGRESS.md` نسخ محلية لهذا المستودع؛ لوحة التتبّع الموحّدة والعقد في `hr_dom_docs`.)

## طقس كل تاسك (Definition of Done)
1. المتطلّب مُنفّذ ويعمل وفق وصف التاسك.
2. `npm run type-check` و`npm run build` يمرّان بلا أخطاء، ولا أخطاء console.
3. لأي تغيير يمسّ العقد: أُعيد توليد الأنواع عبر `npm run generate:api`.
4. حالة التاسك مُحدّثة في `PROGRESS.md` (المحلي + `hr_dom_docs`) + مدخلة في `WORKLOG.md`.
5. مراجعة عبر Pull Request قبل الدمج.

## للتعديل على ميزة قائمة
اقرأ `WORKLOG.md` وكود الميزة (`src/features/<feature>/`) أولاً، عدّل على فرع جديد، ثم شغّل
`npm run type-check` و`npm run build` للتأكّد أن القديم لم ينكسر قبل الدمج.
