declare module "sharp" {
  type SharpResizeOptions = {
    fit?: string;
    position?: string;
    background?: {
      r: number;
      g: number;
      b: number;
      alpha?: number;
    };
    withoutEnlargement?: boolean;
  };

  type SharpPipeline = {
    png(): {
      toBuffer(): Promise<Buffer>;
    };
  };

  type SharpInstance = {
    metadata(): Promise<{ width?: number; height?: number }>;
    resize(width: number, height: number, options?: SharpResizeOptions): SharpPipeline;
  };

  type SharpFactory = (input?: Buffer | Uint8Array) => SharpInstance;

  const sharp: SharpFactory;
  export default sharp;
}
