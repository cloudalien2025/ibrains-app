import { runSupplierToolbeltDoctor } from "@/lib/ecomviper/suppliers/supplier-toolbelt-doctor";

async function main(): Promise<void> {
  const report = await runSupplierToolbeltDoctor();
  process.stdout.write("rocktomic_supplier_toolbelt_doctor\n");
  for (const check of report.checks) {
    process.stdout.write(`${check.ok ? "ok" : "warn"}: ${check.key} ${check.detail}\n`);
  }
  process.stdout.write(`summary: ${JSON.stringify(report)}\n`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error || "unknown_error");
  process.stderr.write(`[supplier-toolbelt-doctor] ${message}\n`);
  process.exitCode = 1;
});
