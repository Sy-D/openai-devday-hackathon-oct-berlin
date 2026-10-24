import { productionApi } from '@/server/production-api';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  return productionApi().health(request);
}
