// Centralized registry for domain REQUEST_TEMPLATES.
// Domain step files call registerTemplates() at module load time.
// Common steps resolve templates via getTemplate().

const templates: Record<string, string> = {};

/**
 * Register one or more request templates (called from domain step files).
 * Duplicate keys are overwritten — ensure names are unique across domains.
 */
export function registerTemplates(domainTemplates: Record<string, string>): void {
  Object.assign(templates, domainTemplates);
}

/**
 * Resolve a template by name. Throws if the name is unknown.
 */
export function getTemplate(name: string): string {
  const template = templates[name];
  if (!template) {
    throw new Error(`Unknown request name "${name}". Known templates: ${Object.keys(templates).join(', ')}`);
  }
  return template;
}

/**
 * Replace all `{placeholder}` tokens in a template string.
 * Looks up `<placeholder>Override` in the store first, then falls back to `defaults`.
 */
export function resolveEndpoint(
  template: string,
  retrieve: <T = unknown>(key: string) => T,
  defaults: Record<string, string | number> = {},
): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const override = retrieve<string | number | undefined>(`${key}Override`);
    const value = override ?? defaults[key];
    if (value === undefined) {
      throw new Error(`No value for template placeholder "${match}". Set it with: And I set "${key}" to "<value>"`);
    }
    return String(value);
  });
}
