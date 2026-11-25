import { createContributionStopReader } from '../src/neon';
import { createContributionStopsHandler } from '../src/contribution-stops';
import { createRateLimitPolicy } from '../src/rateLimitPolicy';
import type { SharedRateLimitStore } from '../src/rateLimit';

type EndpointEnvironment = Readonly<Record<string, string | undefined>>;

export function createContributionStopsEndpoint(options: {
  env: EndpointEnvironment;
  sharedRateLimitStore?: SharedRateLimitStore;
  loadStopRecords(network: 'aftu_dakar' | 'tata_thies', signal: AbortSignal): ReturnType<Parameters<typeof createContributionStopsHandler>[0]['loadStopRecords']>;
}) {
  const policy = createRateLimitPolicy({
    vercelEnv: options.env.VERCEL_ENV,
    allowMemoryRateLimit: options.env.ALLOW_MEMORY_RATE_LIMIT,
    sharedStore: options.sharedRateLimitStore,
    namespace: 'contribution-stops',
    configuredMaxRequests: options.env.RATE_LIMIT_CONTRIBUTION_STOPS_PER_MINUTE,
    defaultMaxRequests: 60,
  });
  const rateLimit = policy.rateLimit ?? {
    async check() {
      return { allowed: false, unavailable: true as const };
    },
  };

  return createContributionStopsHandler({
    loadStopRecords: options.loadStopRecords,
    rateLimit,
  });
}

const runtimeEndpoint = createContributionStopsHandler({
  async loadStopRecords(network, signal) {
    return createContributionStopReader().load(network, { signal });
  },
  rateLimit: createRateLimitPolicy({
    vercelEnv: process.env.VERCEL_ENV,
    allowMemoryRateLimit: process.env.ALLOW_MEMORY_RATE_LIMIT,
    namespace: 'contribution-stops',
    configuredMaxRequests: process.env.RATE_LIMIT_CONTRIBUTION_STOPS_PER_MINUTE,
    defaultMaxRequests: 60,
  }).rateLimit ?? {
    async check() {
      return { allowed: false, unavailable: true as const };
    },
  },
});

export default {
  fetch(request: Request): Promise<Response> {
    return runtimeEndpoint(request);
  },
};
