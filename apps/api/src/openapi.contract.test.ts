import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';
import type { JourneyOption } from '../../../packages/domain/src/journey';
import type { PlaceCandidate } from '../../../packages/domain/src/place';
import type { PublishedTransitNetworkSnapshot } from './neon';
import type { SharedRateLimitStore } from './rateLimit';
import { createResolvePlacesEndpoint } from '../api/resolve-places';
import { createSearchRoutesEndpoint } from '../api/search-routes';
import { createSearchRoutesHandler } from './search-routes';

type SearchDependencies = Omit<Parameters<typeof createSearchRoutesHandler>[0], 'rateLimit'>;
type JsonRecord = Record<string, unknown>;

const require = createRequire(import.meta.url);
const { load } = require('js-yaml') as { load(source: string): unknown };

interface OpenApiDocument {
  paths: Record<string, JsonRecord>;
  components?: JsonRecord;
}

type JsonSchema = JsonRecord;

const openApiPath = new URL('../../../docs/api/openapi.yaml', import.meta.url);

const cataloguePlace: PlaceCandidate = {
  id: 'ism',
  displayName: 'Institut Supérieur de Management',
  areaName: 'Université',
  coordinates: { lat: 14.696, lon: -17.463 },
  source: 'catalogue',
};

const originCoordinates = { lat: 14.707, lon: -17.451 };

const snapshot: PublishedTransitNetworkSnapshot = {
  directions: [],
  stops: [],
  servedPlaces: [{
    ...cataloguePlace,
    id: cataloguePlace.id,
    placeId: cataloguePlace.id,
    aliases: ['ISM'],
    directionId: 'direction-24-out',
    alightingStopId: 'university',
    verifiedAt: '2026-10-22T12:00:00.000Z',
  }],
};

const route: JourneyOption = {
  id: 'route-24-ism',
  origin: originCoordinates,
  searchedDestination: cataloguePlace,
  servedAreaName: 'Université',
  legs: [{
    directionId: 'direction-24-out',
    lineNumber: '24',
    directionName: 'Castor vers Université',
    boardingStop: {
      id: 'castor',
      name: 'Castor',
      coordinates: originCoordinates,
      aliases: [],
    },
    alightingStop: {
      id: 'university',
      name: 'Université',
      coordinates: cataloguePlace.coordinates,
      aliases: ['ISM'],
    },
    orderedStops: [
      {
        id: 'castor',
        name: 'Castor',
        coordinates: originCoordinates,
        aliases: [],
      },
      {
        id: 'university',
        name: 'Université',
        coordinates: cataloguePlace.coordinates,
        aliases: ['ISM'],
      },
    ],
    displayedDestinationLabel: 'Université',
    receiverQuestion: 'Est-ce que ce bus va vers l’Université ?',
  }],
  finalWalk: {
    distanceMeters: 140,
    instructions: ['Continuez vers l’entrée.'],
    coordinates: [cataloguePlace.coordinates],
  },
  transferCount: 0,
  totalWalkMeters: 140,
  verifiedAt: '2026-10-22T12:00:00.000Z',
  geometry: {
    segments: [
      { kind: 'tata', lineNumber: '24', coordinates: [originCoordinates, cataloguePlace.coordinates] },
      { kind: 'walk', coordinates: [cataloguePlace.coordinates] },
    ],
    bounds: [-17.463, 14.696, -17.451, 14.707],
  },
};

function createStore(): SharedRateLimitStore {
  const counts = new Map<string, number>();
  return {
    increment: vi.fn(async (key: string) => {
      const next = (counts.get(key) ?? 0) + 1;
      counts.set(key, next);
      return next;
    }),
  };
}

function searchDependencies(
  searchRoutes: SearchDependencies['searchRoutes'] = vi.fn(async () => [route]),
): SearchDependencies {
  return {
    resolvePlaces: vi.fn(async () => ({ kind: 'matches', places: [] })),
    loadPublishedSnapshot: vi.fn(async () => snapshot),
    searchRoutes,
    maxBodyBytes: 16_384,
    requestTimeoutMs: 10_000,
  };
}

