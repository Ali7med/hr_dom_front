# CONVENTIONS — معايير hr_dom_front

معايير هذا المستودع (الفرونت)، متوافقة مع المعايير الموحّدة في `hr_dom_docs/CONVENTIONS.md`.

## 1. التسمية
- الكود بالإنجليزية: `camelCase` للمتغيّرات/الدوال، `PascalCase` للمكوّنات/الأنواع.
- حقول ومسارات الـ API بـ `snake_case` كما في العقد (لا تُترجم يدوياً — الأنواع مولّدة).
- لا نصوص معروضة ثابتة في القوالب — كل نص عبر `vue-i18n` (`ar`/`en`)، والعربية افتراضية + RTL.

## 2. الـ API (Contract-First)
- لا نداءات API يدوية الأنواع: تُولَّد من `hr_dom_docs/contract/openapi.yaml` عبر `npm run generate:api` → `src/api/schema.ts` (مولّد، لا يُحرّر يدوياً).
- كل الردود بالغلاف `{ data, meta, errors }`؛ استخدم `apiClient`/`unwrap` من `src/api/client.ts`. الأخطاء تُرفع كـ `ApiException` (تحمل `code/message/field` ورمز الحالة).
- التخويل في الواجهة عبر `v-can` / `can()` (لا يُغني عن فحص الباك — هو للعرض فقط).

## 3. Git
- Conventional Commits: `type(scope): subject` — مثال: `feat(FE-06): shifts scheduling view`.
- فرع لكل تاسك: `feature/<task-id>` (مثل `feature/FE-06`).
- ربط رسالة الـ commit بمعرّف التاسك من `PROGRESS.md`.

## 4. تعريف منجز (Definition of Done)
- [ ] المتطلّب مُنفّذ ويعمل وفق وصف التاسك.
- [ ] `npm run type-check` و`npm run build` يمرّان بلا أخطاء، ولا أخطاء console.
- [ ] لأي تغيير يمسّ العقد: أُعيد توليد الأنواع (`npm run generate:api`).
- [ ] لا أسرار في الكود؛ القيم في `.env` (بادئة `VITE_`).
- [ ] حالة التاسك مُحدّثة في `PROGRESS.md` + مدخلة في `WORKLOG.md`.
- [ ] مراجعة عبر Pull Request قبل الدمج.
