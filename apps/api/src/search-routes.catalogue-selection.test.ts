import { describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import type { JourneyOption, TransitNetwork } from '../../../packages/domain/src/journey';
import { distanceMeters } from '../../../packages/domain/src/search';
import type { PlaceCandidate } from '../../../packages/domain/src/place';
import type { Coordinates } from '../../../packages/domain/src/map';
import type { TransitDirection, TransitStop } from '../../../packages/domain/src/transit';
import { createSearchRoutesHandler } from './search-routes';
import type { PublishedServedPlace } from './neon';

type HandlerDependencies = Parameters<typeof createSearchRoutesHandler>[0];
type PublishedSnapshot = Omit<TransitNetwork, 'servedPlaces'> & {
  servedPlaces: PublishedServedPlace[];
};
type TestDependencies = Omit<HandlerDependencies, 'loadPublishedSnapshot' | 'resolvePlaces' | 'searchRoutes' | 'rateLimit'> & {
  loadPublishedSnapshot: Mock<HandlerDependencies['loadPublishedSnapshot']>;
  resolvePlaces: Mock<HandlerDependencies['resolvePlaces']>;
  searchRoutes: Mock<HandlerDependencies['searchRoutes']>;
  rateLimit: { check: Mock<HandlerDependencies['rateLimit']['check']> };
};

const coordinates: Coordinates = { lat: 14.696, lon: -17.463 };
const university: TransitStop = {
  id: 'university',
  network: 'aftu_dakar',
  qualityStatus: 'confirmed',
  source: 'test_fixture',
  sourceReference: 'fixture-only',
  name: 'Université',
  coordinates,
  aliases: [],
};
const direction: TransitDirection = {
  id: 'direction-24-out',
  network: 'aftu_dakar',
  networkName: 'AFTU Dakar',
  qualityStatus: 'confirmed',
  source: 'test_fixture',
  lineNumber: '24',
  directionName: 'Castor vers Université',
  displayedDestinationLabel: 'Université',
  receiverQuestion: 'Est-ce que ça va vers l’Université ?',
  stops: [university],
};
const canonicalPlace: PublishedServedPlace = {
  id: 'ism',
  placeId: 'ism',
  displayName: 'Institut Supérieur de Management',
  areaName: 'Université',
  coordinates,
  aliases: ['ISM'],
  directionId: direction.id,
  alightingStopId: university.id,
  verifiedAt: '2026-10-22T12:00:00.000Z',
  source: 'catalogue',
};
const otherPlace: PublishedServedPlace = {
  ...canonicalPlace,
  id: 'university-campus',
  placeId: 'university-campus',
  displayName: 'Campus universitaire',
  aliases: [],
};
const publishedSnapshot: PublishedSnapshot = {
  directions: [direction],
  stops: [university],
  servedPlaces: [canonicalPlace, otherPlace],
};

function dependencies(snapshot = publishedSnapshot, routes: JourneyOption[] = []): TestDependencies {
  return {
    loadPublishedSnapshot: vi.fn<HandlerDependencies['loadPublishedSnapshot']>().mockResolvedValue(snapshot),
    resolvePlaces: vi.fn<HandlerDependencies['resolvePlaces']>().mockResolvedValue({
      kind: 'ambiguous',
      places: [canonicalPlace, otherPlace],
    }),
    searchRoutes: vi.fn<HandlerDependencies['searchRoutes']>().mockResolvedValue(routes),
    rateLimit: { check: vi.fn<HandlerDependencies['rateLimit']['check']>().mockResolvedValue({ allowed: true }) },
    maxBodyBytes: 16_384,
    requestTimeoutMs: 10_000,
  };
}

function post(body: unknown): Request {
  return new Request('https://api.example.test/v1/search-routes', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function postRaw(body: string): Request {
  return new Request('https://api.example.test/v1/search-routes', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  });
}

function geocoderPlace(
  candidateCoordinates: Coordinates,
  displayName = 'Lieu géocodé',
  id = 'stadia-result',
) {
  return {
    id,
    placeId: id,
    displayName,
    areaName: 'Lieu affiché par le géocodeur',
    coordinates: candidateCoordinates,
    source: 'geocoder' as const,
  };
}

function publishedPlace(id: string, candidateCoordinates: Coordinates, areaName = 'Université'): PublishedServedPlace {
  return {
    ...canonicalPlace,
    id,
    placeId: id,
    displayName: `Lieu publié ${id}`,
    areaName,
    coordinates: candidateCoordinates,
    aliases: [],
  };
}

function snapshotFor(places: PublishedServedPlace[]): PublishedSnapshot {
  return { directions: [direction], stops: [university], servedPlaces: places };
}

function journeyFor(destination: PlaceCandidate, servedAreaName = 'Université'): JourneyOption {
  return {
    id: 'fixture-journey',
    origin: { lat: 14.707, lon: -17.451 },
    searchedDestination: destination,
    servedAreaName,
    legs: [],
    finalWalk: { distanceMeters: 0, instructions: [], coordinates: [destination.coordinates] },
    transferCount: 0,
    totalWalkMeters: 0,
    verifiedAt: canonicalPlace.verifiedAt,
    geometry: {
      segments: [],
      bounds: [destination.coordinates.lon, destination.coordinates.lat, destination.coordinates.lon, destination.coordinates.lat],
    },
  };
}

function pointNorth(originPoint: Coordinates, meters: number): Coordinates {
  return {
    lat: originPoint.lat + (meters / 6_371_000) * (180 / Math.PI),
    lon: originPoint.lon,
  };
}

const origin = { kind: 'coordinates' as const, coordinates: { lat: 14.707, lon: -17.451 } };
const selectedCataloguePlace: PlaceCandidate = {
  id: 'ism',
  displayName: 'Nom modifié dans le client',
  areaName: 'Zone modifiée dans le client',
  coordinates: { lat: 0, lon: 0 },
  matchedAlias: 'Alias modifié dans le client',
  source: 'catalogue',
};

describe('selected catalogue place security contract', () => {
  it('uses only the selected id and canonical published snapshot fields', async () => {
    const deps = dependencies();
    const response = await createSearchRoutesHandler(deps)(post({
      origin,
      destination: selectedCataloguePlace,
      locale: 'fr',
    }));

    expect(response.status).toBe(200);
    expect(deps.loadPublishedSnapshot).toHaveBeenCalledTimes(1);
    expect(deps.resolvePlaces).not.toHaveBeenCalled();
    expect(deps.searchRoutes).toHaveBeenCalledWith(expect.objectContaining({
      destination: expect.objectContaining({
        id: 'ism',
        displayName: 'Institut Supérieur de Management',
        areaName: 'Université',
        coordinates,
        aliases: ['ISM'],
      }),
    }));
  });

  it('returns a clear not-found response for an unknown selected id without substituting another place', async () => {
    const deps = dependencies();
    const response = await createSearchRoutesHandler(deps)(post({
      origin,
      destination: { ...selectedCataloguePlace, id: 'unknown-selected-id' },
      locale: 'fr',
    }));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ kind: 'not_found' });
    expect(deps.loadPublishedSnapshot).toHaveBeenCalledTimes(1);
    expect(deps.resolvePlaces).not.toHaveBeenCalled();
    expect(deps.searchRoutes).not.toHaveBeenCalled();
  });

  it('does not re-open an already selected place as ambiguous', async () => {
    const deps = dependencies();
    deps.resolvePlaces.mockResolvedValue({ kind: 'ambiguous', places: [canonicalPlace, otherPlace] });
    const response = await createSearchRoutesHandler(deps)(post({
      origin,
      destination: selectedCataloguePlace,
      locale: 'fr',
    }));
    const result = await response.json() as { kind?: string };

    expect(result.kind).not.toBe('ambiguous');
    expect(deps.loadPublishedSnapshot).toHaveBeenCalledTimes(1);
    expect(deps.resolvePlaces).not.toHaveBeenCalled();
    expect(deps.searchRoutes).toHaveBeenCalledTimes(1);
  });

  it('returns no_verified_journey when a canonical catalogue place has no verified routes', async () => {
    const deps = dependencies(publishedSnapshot, []);
    const response = await createSearchRoutesHandler(deps)(post({
      origin,
      destination: selectedCataloguePlace,
      locale: 'fr',
    }));
    const result = await response.json() as { kind?: string; routes?: JourneyOption[] };

    expect(response.status).toBe(200);
    expect(result.kind).toBe('no_verified_journey');
    expect(result.routes).toBeUndefined();
  });

  it('resolves a selected catalogue origin from the same canonical snapshot by id', async () => {
    const canonicalOrigin = {
      ...canonicalPlace,
      id: 'castor',
      placeId: 'castor',
      displayName: 'Castor',
      areaName: 'SICAP',
      aliases: ['Castor stop'],
      coordinates: { lat: 14.707, lon: -17.451 },
    };
    const selectedOrigin: PlaceCandidate = {
      ...canonicalOrigin,
      displayName: 'Nom falsifié',
      areaName: 'Zone falsifiée',
      coordinates: { lat: 0, lon: 0 },
      matchedAlias: 'Alias falsifié',
    };
    const deps = dependencies(snapshotFor([canonicalOrigin, canonicalPlace]));
    const response = await createSearchRoutesHandler(deps)(post({
      origin: selectedOrigin,
      destination: canonicalPlace,
      locale: 'fr',
    }));

    expect(response.status).toBe(200);
    expect(deps.loadPublishedSnapshot).toHaveBeenCalledTimes(1);
    expect(deps.resolvePlaces).not.toHaveBeenCalled();
    expect(deps.searchRoutes).toHaveBeenCalledWith(expect.objectContaining({
      origin: expect.objectContaining({
        id: 'castor',
        displayName: 'Castor',
        areaName: 'SICAP',
        coordinates: { lat: 14.707, lon: -17.451 },
        aliases: ['Castor stop'],
      }),
    }));
  });
});

