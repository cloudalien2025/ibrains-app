import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import type { PromptPackInput } from "./types";
import type { SscStore } from "./store";
import type { StorageAdapter } from "./storage";

const INCOMING_DIR = path.join(process.cwd(), "ssc_artifacts", "incoming");
const WRAPPER_PATH = path.join(
  process.cwd(),
  "ssc_artifacts",
  "incoming",
  "SSC_v1_Global_Enforcement_Wrapper_CodexReady.txt"
);

export type LoadedPromptPack = {
  pack: PromptPackInput;
  canonicalHash: string;
  wrapper: string;
};

export function normalizePromptText(text: string): string {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized
    .split("\n")
    .map((line) => line.replace(/[\t ]+$/g, ""));
  while (lines.length && lines[0].trim() === "") {
    lines.shift();
  }
  while (lines.length && lines[lines.length - 1].trim() === "") {
    lines.pop();
  }
  return lines.join("\n");
}

export function computePackHash(pack: PromptPackInput): string {
  const dimensions = [...pack.dimensions].sort((a, b) =>
    a.dimension.localeCompare(b.dimension)
  );
  const bundle = dimensions
    .map((dimension) => {
      const system = normalizePromptText(dimension.system);
      const user = normalizePromptText(dimension.user);
      return `${system}${user}`;
    })
    .join("");
  return crypto.createHash("sha256").update(bundle, "utf-8").digest("hex");
}

export async function loadPromptPackFromFile(
  filename: string
): Promise<PromptPackInput> {
  const filePath = path.join(INCOMING_DIR, filename);
  const payload = await fs.readFile(filePath, "utf-8");
  return JSON.parse(payload) as PromptPackInput;
}

export async function loadWrapper(): Promise<string> {
  return fs.readFile(WRAPPER_PATH, "utf-8");
}

type PackSource = "local" | "storage";

const PACK_FILES = [
  "DB_PROMPTS.json",
  "EB_PROMPTS_EcomViper.json",
  "VISUAL_PROMPTS.json",
];

const STORAGE_MANIFEST = [
  {
    pack: "DB_PROMPTS",
    versionEnv: "SSC_DB_PACK_VERSION",
    shaEnv: "SSC_DB_PACK_SHA256",
  },
  {
    pack: "EB_PROMPTS_EcomViper",
    versionEnv: "SSC_EB_PACK_VERSION",
    shaEnv: "SSC_EB_PACK_SHA256",
  },
  {
    pack: "VISUAL_PROMPTS",
    versionEnv: "SSC_VISUAL_PACK_VERSION",
    shaEnv: "SSC_VISUAL_PACK_SHA256",
  },
];

async function loadPromptPacksFromDisk(): Promise<PromptPackInput[]> {
  return Promise.all(PACK_FILES.map((filename) => loadPromptPackFromFile(filename)));
}

async function loadPromptPacksFromStorage(
  storage: StorageAdapter
): Promise<PromptPackInput[]> {
  const packs: PromptPackInput[] = [];
  for (const item of STORAGE_MANIFEST) {
    const version = process.env[item.versionEnv];
    const sha = process.env[item.shaEnv];
    if (!version || !sha) {
      throw new Error(
        `Missing ${item.versionEnv} or ${item.shaEnv} for storage pack load`
      );
    }
    const key = `ssc/prompt_packs/${item.pack}/${version}/${sha}/${item.pack}.json`;
    const payload = await storage.getText(key);
    packs.push(JSON.parse(payload) as PromptPackInput);
  }
  return packs;
}

export async function loadPromptPacks(
  storage: StorageAdapter
): Promise<LoadedPromptPack[]> {
  const wrapper = await loadWrapper();
  const source = (process.env.SSC_PACK_SOURCE ?? "local") as PackSource;
  const packs =
    source === "storage"
      ? await loadPromptPacksFromStorage(storage)
      : await loadPromptPacksFromDisk();

  return packs.map((pack) => ({
    pack,
    canonicalHash: computePackHash(pack),
    wrapper,
  }));
}

export async function persistPromptPacks(
  store: SscStore,
  storage: StorageAdapter
): Promise<void> {
  const packs = await loadPromptPacks(storage);

  for (const { pack, canonicalHash, wrapper } of packs) {
    if (canonicalHash !== pack.ssc_prompt_pack_sha256) {
      throw new Error(
        `SSC_PROMPT_PACK_HASH_MISMATCH ${pack.pack}: expected ${pack.ssc_prompt_pack_sha256} computed ${canonicalHash}`
      );
    }

    const packId = await store.upsertPromptPack({
      pack_name: pack.pack,
      version: pack.ssc_prompt_pack_version,
      build_date: pack.ssc_prompt_pack_build_date,
      sha256: pack.ssc_prompt_pack_sha256,
      canonicalization_rules: pack.canonicalization_rules ?? [],
    });

    for (const dimension of pack.dimensions) {
      const systemPrompt = `${wrapper}\n\n${dimension.system}`.trim();
      await store.upsertPrompt({
        pack_id: packId,
        dimension: dimension.dimension,
        system_prompt: systemPrompt,
        user_prompt: dimension.user,
        flags_vocabulary: dimension.flags_vocabulary ?? [],
      });
    }

    await store.setActivePack(pack.pack, packId);

    const storageKey = `ssc/prompt_packs/${pack.pack}/${pack.ssc_prompt_pack_version}/${pack.ssc_prompt_pack_sha256}/${pack.pack}.json`;
    await storage.putText(storageKey, JSON.stringify(pack, null, 2));
  }
}
