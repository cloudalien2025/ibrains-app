import fs from "fs";
import path from "path";

const root = path.resolve(process.cwd());

const replacements = [
  {
    file: "node_modules/next/dist/build/webpack/plugins/next-types-plugin/index.js",
    changes: [
      {
        from: "type RouteContext = { params: Promise<SegmentParams> }",
        to: "type RouteContext = { params: SegmentParams }",
      },
    ],
  },
  {
    file: "node_modules/next/dist/esm/build/webpack/plugins/next-types-plugin/index.js",
    changes: [
      {
        from: "type RouteContext = { params: Promise<SegmentParams> }",
        to: "type RouteContext = { params: SegmentParams }",
      },
    ],
  },
  {
    file: "node_modules/next/dist/server/lib/router-utils/typegen.js",
    changes: [
      {
        from: "context: { params: Promise<ParamMap[Route]> }",
        to: "context: { params: ParamMap[Route] }",
      },
      {
        from: "params: Promise<ParamMap[AppRouteHandlerRoute]>",
        to: "params: ParamMap[AppRouteHandlerRoute]",
      },
    ],
  },
  {
    file: "node_modules/next/dist/esm/server/lib/router-utils/typegen.js",
    changes: [
      {
        from: "context: { params: Promise<ParamMap[Route]> }",
        to: "context: { params: ParamMap[Route] }",
      },
      {
        from: "params: Promise<ParamMap[AppRouteHandlerRoute]>",
        to: "params: ParamMap[AppRouteHandlerRoute]",
      },
    ],
  },
];

let touched = 0;

for (const { file, changes } of replacements) {
  const target = path.join(root, file);
  if (!fs.existsSync(target)) {
    console.warn(`[patch_next_route_types] Missing file: ${file}. Skipping.`);
    continue;
  }
  let contents = fs.readFileSync(target, "utf8");
  let updated = contents;
  for (const { from, to } of changes) {
    if (!updated.includes(from)) {
      console.warn(`[patch_next_route_types] Pattern not found in ${file}: ${from}. Skipping file.`);
      updated = contents;
      break;
    }
    updated = updated.split(from).join(to);
  }
  if (updated !== contents) {
    fs.writeFileSync(target, updated, "utf8");
    touched += 1;
  }
}

console.log(`Patched Next route types in ${touched} file(s).`);
