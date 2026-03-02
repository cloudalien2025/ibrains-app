import { PgSscStore } from "./store";
import { createStorageAdapter } from "./storage";
import { createOpenAiClient } from "./llm";

let store: PgSscStore | null = null;
let storage = createStorageAdapter();
let llmClient: ReturnType<typeof createOpenAiClient> | null = null;

export function getStore(): PgSscStore {
  if (!store) {
    store = new PgSscStore();
  }
  return store;
}

export function getStorage() {
  return storage;
}

export function getLlmClient() {
  if (!llmClient) {
    llmClient = createOpenAiClient();
  }
  return llmClient;
}
