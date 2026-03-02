type SscStorage = {
  getBytes: (key: string) => Promise<Uint8Array>;
};

export function getStorage(): SscStorage {
  return {
    async getBytes(_key: string) {
      return new Uint8Array();
    },
  };
}
