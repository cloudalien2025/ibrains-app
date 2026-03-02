export type IntegrationStatus = {
  openaiConfigured: boolean;
  bdConfigured: boolean;
};

export async function getIntegrationStatus(_userId: string): Promise<IntegrationStatus> {
  return {
    openaiConfigured: false,
    bdConfigured: false,
  };
}
