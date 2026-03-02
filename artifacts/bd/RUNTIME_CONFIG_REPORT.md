# BD Runtime Config (DirectoryIQ)

- BD_BASE_URL resolved from DB integration meta (baseUrl/base_url): https://www.vailvacay.com
- BD_API_KEY source: integrations_credentials.secret_ciphertext (provider=brilliant_directories), decrypted at runtime
- Credential row user_id: 00000000-0000-4000-8000-000000000001
- Credential updated_at: Sun Mar 01 2026 06:23:18 GMT+0000 (Coordinated Universal Time)

## Code Loading Paths
- app/api/directoryiq/listings/[listingId]/route.ts
- app/api/directoryiq/_utils/credentials.ts#getDirectoryIqIntegrationSecret
- app/api/directoryiq/_utils/integrations.ts#getDirectoryIqBdConnection

## Request Method
- GET /api/v2/user/get/{user_id}
- Header: X-Api-Key