describe('selected geocoder place validation and matching contract', () => {
  it('filters equal line numbers to the requested network before routing', async () => {
    const tataStop: TransitStop = {
      ...university,
      id: 'fixture-tata-stop',
      network: 'tata_thies',
      sourceReference: 'fixture-only',
    };
    const tataDirection: TransitDirection = {
      ...direction,
      id: 'fixture-tata-direction',
      network: 'tata_thies',
      networkName: 'Tata Thiès',
      stops: [tataStop],
    };
    const tataPlace: PublishedServedPlace = {
      ...canonicalPlace,
      id: 'fixture-tata-place',
      placeId: 'fixture-tata-place',
      directionId: tataDirection.id,
      alightingStopId: tataStop.id,
    };
    const deps = dependencies({
      directions: [direction, tataDirection],
      stops: [university, tataStop],
      servedPlaces: [canonicalPlace, tataPlace],
    });

    const response = await createSearchRoutesHandler(deps)(post({
      network: 'tata_thies',
      origin: { kind: 'coordinates', coordinates },
      destination: { source: 'catalogue', id: tataPlace.id },
      locale: 'fr',
    }));

    expect(response.status).toBe(200);
    expect(deps.searchRoutes).toHaveBeenCalledWith(expect.objectContaining({
      networkId: 'tata_thies',
      network: expect.objectContaining({
        directions: [expect.objectContaining({ id: tataDirection.id, lineNumber: '24', network: 'tata_thies' })],
        stops: [expect.objectContaining({ id: tataStop.id, network: 'tata_thies' })],
        servedPlaces: [expect.objectContaining({ placeId: tataPlace.placeId, directionId: tataDirection.id })],
      }),
    }));
  });

  it('accepts a Tata Thiès geocoder selection outside Dakar and keeps it in that network', async () => {
    const thiesCoordinates: Coordinates = { lat: 0.01, lon: 0.01 };
    const thiesStop: TransitStop = {
      ...university,
      id: 'fixture-thies-stop',
      network: 'tata_thies',
      name: 'FICTIF-arrêt Thiès',
      coordinates: thiesCoordinates,
    };
    const thiesDirection: TransitDirection = {
      ...direction,
      id: 'fixture-thies-direction',
      network: 'tata_thies',
      networkName: 'Tata Thiès',
      stops: [thiesStop],
    };
    const thiesPlace: PublishedServedPlace = {
      ...canonicalPlace,
      id: 'fixture-thies-place',
      placeId: 'fixture-thies-place',
      directionId: thiesDirection.id,
      alightingStopId: thiesStop.id,
      coordinates: thiesCoordinates,
    };
    const deps = dependencies({ directions: [thiesDirection], stops: [thiesStop], servedPlaces: [thiesPlace] });

    const response = await createSearchRoutesHandler(deps)(post({
      network: 'tata_thies',
      origin: { source: 'geocoder', coordinates: { lat: 0.011, lon: 0.01 }, displayName: 'FICTIF-origine' },
      destination: { source: 'catalogue', id: thiesPlace.id },
      locale: 'fr',
    }));

    expect(response.status).toBe(200);
    expect(deps.searchRoutes).toHaveBeenCalledWith(expect.objectContaining({ networkId: 'tata_thies' }));
  });

  const geocodedCoordinates: Coordinates = { lat: 14.7, lon: -17.4 };

  it.each([
    ['Plateau', { lat: 14.67, lon: -17.43 }],
    ['Pikine', { lat: 14.75, lon: -17.39 }],
    ['Rufisque', { lat: 14.72, lon: -17.27 }],
    ['Diamniadio', { lat: 14.72, lon: -17.18 }],
    ['the normal Dakar coordinate pair', { lat: 14.69, lon: -17.44 }],
    ['the inclusive lower bounding corner', { lat: 14.55, lon: -17.6 }],
    ['the inclusive upper bounding corner', { lat: 14.9, lon: -17.05 }],
  ])('accepts an in-bounds geocoder point for %s and loads only the published snapshot', async (_name, point) => {
    const selected = geocoderPlace(point);
    const served = publishedPlace('served-plateau', point);
    const deps = dependencies(snapshotFor([served]));
    deps.resolvePlaces.mockResolvedValue({ kind: 'matches', places: [selected] });
    deps.searchRoutes.mockImplementation(async ({ destination }) => [journeyFor(destination, served.areaName)]);
    const response = await createSearchRoutesHandler(deps)(post({
      origin,
      destination: selected,
      locale: 'fr',
    }));

    expect(response.status).toBe(200);
    expect(deps.loadPublishedSnapshot).toHaveBeenCalledTimes(1);
    expect(deps.resolvePlaces).not.toHaveBeenCalled();
    expect(deps.searchRoutes).toHaveBeenCalledWith(expect.objectContaining({
      destination: expect.objectContaining({
        id: served.id,
        source: 'geocoder',
        displayName: selected.displayName,
        coordinates: point,
      }),
    }));
  });

  it.each([
    ['Thiès', { lat: 14.79, lon: -16.93 }],
    ['Saint-Louis', { lat: 16.017, lon: -16.5 }],
    ['Paris', { lat: 48.8566, lon: 2.3522 }],
    ['the origin point', { lat: 0, lon: 0 }],
    ['the inverted Dakar latitude/longitude pair', { lat: -17.44, lon: 14.69 }],
    ['just south of the lower latitude bound', { lat: 14.5499999999, lon: -17.4 }],
    ['just north of the upper latitude bound', { lat: 14.9000000001, lon: -17.4 }],
    ['just west of the lower longitude bound', { lat: 14.7, lon: -17.6000000001 }],
    ['just east of the upper longitude bound', { lat: 14.7, lon: -17.0499999999 }],
  ])('rejects %s without loading the snapshot or routing', async (_name, point) => {
    const selected = geocoderPlace(point);
    const deps = dependencies(snapshotFor([publishedPlace(selected.id, point)]));
    deps.resolvePlaces.mockResolvedValue({ kind: 'matches', places: [selected] });
    const response = await createSearchRoutesHandler(deps)(post({ origin, destination: selected, locale: 'fr' }));

    expect(response.status).toBe(400);
    expect(deps.loadPublishedSnapshot).not.toHaveBeenCalled();
    expect(deps.resolvePlaces).not.toHaveBeenCalled();
    expect(deps.searchRoutes).not.toHaveBeenCalled();
  });

  it.each([
    ['non-numeric latitude', { lat: '14.7', lon: -17.4 }],
    ['null latitude', { lat: null, lon: -17.4 }],
  ])('rejects a %s without loading the snapshot or routing', async (_name, point) => {
    const selected = { ...geocoderPlace(geocodedCoordinates), coordinates: point };
    const deps = dependencies();
    const response = await createSearchRoutesHandler(deps)(post({ origin, destination: selected, locale: 'fr' }));

    expect(response.status).toBe(400);
    expect(deps.loadPublishedSnapshot).not.toHaveBeenCalled();
    expect(deps.resolvePlaces).not.toHaveBeenCalled();
    expect(deps.searchRoutes).not.toHaveBeenCalled();
  });

  it('rejects a JSON exponent that parses to Infinity before loading the snapshot', async () => {
    const deps = dependencies();
    const body = '{"origin":{"kind":"coordinates","coordinates":{"lat":14.707,"lon":-17.451}},' +
      '"destination":{"id":"stadia-result","placeId":"stadia-result",' +
      '"displayName":"Lieu géocodé","areaName":"Lieu affiché par le géocodeur",' +
      '"coordinates":{"lat":1e999,"lon":-17.4},"source":"geocoder"},"locale":"fr"}';
    const response = await createSearchRoutesHandler(deps)(postRaw(body));

    expect(response.status).toBe(400);
    expect(deps.loadPublishedSnapshot).not.toHaveBeenCalled();
    expect(deps.resolvePlaces).not.toHaveBeenCalled();
    expect(deps.searchRoutes).not.toHaveBeenCalled();
  });

  it('rejects a NaN token as invalid JSON before loading the snapshot', async () => {
    const deps = dependencies();
    const body = '{"origin":{"kind":"coordinates","coordinates":{"lat":14.707,"lon":-17.451}},' +
      '"destination":{"id":"stadia-result","placeId":"stadia-result",' +
      '"displayName":"Lieu géocodé","areaName":"Lieu affiché par le géocodeur",' +
      '"coordinates":{"lat":NaN,"lon":-17.4},"source":"geocoder"},"locale":"fr"}';
    const response = await createSearchRoutesHandler(deps)(postRaw(body));

    expect(response.status).toBe(400);
    expect(deps.loadPublishedSnapshot).not.toHaveBeenCalled();
    expect(deps.resolvePlaces).not.toHaveBeenCalled();
    expect(deps.searchRoutes).not.toHaveBeenCalled();
  });

  it('uses Haversine proximity, preserves the selected label and coordinates, and keeps the served area distinct', async () => {
    const selected = geocoderPlace(geocodedCoordinates, 'Marché recherché');
    const longitudeNearer = publishedPlace('longitude-nearer', {
      lat: geocodedCoordinates.lat,
      lon: geocodedCoordinates.lon + 0.0028,
    });
    const degreeDistanceNearer = publishedPlace('latitude-nearer-in-degrees', {
      lat: geocodedCoordinates.lat + 0.00271,
      lon: geocodedCoordinates.lon,
    });
    const deps = dependencies(snapshotFor([degreeDistanceNearer, longitudeNearer]));
    deps.resolvePlaces.mockResolvedValue({ kind: 'matches', places: [degreeDistanceNearer, longitudeNearer] });
    deps.searchRoutes.mockImplementation(async ({ destination }) => [journeyFor(destination, longitudeNearer.areaName)]);
    const response = await createSearchRoutesHandler(deps)(post({ origin, destination: selected, locale: 'fr' }));
    const result = await response.json() as { routes?: JourneyOption[] };

    expect(response.status).toBe(200);
    expect(deps.searchRoutes).toHaveBeenCalledWith(expect.objectContaining({
      destination: expect.objectContaining({
        id: 'longitude-nearer',
        displayName: 'Marché recherché',
        coordinates: geocodedCoordinates,
        source: 'geocoder',
      }),
    }));
    expect(result.routes?.[0].searchedDestination.displayName).toBe('Marché recherché');
    expect(result.routes?.[0].searchedDestination.coordinates).toEqual(geocodedCoordinates);
    expect(result.routes?.[0].servedAreaName).toBe(longitudeNearer.areaName);
    expect(deps.resolvePlaces).not.toHaveBeenCalledWith('Marché recherché', 'fr', expect.anything());
  });

  it('includes a representable served point just below 1,200 metres and breaks equal-distance ties by smallest id', async () => {
    const selected = geocoderPlace(geocodedCoordinates);
    const withinLimitCoordinates = pointNorth(geocodedCoordinates, 1199.9999999);
    const withinLimitDistance = distanceMeters(geocodedCoordinates, withinLimitCoordinates);
    const withinLimitPlace = publishedPlace('z-place', withinLimitCoordinates);
    const tiedPlace = publishedPlace('a-place', {
      lat: withinLimitPlace.coordinates.lat,
      lon: withinLimitPlace.coordinates.lon,
    });
    const deps = dependencies(snapshotFor([withinLimitPlace, tiedPlace]));
    deps.resolvePlaces.mockResolvedValue({ kind: 'matches', places: [withinLimitPlace, tiedPlace] });
    const response = await createSearchRoutesHandler(deps)(post({ origin, destination: selected, locale: 'fr' }));

    expect(withinLimitDistance).toBeLessThanOrEqual(1200);
    expect(response.status).toBe(200);
    expect(deps.searchRoutes).toHaveBeenCalledWith(expect.objectContaining({
      destination: expect.objectContaining({ id: 'a-place' }),
    }));
  });

  it('rejects a point just over 1,200 metres even when it is within the floating-point epsilon', async () => {
    const selected = geocoderPlace(geocodedCoordinates);
    const justOutside = pointNorth(geocodedCoordinates, 1200 + 1e-9);
    const actualDistance = distanceMeters(geocodedCoordinates, justOutside);
    const deps = dependencies(snapshotFor([publishedPlace('just-outside', justOutside)]));
    deps.resolvePlaces.mockResolvedValue({
      kind: 'matches',
      places: [publishedPlace('just-outside', justOutside)],
    });

    expect(actualDistance).toBeGreaterThan(1200);
    expect(actualDistance).toBeLessThanOrEqual(1200 + Number.EPSILON * 6_371_000 * 8);

    const response = await createSearchRoutesHandler(deps)(post({ origin, destination: selected, locale: 'fr' }));
    const result = await response.json() as { kind?: string };

    expect(result.kind).toBe('no_verified_journey');
    expect(deps.searchRoutes).not.toHaveBeenCalled();
  });

  it('breaks mathematically equidistant point ties by id despite tiny IEEE distance differences', async () => {
    const selected = geocoderPlace(geocodedCoordinates);
    const radiusMeters = 600;
    const latitudeDelta = (radiusMeters / 6_371_000) * (180 / Math.PI);
    const longitudeDelta = 2 * Math.asin(
      Math.sin((latitudeDelta * Math.PI / 180) / 2) /
        Math.cos(geocodedCoordinates.lat * Math.PI / 180),
    ) * (180 / Math.PI);
    const northernPoint = {
      lat: geocodedCoordinates.lat + latitudeDelta,
      lon: geocodedCoordinates.lon,
    };
    const easternPoint = {
      lat: geocodedCoordinates.lat,
      lon: geocodedCoordinates.lon + longitudeDelta,
    };
    const northernDistance = distanceMeters(geocodedCoordinates, northernPoint);
    const easternDistance = distanceMeters(geocodedCoordinates, easternPoint);
    const lexicallyFirst = publishedPlace('a-place', easternPoint);
    const lexicallySecond = publishedPlace('z-place', northernPoint);
    const deps = dependencies(snapshotFor([lexicallySecond, lexicallyFirst]));
    deps.resolvePlaces.mockResolvedValue({ kind: 'matches', places: [lexicallySecond, lexicallyFirst] });

    expect(Math.abs(northernDistance - easternDistance)).toBeLessThan(1e-8);
    expect(northernDistance).not.toBe(easternDistance);

    await createSearchRoutesHandler(deps)(post({ origin, destination: selected, locale: 'fr' }));

    expect(deps.searchRoutes).toHaveBeenCalledWith(expect.objectContaining({
      destination: expect.objectContaining({ id: 'a-place' }),
    }));
  });

  it.each([
    ['a 1,500-metre-away place', [publishedPlace('far-place', pointNorth(geocodedCoordinates, 1500))]],
    ['an empty published snapshot', []],
  ])('returns no_verified_journey for %s', async (_name, places) => {
    const selected = geocoderPlace(geocodedCoordinates);
    const deps = dependencies(snapshotFor(places));
    deps.resolvePlaces.mockResolvedValue({ kind: 'matches', places });
    const response = await createSearchRoutesHandler(deps)(post({ origin, destination: selected, locale: 'fr' }));
    const result = await response.json() as { kind?: string };

    expect(response.status).toBe(200);
    expect(result.kind).toBe('no_verified_journey');
    expect(deps.searchRoutes).not.toHaveBeenCalled();
    expect(deps.resolvePlaces).not.toHaveBeenCalled();
  });

  it('normalizes a geocoder label to NFC and trims it while counting 120 Unicode code points', async () => {
    const label = `  Cafe\u0301 ${'😀'.repeat(115)}  `;
    const selected = geocoderPlace(geocodedCoordinates, label);
    const served = publishedPlace('served-label', geocodedCoordinates);
    const deps = dependencies(snapshotFor([served]));
    deps.resolvePlaces.mockResolvedValue({ kind: 'matches', places: [served] });
    deps.searchRoutes.mockImplementation(async ({ destination }) => [journeyFor(destination)]);
    const response = await createSearchRoutesHandler(deps)(post({ origin, destination: selected, locale: 'fr' }));
    const result = await response.json() as { routes?: JourneyOption[] };

    expect(response.status).toBe(200);
    expect(Array.from(result.routes?.[0].searchedDestination.displayName ?? '')).toHaveLength(120);
    expect(result.routes?.[0].searchedDestination.displayName).toBe(`Café ${'😀'.repeat(115)}`);
  });

  it.each([
    ['121 Unicode code points', '😀'.repeat(121)],
    ['an empty label', ''],
    ['a whitespace-only label', '   '],
    ['a newline', 'Marché\nlocal'],
    ['a tab', 'Marché\tlocal'],
    ['a control character', 'Marché\u0007local'],
    ['an invisible format character', 'Marché\u200Blocal'],
  ])('rejects %s with a localized error that does not echo the label', async (_name, label) => {
    for (const locale of ['fr', 'en'] as const) {
      const selected = geocoderPlace(geocodedCoordinates, label);
      const deps = dependencies(snapshotFor([publishedPlace(selected.id, geocodedCoordinates)]));
      deps.resolvePlaces.mockResolvedValue({ kind: 'matches', places: [selected] });
      const response = await createSearchRoutesHandler(deps)(post({ origin, destination: selected, locale }));
      const errorText = await response.text();

      expect(response.status).toBe(400);
      if (label.length > 0) expect(errorText).not.toContain(label);
      expect(errorText).toMatch(locale === 'fr' ? /lieu|nom/i : /place|name/i);
      expect(deps.loadPublishedSnapshot).not.toHaveBeenCalled();
      expect(deps.searchRoutes).not.toHaveBeenCalled();
    }
  });
});
