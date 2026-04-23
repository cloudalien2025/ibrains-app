import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export const readJsonFile = async <T>(file: string, fallback: T): Promise<T> => {
  try {
    const raw = await readFile(file, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

export const writeJsonFile = async <T>(file: string, data: T): Promise<void> => {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(data, null, 2), "utf8");
};
