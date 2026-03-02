import fs from "node:fs/promises";
import path from "node:path";
import { bdRequestRaw, loadBdRuntimeConfig } from "./_bdRuntime.mjs";

async function main() {
  const ids = process.argv.slice(2);
  const userIds = ids.length > 0 ? ids : ["321", "3", "8"];
  const outDir = path.join(process.cwd(), "artifacts", "bd");
  await fs.mkdir(outDir, { recursive: true });

  const runtime = await loadBdRuntimeConfig();
  await fs.writeFile(
    path.join(outDir, "RUNTIME_CONFIG_REPORT.md"),
    [
      "# BD Runtime Config (DirectoryIQ)",
      "",
      `- BD_BASE_URL resolved from DB integration meta (baseUrl/base_url): ${runtime.baseUrl}`,
      `- BD_API_KEY source: integrations_credentials.secret_ciphertext (provider=brilliant_directories), decrypted at runtime`,
      `- Credential row user_id: ${runtime.userId}`,
      `- Credential updated_at: ${runtime.updatedAt ?? "unknown"}`,
      "",
      "## Code Loading Paths",
      "- app/api/directoryiq/listings/[listingId]/route.ts",
      "- app/api/directoryiq/_utils/credentials.ts#getDirectoryIqIntegrationSecret",
      "- app/api/directoryiq/_utils/integrations.ts#getDirectoryIqBdConnection",
      "",
      "## Request Method",
      "- GET /api/v2/user/get/{user_id}",
      "- Header: X-Api-Key",
    ].join("\n"),
    "utf8"
  );

  for (const userId of userIds) {
    const response = await bdRequestRaw({
      baseUrl: runtime.baseUrl,
      apiKey: runtime.apiKey,
      method: "GET",
      requestPath: `/api/v2/user/get/${encodeURIComponent(userId)}`,
    });

    if (!response.text || !response.json) {
      throw new Error(`user/get ${userId} did not return JSON payload (status=${response.status})`);
    }

    await fs.writeFile(path.join(outDir, `user_get_${userId}.json`), response.text, "utf8");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
