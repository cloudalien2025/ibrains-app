import fs from "node:fs/promises";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface DoctorCheck {
  key: string;
  ok: boolean;
  detail: string;
}

export interface DoctorReport {
  generatedAt: string;
  checks: DoctorCheck[];
}

async function commandVersion(command: string, args: string[] = ["--version"]): Promise<string | null> {
  try {
    const { stdout, stderr } = await execFileAsync(command, args);
    return (stdout || stderr || "").trim().split("\n")[0] || "available";
  } catch {
    return null;
  }
}

async function commandExists(command: string): Promise<boolean> {
  try {
    await execFileAsync("bash", ["-lc", `command -v ${command}`]);
    return true;
  } catch {
    return false;
  }
}

async function pythonImportAvailable(moduleName: string): Promise<boolean> {
  try {
    await execFileAsync("python3", ["-c", `import ${moduleName}`]);
    return true;
  } catch {
    return false;
  }
}

async function packageAvailable(packageName: string): Promise<boolean> {
  try {
    await execFileAsync("node", ["-e", `require.resolve(${JSON.stringify(packageName)})`]);
    return true;
  } catch {
    return false;
  }
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

function maskSecretPresent(value: string | undefined): string {
  if (!value || !value.trim()) return "missing";
  return `set(len=${value.trim().length})`;
}

export async function runSupplierToolbeltDoctor(): Promise<DoctorReport> {
  const checks: DoctorCheck[] = [];

  const nodeVersion = process.version;
  checks.push({ key: "node_version", ok: true, detail: nodeVersion });

  const npmVersion = await commandVersion("npm", ["--version"]);
  checks.push({ key: "npm_version", ok: Boolean(npmVersion), detail: npmVersion || "unavailable" });

  checks.push({ key: "npx_available", ok: await commandExists("npx"), detail: "checked via command -v" });
  checks.push({ key: "python3_available", ok: await commandExists("python3"), detail: "checked via command -v" });
  checks.push({ key: "pip3_available", ok: await commandExists("pip3"), detail: "checked via command -v" });

  checks.push({ key: "playwright_package", ok: await packageAvailable("playwright"), detail: "require.resolve(playwright)" });
  checks.push({ key: "playwright_test_package", ok: await packageAvailable("@playwright/test"), detail: "require.resolve(@playwright/test)" });

  const browserCachePath = path.join(process.env.HOME || "/root", ".cache/ms-playwright");
  checks.push({
    key: "playwright_browser_cache",
    ok: await pathExists(browserCachePath),
    detail: browserCachePath,
  });

  checks.push({ key: "google_chrome", ok: await commandExists("google-chrome"), detail: "checked via command -v" });
  checks.push({ key: "python_fitz", ok: await pythonImportAvailable("fitz"), detail: "python3 -c import fitz" });
  checks.push({ key: "python_pandas", ok: await pythonImportAvailable("pandas"), detail: "python3 -c import pandas" });
  checks.push({ key: "python_openpyxl", ok: await pythonImportAvailable("openpyxl"), detail: "python3 -c import openpyxl" });

  checks.push({
    key: "firecrawl_env",
    ok: Boolean(process.env.FIRECRAWL_API_KEY),
    detail: maskSecretPresent(process.env.FIRECRAWL_API_KEY),
  });

  const cacheDir = process.env.ECOMVIPER_SUPPLIER_FIRECRAWL_CACHE_DIR || path.join(process.cwd(), ".cache/firecrawl");
  checks.push({ key: "firecrawl_cache_dir", ok: await pathExists(cacheDir), detail: cacheDir });

  return {
    generatedAt: new Date().toISOString(),
    checks,
  };
}
