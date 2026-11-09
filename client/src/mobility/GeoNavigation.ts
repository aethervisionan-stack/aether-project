/**
 * Conversational navigation — Geolocation watch + saved places for Live prompt.
 */

import type { GeoFixPayload, PlacePointPayload } from "../types/mobility";

export type GeoWatchHandler = (fix: GeoFixPayload) => void;

const STORAGE_KEY = "aether.mobility.places";

export class GeoNavigation {
  private watchId: number | null = null;
  private lastFix: GeoFixPayload | null = null;
  private places: PlacePointPayload[] = loadPlaces();
  private onFix: GeoWatchHandler | null = null;

  getLastFix(): GeoFixPayload | null {
    return this.lastFix;
  }

  listPlaces(): PlacePointPayload[] {
    return [...this.places];
  }

  setOnFix(handler: GeoWatchHandler | null): void {
    this.onFix = handler;
  }

  startWatch(): boolean {
    if (!navigator.geolocation) {
      return false;
    }
    if (this.watchId != null) {
      return true;
    }
    this.watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const fix: GeoFixPayload = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy_m: pos.coords.accuracy,
          speed_mps: pos.coords.speed,
          heading_deg: pos.coords.heading,
          at: Date.now() / 1000,
        };
        this.lastFix = fix;
        this.onFix?.(fix);
      },
      () => {
        // Keep last known fix; browser may deny permission.
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 12_000 },
    );
    return true;
  }

  stopWatch(): void {
    if (this.watchId != null && navigator.geolocation) {
      navigator.geolocation.clearWatch(this.watchId);
    }
    this.watchId = null;
  }

  saveCurrentPlace(name: string, kind: PlacePointPayload["kind"] = "saved"): PlacePointPayload | null {
    if (!this.lastFix) {
      return null;
    }
    const place: PlacePointPayload = {
      id: `place_${Date.now().toString(36)}`,
      name: name.trim().slice(0, 80) || "Saved place",
      lat: this.lastFix.lat,
      lon: this.lastFix.lon,
      kind,
      at: Date.now() / 1000,
    };
    this.places = [...this.places.filter((p) => p.id !== place.id), place].slice(-24);
    savePlaces(this.places);
    return place;
  }

  nearby(limit = 3, radiusM = 5_000): Array<PlacePointPayload & { distance_m: number }> {
    if (!this.lastFix) {
      return [];
    }
    const fix = this.lastFix;
    return this.places
      .map((p) => ({ ...p, distance_m: Math.round(haversineM(fix, p)) }))
      .filter((p) => p.distance_m <= radiusM)
      .sort((a, b) => a.distance_m - b.distance_m)
      .slice(0, limit);
  }
}

function haversineM(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const r = 6_371_000;
  const lat1 = (a.lat * Math.PI) / 180;
  const lon1 = (a.lon * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const lon2 = (b.lon * Math.PI) / 180;
  const dlat = lat2 - lat1;
  const dlon = lon2 - lon1;
  const h =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dlon / 2) ** 2;
  return 2 * r * Math.asin(Math.min(1, Math.sqrt(h)));
}

function loadPlaces(): PlacePointPayload[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isPlace).slice(-24);
  } catch {
    return [];
  }
}

function savePlaces(places: PlacePointPayload[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(places));
  } catch {
    // ignore quota
  }
}

function isPlace(value: unknown): value is PlacePointPayload {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.name === "string" &&
    typeof v.lat === "number" &&
    typeof v.lon === "number"
  );
}
