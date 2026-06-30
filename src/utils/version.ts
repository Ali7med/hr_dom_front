// مقارنة نسخ بنمط semver مبسّط (major.minor.patch، تتجاهل لاحقة ما بعد «-»/«+»).
// تُرجِع: -1 إذا a < b، 0 إذا a == b، 1 إذا a > b.
export function compareVersions(a: string, b: string): number {
  const norm = (v: string) =>
    String(v ?? '')
      .trim()
      .split(/[-+]/)[0]
      .split('.')
      .map((p) => Number.parseInt(p, 10) || 0)
  const pa = norm(a)
  const pb = norm(b)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? 0
    const y = pb[i] ?? 0
    if (x !== y) return x < y ? -1 : 1
  }
  return 0
}