function post(path: string, body: string, headers: Record<string, string> = {}): Request {
  return new Request(`https://api.example.test${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body,
  });
}

function jsonPost(path: string, body: unknown, headers: Record<string, string> = {}): Request {
  return post(path, JSON.stringify(body), headers);
}

function resolveEndpoint(options: {
  resolvePlaces: NonNullable<Parameters<typeof createResolvePlacesEndpoint>[0]['resolvePlaces']>;
  store?: SharedRateLimitStore;
  env?: Record<string, string | undefined>;
  stadiaApiKey?: string;
}) {
  return createResolvePlacesEndpoint({
    env: options.env ?? { VERCEL_ENV: 'preview' },
    sharedRateLimitStore: options.store ?? createStore(),
    stadiaApiKey: options.stadiaApiKey ?? 'fixture-only-key',
    resolvePlaces: options.resolvePlaces,
  });
}

function routeEndpoint(options: {
  dependencies: SearchDependencies;
  store?: SharedRateLimitStore;
  env?: Record<string, string | undefined>;
}) {
  return createSearchRoutesEndpoint({
    env: options.env ?? { VERCEL_ENV: 'preview' },
    sharedRateLimitStore: options.store ?? createStore(),
    dependencies: options.dependencies,
  });
}

function searchRequestBody(locale: 'fr' | 'en' = 'fr') {
  return {
    origin: { kind: 'coordinates', coordinates: originCoordinates },
    destination: { source: 'catalogue', id: cataloguePlace.id },
    locale,
  };
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getOpenApiDocument(): OpenApiDocument {
  const source = readFileSync(openApiPath, 'utf8');
  const parsed: unknown = load(source);
  if (!isRecord(parsed) || !isRecord(parsed.paths)) {
    throw new TypeError('OpenAPI document must define a paths object');
  }
  return parsed as unknown as OpenApiDocument;
}

function resolvePointer(document: OpenApiDocument, reference: string): unknown {
  if (!reference.startsWith('#/')) throw new TypeError(`Only local OpenAPI references are supported: ${reference}`);
  return reference.slice(2).split('/').reduce<unknown>((current, segment) => {
    const key = segment.replace(/~1/g, '/').replace(/~0/g, '~');
    if (!isRecord(current) || !(key in current)) throw new TypeError(`Unresolved OpenAPI reference: ${reference}`);
    return current[key];
  }, document);
}

const supportedSchemaKeywords = new Set([
  '$ref', 'type', 'enum', 'const', 'required', 'properties', 'items', 'additionalProperties',
  'anyOf', 'oneOf', 'minimum', 'maximum', 'exclusiveMinimum', 'exclusiveMaximum', 'minLength',
  'maxLength', 'minItems', 'maxItems', 'pattern', 'format', 'description', 'title', 'default',
  'examples', 'example', 'deprecated', 'readOnly', 'writeOnly', 'nullable',
]);

function schemaIssues(value: unknown, schemaInput: unknown, document: OpenApiDocument, path: string): string[] {
  if (!isRecord(schemaInput)) throw new TypeError(`Schema at ${path} must be an object`);
  const unsupported = Object.keys(schemaInput).filter((key) => !supportedSchemaKeywords.has(key));
  if (unsupported.length > 0) {
    throw new TypeError(`Unsupported JSON Schema keyword(s) at ${path}: ${unsupported.join(', ')}`);
  }
  if (typeof schemaInput.$ref === 'string') {
    return schemaIssues(value, resolvePointer(document, schemaInput.$ref), document, path);
  }

  if (Array.isArray(schemaInput.anyOf)) {
    const branchIssues = schemaInput.anyOf.map((branch, index) => schemaIssues(value, branch, document, `${path}.anyOf[${index}]`));
    if (branchIssues.some((issues) => issues.length === 0)) return [];
    return [`${path} does not match anyOf`];
  }
  if (Array.isArray(schemaInput.oneOf)) {
    const branchIssues = schemaInput.oneOf.map((branch, index) => schemaIssues(value, branch, document, `${path}.oneOf[${index}]`));
    if (branchIssues.filter((issues) => issues.length === 0).length === 1) return [];
    return [`${path} must match exactly one oneOf branch`];
  }

  const issues: string[] = [];
  const type = schemaInput.type;
  const types = Array.isArray(type) ? type : type === undefined ? [] : [type];
  if (types.length > 0) {
    const matchesType = types.some((candidate) => {
      switch (candidate) {
        case 'object': return isRecord(value);
        case 'array': return Array.isArray(value);
        case 'string': return typeof value === 'string';
        case 'number': return typeof value === 'number' && Number.isFinite(value);
        case 'integer': return typeof value === 'number' && Number.isInteger(value);
        case 'boolean': return typeof value === 'boolean';
        case 'null': return value === null;
        default: throw new TypeError(`Unsupported JSON Schema type at ${path}: ${String(candidate)}`);
      }
    });
    if (!matchesType) return [`${path} must have type ${types.join(' or ')}`];
  }

  if (Array.isArray(schemaInput.enum) && !schemaInput.enum.some((candidate) => Object.is(candidate, value))) {
    issues.push(`${path} must match an enum value`);
  }
  if ('const' in schemaInput && !Object.is(schemaInput.const, value)) issues.push(`${path} must match const`);

  if (isRecord(value)) {
    const required = Array.isArray(schemaInput.required) ? schemaInput.required : [];
    for (const field of required) {
      if (typeof field !== 'string') throw new TypeError(`Invalid required entry at ${path}`);
      if (!(field in value)) issues.push(`${path}.${field} is required`);
    }
    const properties = isRecord(schemaInput.properties) ? schemaInput.properties : {};
    for (const [key, propertySchema] of Object.entries(properties)) {
      if (key in value) issues.push(...schemaIssues(value[key], propertySchema, document, `${path}.${key}`));
    }
    if (schemaInput.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(key in properties)) issues.push(`${path}.${key} is not allowed`);
      }
    } else if (isRecord(schemaInput.additionalProperties)) {
      for (const [key, propertyValue] of Object.entries(value)) {
        if (!(key in properties)) issues.push(...schemaIssues(propertyValue, schemaInput.additionalProperties, document, `${path}.${key}`));
      }
    }
  }

  if (Array.isArray(value) && schemaInput.items !== undefined) {
    value.forEach((item, index) => issues.push(...schemaIssues(item, schemaInput.items, document, `${path}[${index}]`)));
  }
  if (typeof value === 'string') {
    if (typeof schemaInput.minLength === 'number' && value.length < schemaInput.minLength) issues.push(`${path} is too short`);
    if (typeof schemaInput.maxLength === 'number' && value.length > schemaInput.maxLength) issues.push(`${path} is too long`);
    if (typeof schemaInput.pattern === 'string' && !new RegExp(schemaInput.pattern).test(value)) issues.push(`${path} does not match pattern`);
    if (schemaInput.format === 'date-time' && !Number.isFinite(Date.parse(value))) issues.push(`${path} must be date-time`);
  }
  if (typeof value === 'number') {
    if (typeof schemaInput.minimum === 'number' && value < schemaInput.minimum) issues.push(`${path} is below minimum`);
    if (typeof schemaInput.maximum === 'number' && value > schemaInput.maximum) issues.push(`${path} is above maximum`);
    if (typeof schemaInput.exclusiveMinimum === 'number' && value <= schemaInput.exclusiveMinimum) issues.push(`${path} is below exclusive minimum`);
    if (typeof schemaInput.exclusiveMaximum === 'number' && value >= schemaInput.exclusiveMaximum) issues.push(`${path} is above exclusive maximum`);
  }
  if (Array.isArray(value)) {
    if (typeof schemaInput.minItems === 'number' && value.length < schemaInput.minItems) issues.push(`${path} has too few items`);
    if (typeof schemaInput.maxItems === 'number' && value.length > schemaInput.maxItems) issues.push(`${path} has too many items`);
  }
  return issues;
}

async function expectDocumentedResponse(path: string, response: Response): Promise<unknown> {
  const document = getOpenApiDocument();
  const operation = document.paths[path]?.post;
  if (!isRecord(operation) || !isRecord(operation.responses)) {
    throw new TypeError(`OpenAPI POST ${path} response definitions are missing`);
  }
  const responseDefinition = resolvePointer(document, `#/paths/${path.replaceAll('/', '~1')}/post/responses/${response.status}`);
  const resolvedResponse = isRecord(responseDefinition) && typeof responseDefinition.$ref === 'string'
    ? resolvePointer(document, responseDefinition.$ref)
    : responseDefinition;
  if (!isRecord(resolvedResponse) || !isRecord(resolvedResponse.content) || !isRecord(resolvedResponse.content['application/json'])) {
    throw new TypeError(`OpenAPI response ${path} ${response.status} must define application/json`);
  }
  const body: unknown = await response.clone().json();
  const issues = schemaIssues(body, resolvedResponse.content['application/json'].schema, document, 'response');
  expect(issues, `OpenAPI response contract for ${path} ${response.status}`).toEqual([]);
  return body;
}

describe('OpenAPI response contracts', () => {
  it('validates an unambiguous place match returned by the handler', async () => {
    const handler = resolveEndpoint({
      resolvePlaces: async () => ({ kind: 'matches', places: [cataloguePlace] }),
    });
    const response = await handler(jsonPost('/api/resolve-places', { query: 'ISM', locale: 'fr' }));

    expect(response.status).toBe(200);
    await expectDocumentedResponse('/api/resolve-places', response);
  });

  it('validates an ambiguous place result instead of selecting one candidate', async () => {
    const secondPlace: PlaceCandidate = {
      ...cataloguePlace,
      id: 'ism-annexe',
      displayName: 'ISM Annexe',
      coordinates: { lat: 14.697, lon: -17.462 },
    };
    const handler = resolveEndpoint({
      resolvePlaces: async () => ({ kind: 'ambiguous', places: [cataloguePlace, secondPlace] }),
    });
    const response = await handler(jsonPost('/api/resolve-places', { query: 'ISM', locale: 'en' }));

    expect(response.status).toBe(200);
    await expectDocumentedResponse('/api/resolve-places', response);
  });

  it.each([
    ['fr', ''],
    ['en', ''],
  ] as const)('validates localized 400 responses from resolve-places (%s)', async (locale, query) => {
    const handler = resolveEndpoint({ resolvePlaces: async () => ({ kind: 'matches', places: [] }) });
    const response = await handler(jsonPost('/api/resolve-places', { query, locale }));

    expect(response.status).toBe(400);
    await expectDocumentedResponse('/api/resolve-places', response);
  });

  it.each(['fr', 'en'] as const)('validates localized 400 invalid-place-name responses from search-routes (%s)', async (locale) => {
    const handler = routeEndpoint({ dependencies: searchDependencies() });
    const response = await handler(jsonPost('/api/search-routes', {
      origin: { kind: 'coordinates', coordinates: originCoordinates },
      destination: { source: 'geocoder', coordinates: cataloguePlace.coordinates, displayName: '' },
      locale,
    }));

    expect(response.status).toBe(400);
    await expectDocumentedResponse('/api/search-routes', response);
  });

  it('validates a complete route result returned by search-routes', async () => {
    const handler = routeEndpoint({ dependencies: searchDependencies(async () => [route]) });
    const response = await handler(jsonPost('/api/search-routes', searchRequestBody()));

    expect(response.status).toBe(200);
    await expectDocumentedResponse('/api/search-routes', response);
  });

  it('validates a successful geocoder destination resolved to the published service area', async () => {
    const searchedCoordinates = { lat: 14.6962, lon: -17.4628 };
    const handler = routeEndpoint({
      dependencies: searchDependencies(async ({ destination }) => [{
        ...route,
        searchedDestination: destination,
      }]),
    });
    const response = await handler(jsonPost('/api/search-routes', {
      origin: { kind: 'coordinates', coordinates: originCoordinates },
      destination: {
        source: 'geocoder',
        coordinates: searchedCoordinates,
        displayName: 'Centre commercial Castor',
      },
      locale: 'fr',
    }));

    expect(response.status).toBe(200);
    const body: unknown = await response.clone().json();
    expect(body).toMatchObject({
      kind: 'routes',
      places: [{
        id: cataloguePlace.id,
        displayName: 'Centre commercial Castor',
        areaName: 'Université',
        coordinates: searchedCoordinates,
        source: 'geocoder',
      }],
    });
    await expectDocumentedResponse('/api/search-routes', response);
  });

  it('validates the explicit no-verified-journey result', async () => {
    const handler = routeEndpoint({
      dependencies: searchDependencies(async () => ({ routes: [], partial: false })),
    });
    const response = await handler(jsonPost('/api/search-routes', searchRequestBody()));

    expect(response.status).toBe(200);
    await expectDocumentedResponse('/api/search-routes', response);
  });

  it('validates a partial route result and its reason', async () => {
    const handler = routeEndpoint({
      dependencies: searchDependencies(async () => ({
        routes: [route],
        partial: true,
        partialReason: 'call_limit',
      })),
    });
    const response = await handler(jsonPost('/api/search-routes', searchRequestBody()));

    expect(response.status).toBe(200);
    await expectDocumentedResponse('/api/search-routes', response);
  });

  it.each([
    ['resolve-places', 'fr'],
    ['resolve-places', 'en'],
    ['search-routes', 'fr'],
    ['search-routes', 'en'],
  ] as const)('validates localized 429 responses from %s (%s)', async (endpoint, locale) => {
    const store = createStore();
    const env = {
      VERCEL_ENV: 'preview',
      RATE_LIMIT_RESOLVE_PLACES_PER_MINUTE: '1',
      RATE_LIMIT_SEARCH_ROUTES_PER_MINUTE: '1',
    };
    const handler = endpoint === 'resolve-places'
      ? resolveEndpoint({
          env,
      store,
          resolvePlaces: async () => ({ kind: 'matches', places: [cataloguePlace] }),
        })
      : routeEndpoint({ dependencies: searchDependencies(), env, store });
    const request = () => endpoint === 'resolve-places'
      ? jsonPost('/api/resolve-places', { query: 'ISM', locale }, { 'x-vercel-forwarded-for': '198.51.100.42' })
      : jsonPost('/api/search-routes', searchRequestBody(locale), { 'x-vercel-forwarded-for': '198.51.100.42' });

    await handler(request());
    const response = await handler(request());

    expect(response.status).toBe(429);
    expect(Number(response.headers.get('retry-after'))).toBeGreaterThan(0);
    await expectDocumentedResponse(`/api/${endpoint}`, response);
  });

  it('validates the localized 503 response from resolve-places when its geocoder key is absent', async () => {
    const handler = resolveEndpoint({
      resolvePlaces: async () => ({ kind: 'matches', places: [] }),
      stadiaApiKey: '',
    });
    const response = await handler(jsonPost('/api/resolve-places', { query: 'unknown', locale: 'fr' }));

    expect(response.status).toBe(503);
    await expectDocumentedResponse('/api/resolve-places', response);
  });

  it('validates the localized 503 response from search-routes when shared rate limiting is unavailable', async () => {
    const handler = createSearchRoutesEndpoint({
      env: { VERCEL_ENV: 'preview' },
      dependencies: searchDependencies(),
    });
    const response = await handler(jsonPost('/api/search-routes', searchRequestBody('en')));

    expect(response.status).toBe(503);
    await expectDocumentedResponse('/api/search-routes', response);
  });
});
