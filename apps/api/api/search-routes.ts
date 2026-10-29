import type { PlaceCandidate } from '../../../packages/domain/src/place';
import { createPublishedNetworkReader } from '../src/neon';
import type { PublishedTransitNetworkSnapshot } from '../src/neon';
import { createSearchRoutesHandler } from '../src/search-routes';
import { createCachedNetworkLoader } from '../src/networkCache';
import type { SharedRateLimitStore } from '../src/rateLimit';
import { createRateLimitPolicy } from '../src/rateLimitPolicy';
import {
  createStadiaWalkingProvider,
  maxWalkingCallsPerRequestFromEnvironment,
  searchRoutesWithMetadata,
  type WalkingRouteProvider,
} from '../src/routing';

type EndpointEnvironment = Readonly<Record<string, string | undefined>>;
type SearchDependencies = Omit<Parameters<typeof createSearchRoutesHandler>[0], 'rateLimit'>;

interface SearchRoutesEndpointOptions {
  env: EndpointEnvironment;
  sharedRateLimitStore?: SharedRateLimitStore;
  dependencies: SearchDependencies;
}

export function createSearchRoutesEndpoint(options: SearchRoutesEndpointOptions) {
  const policy = createRateLimitPolicy({
    vercelEnv: options.env.VERCEL_ENV,
    allowMemoryRateLimit: options.env.ALLOW_MEMORY_RATE_LIMIT,
    sharedStore: options.sharedRateLimitStore,
    namespace: 'search-routes',
    configuredMaxRequests: options.env.RATE_LIMIT_SEARCH_ROUTES_PER_MINUTE,
    defaultMaxRequests: 20,
  });
  const rateLimit = policy.rateLimit ?? {
    async check() {
      return { allowed: false, unavailable: true as const };
    },
  };

  return createSearchRoutesHandler({ ...options.dependencies, rateLimit });
}

type RuntimeNetworkReader = Pick<ReturnType<typeof createPublishedNetworkReader>, 'load'>;

interface RuntimeNetworkOptions {
  createReader?: (options: { connectionString: string }) => RuntimeNetworkReader;
  now?: () => number;
  walkingFetch?: typeof fetch;
}

export function createRuntimeDependencies(
  env: EndpointEnvironment,
  options: RuntimeNetworkOptions = {},
): SearchDependencies {
  let loadCachedSnapshot: ((signal?: AbortSignal) => Promise<PublishedTransitNetworkSnapshot>) | undefined;
  let walkingProvider: WalkingRouteProvider | undefined;
  return {
    async resolvePlaces() {
      throw new Error('Place resolution is unavailable');
    },
    async loadPublishedSnapshot(signal) {
      const connectionString = env.DATABASE_URL_PUBLIC_API;
      if (!connectionString) throw new Error('Published network storage is unavailable');
      if (!loadCachedSnapshot) {
        const networkReader = (options.createReader ?? createPublishedNetworkReader)({ connectionString });
        loadCachedSnapshot = createCachedNetworkLoader({
          load: (requestSignal) => networkReader.load({ signal: requestSignal }),
          now: options.now,
        });
      }
      return loadCachedSnapshot(signal);
    },
    async searchRoutes(input) {
      const apiKey = env.STADIA_ROUTING_API_KEY?.trim();
      if (!apiKey) {
        return { routes: [], partial: true, partialReason: 'walking_service_error' };
      }
      if (!walkingProvider) {
        walkingProvider = createStadiaWalkingProvider({
          apiKey,
          fetch: options.walkingFetch ?? fetch,
        });
      }
      return searchRoutesWithMetadata({
        ...input,
        walking: walkingProvider,
        maxExternalCallsPerRequest: maxWalkingCallsPerRequestFromEnvironment(
          env.MAX_WALKING_CALLS_PER_REQUEST,
        ),
      });
    },
    maxBodyBytes: 16_384,
    requestTimeoutMs: 10_000,
  };
}

const runtimeEnv = process.env;
const runtimeEndpoint = createSearchRoutesEndpoint({
  env: runtimeEnv,
  dependencies: createRuntimeDependencies(runtimeEnv),
});

export default {
  fetch(request: Request): Promise<Response> {
    return runtimeEndpoint(request);
  },
};
