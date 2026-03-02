import fs from "node:fs/promises";
import path from "node:path";

const KEY_RE = /(photo|image|logo|cover|banner|avatar|profile|pic|media|gallery|portfolio|file|upload)/i;
const VALUE_HINT_RE = /(forms\/[^\s"']+|uploads\/[^\s"']+|images\/[^\s"']+)/i;

function valueString(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function classify(value) {
  const text = valueString(value).trim();
  if (!text) return { empty: true, shape: "empty", hint: null };
  if (/^https?:\/\//i.test(text)) return { empty: false, shape: "absolute", hint: text.match(VALUE_HINT_RE)?.[1] ?? null };
  if (text.startsWith("//")) return { empty: false, shape: "protocol-relative", hint: text.match(VALUE_HINT_RE)?.[1] ?? null };
  if (text.startsWith("/")) return { empty: false, shape: "relative-root", hint: text.match(VALUE_HINT_RE)?.[1] ?? null };
  return { empty: false, shape: "relative", hint: text.match(VALUE_HINT_RE)?.[1] ?? null };
}

function walk(node, currentPath, out) {
  if (Array.isArray(node)) {
    node.forEach((item, index) => walk(item, `${currentPath}[${index}]`, out));
    return;
  }
  if (!node || typeof node !== "object") return;
  for (const [key, value] of Object.entries(node)) {
    const nextPath = currentPath ? `${currentPath}.${key}` : key;
    if (KEY_RE.test(key)) {
      const meta = classify(value);
      out.push({ path: nextPath, value: valueString(value), ...meta });
    }
    walk(value, nextPath, out);
  }
}

async function main() {
  const outDir = path.join(process.cwd(), "artifacts", "bd");
  const ids = ["321", "3", "8"];
  const lines = ["# IMAGE_FIELD_REPORT", ""];

  for (const id of ids) {
    const file = path.join(outDir, `user_get_${id}.json`);
    const raw = await fs.readFile(file, "utf8");
    const json = JSON.parse(raw);
    const matches = [];
    walk(json, "", matches);

    lines.push(`## user_get_${id}.json`);
    if (matches.length === 0) {
      lines.push("- candidate field paths and values: none");
      lines.push("");
      continue;
    }

    lines.push("- candidate field paths and values:");
    for (const row of matches) {
      const preview = row.value.length > 220 ? `${row.value.slice(0, 220)}...` : row.value;
      lines.push(`  - ${row.path}: \`${preview || ""}\``);
      lines.push(`    empty: ${row.empty ? "yes" : "no"}; shape: ${row.shape}; pattern: ${row.hint ?? "none"}`);
    }
    lines.push("");
  }

  await fs.writeFile(path.join(outDir, "IMAGE_FIELD_REPORT.md"), lines.join("\n"), "utf8");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
