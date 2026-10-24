import { productionApi } from '@/server/production-api';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  return productionApi().assistant(request);
}
