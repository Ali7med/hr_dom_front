// طبّق المظهر واللغة قبل الرسم لتفادي الوميض (FOUC). ملف خارجي ('self') ليتوافق مع CSP.
;(function () {
  try {
    var theme = localStorage.getItem('hr_dom_theme')
    if (!theme) {
      theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    if (theme === 'dark') document.documentElement.classList.add('dark')

    var locale = localStorage.getItem('hr_dom_locale') === 'en' ? 'en' : 'ar'
    document.documentElement.lang = locale
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr'
  } catch (e) {
    /* localStorage غير متاح — تجاهل */
  }
})()
