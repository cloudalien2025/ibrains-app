export interface WalmartAliasGroup {
  canonical: string;
  aliases: string[];
}

export const WALMART_ALIAS_GROUPS: WalmartAliasGroup[] = [
  { canonical: "product_form", aliases: ["form"] },
  { canonical: "servings_per_container", aliases: ["servings"] },
  { canonical: "directions_suggested_use", aliases: ["suggested_use"] },
  { canonical: "supplement_type", aliases: ["product_type"] },
  { canonical: "count_per_pack", aliases: ["count_per_package"] },
  { canonical: "main_ingredients", aliases: ["ingredients_list"] },
  { canonical: "product_name", aliases: ["productName"] },
  { canonical: "safety_warnings", aliases: ["warnings"] },
];

function normalizeKey(value: string): string {
  return value.trim();
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.map((entry) => normalizeKey(entry)).filter(Boolean)));
}

function allKeysInGroup(group: WalmartAliasGroup): string[] {
  return unique([group.canonical, ...group.aliases]);
}

function findGroupForKey(key: string): WalmartAliasGroup | null {
  const normalized = normalizeKey(key);
  if (!normalized) return null;
  return (
    WALMART_ALIAS_GROUPS.find((group) => allKeysInGroup(group).includes(normalized)) ?? null
  );
}

export function expandAliasKeys(keys: string[]): string[] {
  const expanded = new Set<string>();
  for (const key of keys) {
    const normalized = normalizeKey(key);
    if (!normalized) continue;
    const group = findGroupForKey(normalized);
    if (!group) {
      expanded.add(normalized);
      continue;
    }
    for (const groupKey of allKeysInGroup(group)) {
      expanded.add(groupKey);
    }
  }
  return Array.from(expanded);
}

export function clearAliasGroupValues(input: {
  attributes: Record<string, string>;
  sourceByField?: Record<string, string>;
  key: string;
}): string[] {
  const normalized = normalizeKey(input.key);
  if (!normalized) return [];
  const group = findGroupForKey(normalized);
  const keys = group ? allKeysInGroup(group) : [normalized];
  const cleared: string[] = [];

  for (const key of keys) {
    if (!(key in input.attributes)) continue;
    if (!String(input.attributes[key] ?? "").trim()) continue;
    delete input.attributes[key];
    if (input.sourceByField) {
      delete input.sourceByField[key];
    }
    cleared.push(key);
  }

  return unique(cleared);
}

export function setAliasGroupValue(input: {
  attributes: Record<string, string>;
  sourceByField?: Record<string, string>;
  key: string;
  value: string;
  source?: string;
}): string[] {
  const normalized = normalizeKey(input.key);
  const value = input.value.trim();
  if (!normalized || !value) return [];
  const group = findGroupForKey(normalized);
  const keys = group ? allKeysInGroup(group) : [normalized];
  const updated: string[] = [];

  for (const key of keys) {
    if (input.attributes[key] === value) continue;
    input.attributes[key] = value;
    if (input.sourceByField) {
      input.sourceByField[key] = input.source ?? input.sourceByField[key] ?? "alias_sync";
    }
    updated.push(key);
  }

  return unique(updated);
}

export function syncAliasGroups(input: {
  attributes: Record<string, string>;
  sourceByField?: Record<string, string>;
}): string[] {
  const updated: string[] = [];

  for (const group of WALMART_ALIAS_GROUPS) {
    const keys = allKeysInGroup(group);
    const firstValue = keys
      .map((key) => ({ key, value: String(input.attributes[key] ?? "").trim() }))
      .find((entry) => entry.value.length > 0);

    if (!firstValue) {
      for (const key of keys) {
        if (!(key in input.attributes)) continue;
        if (String(input.attributes[key] ?? "").trim()) continue;
        delete input.attributes[key];
        if (input.sourceByField) delete input.sourceByField[key];
      }
      continue;
    }

    for (const key of keys) {
      const currentValue = String(input.attributes[key] ?? "").trim();
      if (currentValue === firstValue.value) continue;
      input.attributes[key] = firstValue.value;
      if (input.sourceByField) {
        const inheritedSource =
          input.sourceByField[firstValue.key] ?? input.sourceByField[key] ?? "alias_sync";
        input.sourceByField[key] = inheritedSource;
      }
      updated.push(key);
    }
  }

  return unique(updated);
}

export function findAliasInconsistencies(attributes: Record<string, string>): string[] {
  const issues: string[] = [];

  for (const group of WALMART_ALIAS_GROUPS) {
    const keys = allKeysInGroup(group);
    const values = keys
      .map((key) => ({ key, value: String(attributes[key] ?? "").trim() }))
      .filter((entry) => entry.value.length > 0);

    if (values.length <= 1) continue;
    const normalizedSet = new Set(values.map((entry) => entry.value.toLowerCase()));
    if (normalizedSet.size <= 1) continue;
    issues.push(`${group.canonical}:${values.map((entry) => `${entry.key}=${entry.value}`).join(",")}`);
  }

  return issues;
}
