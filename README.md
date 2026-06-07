# hr_dom_front — لوحة التحكم

لوحة إدارة نظام **hr_dom** (حضور وانصراف متعدد الشركات). مبنية بـ **Vue 3 + Vite + TypeScript**.

> جزء من ثلاثية المشروع: `hr_dom_api` (الخادم) · **`hr_dom_front` (هذا)** · `hr_dom` (التطبيق).
> الوثائق والعقد في مستودع `hr_dom_docs` المجاور.

## المتطلبات

- Node.js 20+ (مُختبر على 24)
- خادم الـ API يعمل (أو الخادم الوهمي Prism — انظر أدناه)

## التشغيل

```bash
npm install
cp .env.example .env   # اضبط VITE_API_BASE_URL
npm run dev            # http://localhost:5173
```

## الأوامر

| الأمر | الوظيفة |
|-------|---------|
| `npm run dev` | خادم التطوير (Vite) |
| `npm run build` | فحص الأنواع + بناء الإنتاج |
| `npm run preview` | معاينة بناء الإنتاج |
| `npm run type-check` | فحص أنواع TypeScript فقط |
| `npm run generate:api` | توليد أنواع الـ API من العقد |

## البنية

```
src/
├── api/          # apiClient (axios) + الأنواع المولّدة من العقد
│   ├── client.ts       # المثيل + interceptors + الغلاف الموحّد + ApiException
│   ├── schema.ts       # مولّد من contract/openapi.yaml — لا يُحرّر يدوياً
│   └── tokenStorage.ts # تخزين التوكنات
├── stores/       # Pinia (auth, ui)
├── router/       # Vue Router
├── locales/      # vue-i18n (ar/en) + RTL
├── features/     # وحدات الشاشات (home, …)
└── components/   # مكوّنات مشتركة
```

## العقد والأنواع (Contract-First)

المصدر الوحيد للحقيقة هو `hr_dom_docs/contract/openapi.yaml`. **لا تُكتب نداءات API يدوياً** — تُولَّد الأنواع منه:

```bash
npm run generate:api
```

أعِد التوليد عند **كل** تغيير على العقد.

## البيئة

| المتغيّر | الافتراضي | الوصف |
|----------|-----------|-------|
| `VITE_API_BASE_URL` | `http://localhost:8000/api/v1` | عنوان الـ API |

للعمل قبل جاهزية الباك: شغّل الخادم الوهمي من `hr_dom_docs`:
```bash
npx @stoplight/prism-cli mock contract/openapi.yaml   # http://127.0.0.1:4010
```
ثم اضبط `VITE_API_BASE_URL=http://127.0.0.1:4010`.
