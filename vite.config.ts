import { defineConfig, loadEnv, type Plugin } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

// يحقن Content-Security-Policy في بناء الإنتاج فقط (لا يكسر HMR في التطوير).
// السكربت الوحيد المضمّن نُقل إلى /theme-init.js فصار script-src 'self' كافياً.
// ملاحظة: frame-ancestors / X-Content-Type-Options تُضبط كترويسات خادم (انظر DEPLOYMENT.md).
function cspPlugin(apiOrigin: string): Plugin {
  const csp = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'", // Vue/Tailwind/Leaflet يحقنون أنماطاً مضمّنة
    "img-src 'self' data: https://*.tile.openstreetmap.org",
    `connect-src 'self'${apiOrigin ? ' ' + apiOrigin : ''}`,
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ')
  return {
    name: 'html-csp',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '</title>',
        `</title>\n    <meta http-equiv="Content-Security-Policy" content="${csp}" />`,
      )
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  let apiOrigin = ''
  try {
    apiOrigin = new URL(env.VITE_API_BASE_URL ?? 'http://localhost:8000').origin
  } catch {
    /* عنوان غير صالح — نكتفي بـ 'self' */
  }
  return {
    plugins: [vue(), tailwindcss(), cspPlugin(apiOrigin)],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      port: 5173,
      // وكيل تطوير: يجعل الـ API نفس-أصل (same-origin) ليعمل كوكي XSRF (double-submit CSRF)
      // — لأن المتصفّح لا يتيح قراءة كوكي عبر-الأصل. الإنتاج يخدم الفرونت خلف نفس الأصل/الموقع.
      proxy: {
        '/api': {
          target: env.VITE_DEV_API_TARGET ?? 'http://127.0.0.1:8000',
          changeOrigin: true,
        },
      },
    },
  }
})
