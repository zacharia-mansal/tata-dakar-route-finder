import { listContributionStops, type TransitStopRecord } from '../../../packages/domain/src/transit';
import { jsonResponse, localeFromAcceptLanguage } from './httpRequest';

export type ContributionNetwork = 'aftu_dakar' | 'tata_thies';

export interface ContributionStopSummary {
  id: string;
  network: ContributionNetwork;
  qualityStatus: 'incomplete';
  name?: string | null;
}

interface ContributionRateLimit {
  check(key: string, options?: { signal?: AbortSignal }): Promise<{
    allowed: boolean;
    retryAfterSeconds?: number;
    unavailable?: true;
  }>;
}

interface ContributionStopsDependencies {
  loadStopRecords(network: ContributionNetwork, signal: AbortSignal): Promise<TransitStopRecord[]>;
  rateLimit: ContributionRateLimit;
}

function isContributionNetwork(value: string | null): value is ContributionNetwork {
  return value === 'aftu_dakar' || value === 'tata_thies';
}

function projectContributionStops(
  records: readonly TransitStopRecord[],
  network: ContributionNetwork,
): ContributionStopSummary[] {
  return listContributionStops(records)
    .filter((stop) => stop.network === network && stop.qualityStatus === 'incomplete')
    .map(({ id, name }) => ({
      id,
      network,
      qualityStatus: 'incomplete' as const,
      ...(name === undefined ? {} : { name }),
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

export function createContributionStopsHandler(dependencies: ContributionStopsDependencies) {
  return async (request: Request): Promise<Response> => {
    const locale = localeFromAcceptLanguage(request);
    if (request.method !== 'GET') {
      return jsonResponse({
        error: 'method_not_allowed',
        message: locale === 'fr' ? 'Méthode non autorisée.' : 'Method not allowed.',
      }, 405, { allow: 'GET' });
    }

    const values = new URL(request.url).searchParams.getAll('network');
    const requestedNetwork = values[0] ?? null;
    if (values.length !== 1 || !isContributionNetwork(requestedNetwork)) {
      return jsonResponse({
        error: 'invalid_request',
        message: locale === 'fr' ? 'Requête invalide.' : 'Invalid request.',
      }, 400);
    }

    const controller = new AbortController();
    const abort = () => controller.abort();
    if (request.signal.aborted) abort();
    else request.signal.addEventListener('abort', abort, { once: true });

    try {
      const clientKey = request.headers.get('x-vercel-forwarded-for')?.trim() || 'unknown';
      const rateLimit = await dependencies.rateLimit.check(clientKey, { signal: controller.signal });
      if (rateLimit.unavailable) {
        return jsonResponse({
          error: 'service_unavailable',
          message: locale === 'fr'
            ? 'La liste de contribution est temporairement indisponible.'
            : 'The contribution list is temporarily unavailable.',
        }, 503);
      }
      if (!rateLimit.allowed) {
        return jsonResponse({
          error: 'rate_limited',
          message: locale === 'fr' ? 'Trop de requêtes. Veuillez réessayer plus tard.' : 'Too many requests. Please try again later.',
        }, 429, rateLimit.retryAfterSeconds === undefined ? undefined : { 'retry-after': String(rateLimit.retryAfterSeconds) });
      }
      const stops = projectContributionStops(
        await dependencies.loadStopRecords(requestedNetwork, controller.signal),
        requestedNetwork,
      );
      return jsonResponse({ kind: 'contribution_stops', network: requestedNetwork, stops }, 200);
    } catch {
      return jsonResponse({
        error: 'service_unavailable',
        message: locale === 'fr'
          ? 'La liste de contribution est temporairement indisponible.'
          : 'The contribution list is temporarily unavailable.',
      }, 503);
    } finally {
      request.signal.removeEventListener('abort', abort);
    }
  };
}
