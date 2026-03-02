import fs from "fs/promises";
import path from "path";

export type StorageAdapter = {
  putBytes: (key: string, payload: Buffer, contentType: string) => Promise<void>;
  putText: (key: string, payload: string) => Promise<void>;
  getText: (key: string) => Promise<string>;
  getBytes: (key: string) => Promise<Buffer>;
  getPublicUrl: (key: string) => string;
};

export type MemoryStorage = {
  adapter: StorageAdapter;
  data: Map<string, Buffer>;
};

const DEFAULT_LOCAL_ROOT = path.join(
  process.cwd(),
  "ssc_artifacts",
  "store"
);

async function ensureDir(filePath: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

export function createStorageAdapter(): StorageAdapter {
  const backend = process.env.SSC_STORAGE_BACKEND ?? "local";
  if (backend !== "local") {
    throw new Error(
      `SSC_STORAGE_BACKEND=${backend} not supported. Use local or add an adapter.`
    );
  }
  const root = process.env.SSC_LOCAL_STORAGE_ROOT ?? DEFAULT_LOCAL_ROOT;
  return {
    async putBytes(key, payload) {
      const filePath = path.join(root, key);
      await ensureDir(filePath);
      await fs.writeFile(filePath, payload);
    },
    async putText(key, payload) {
      const filePath = path.join(root, key);
      await ensureDir(filePath);
      await fs.writeFile(filePath, payload, "utf-8");
    },
    async getText(key) {
      const filePath = path.join(root, key);
      return fs.readFile(filePath, "utf-8");
    },
    async getBytes(key) {
      const filePath = path.join(root, key);
      return fs.readFile(filePath);
    },
    getPublicUrl(key) {
      return `/api/ssc/storyboard/asset?key=${encodeURIComponent(key)}`;
    },
  };
}

export function createMemoryStorage(): MemoryStorage {
  const data = new Map<string, Buffer>();
  const adapter: StorageAdapter = {
    async putBytes(key, payload) {
      data.set(key, Buffer.from(payload));
    },
    async putText(key, payload) {
      data.set(key, Buffer.from(payload, "utf-8"));
    },
    async getText(key) {
      const buffer = data.get(key);
      if (!buffer) throw new Error(`Missing key: ${key}`);
      return buffer.toString("utf-8");
    },
    async getBytes(key) {
      const buffer = data.get(key);
      if (!buffer) throw new Error(`Missing key: ${key}`);
      return buffer;
    },
    getPublicUrl(key) {
      return `memory://${key}`;
    },
  };
  return { adapter, data };
}
