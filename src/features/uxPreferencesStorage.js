const TEMPLATES_KEY = 'overhead.formTemplates.v1'

export function readFormTemplates() {
  try { return JSON.parse(window.localStorage.getItem(TEMPLATES_KEY) || '[]').filter((item) => item && item.id && item.name && item.kind) } catch { return [] }
}
