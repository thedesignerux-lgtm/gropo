export function normalizePhone(raw: string): string {
  return (raw || '')
    .replace(/[\s.\-]/g, '')  // quita espacios, puntos, guiones
    .replace(/^\+34/, '')     // quita +34 del principio
}
