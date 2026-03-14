"use client";

import { useState, useEffect, useCallback, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface ElasticHit {
  upload_id: string;
  user_id: string;
  title: string;
  description: string | null;
  geo: { lat: number; lon: number } | null;
  location_name: string | null;
  dominant_class: string | null;
  tags: string[];
  likes: number;
  listen_count: number;
  biodiversity_score: number | null;
  duration_seconds: number | null;
  timestamp: number;
}

export interface ElasticSearchResult {
  hits: ElasticHit[];
  total: number;
}

export type SoundType =
  | "birds"
  | "traffic"
  | "music"
  | "rain"
  | "construction"
  | "insects"
  | "silence";

export const VALID_SOUND_TYPES = new Set<string>([
  "birds",
  "traffic",
  "music",
  "rain",
  "construction",
  "insects",
  "silence",
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function formatAgo(ms: number): string {
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function formatDuration(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function parseDuration(str: string): number {
  const [m, s] = str.split(":").map(Number);
  return (m || 0) * 60 + (s || 0);
}

// ─── Map endpoint hook ────────────────────────────────────────────────────────
export function useElasticMapSearch(bounds: {
  north: number;
  south: number;
  east: number;
  west: number;
} | null, options: { 
  autoRefresh?: boolean; 
  refreshInterval?: number;
  limit?: number;
} = {}) {
  const { autoRefresh = true, refreshInterval = 30_000, limit = 200 } = options;
  
  const [data, setData] = useState<ElasticSearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchSearch = useCallback(async (force = false) => {
    if (!bounds) return;
    
    if (force) setIsLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        top_left_lat: bounds.north.toString(),
        top_left_lon: bounds.west.toString(),
        bottom_right_lat: bounds.south.toString(),
        bottom_right_lon: bounds.east.toString(),
        limit: limit.toString(),
      });

      const response = await fetch(`/api/search/map?${params}`);
      if (!response.ok) throw new Error(`Search failed: ${response.status}`);
      
      const result = await response.json();
      setData(result);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
    } finally {
      setIsLoading(false);
    }
  }, [bounds, limit]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh || !bounds) return;
    
    const interval = setInterval(() => {
      fetchSearch(false);
    }, refreshInterval);
    
    return () => clearInterval(interval);
  }, [autoRefresh, bounds, refreshInterval, fetchSearch]);

  // Initial fetch
  useEffect(() => {
    if (bounds) {
      fetchSearch(false);
    }
  }, [bounds, fetchSearch]);

  const forceRefresh = useCallback(() => {
    fetchSearch(true);
  }, [fetchSearch]);

  return {
    data,
    isLoading,
    error,
    lastRefresh,
    forceRefresh,
  };
}

// ─── Nearby endpoint hook ─────────────────────────────────────────────────────
export function useElasticNearbySearch(location: {
  lat: number;
  lon: number;
  radius?: string;
} | null, options: { 
  autoRefresh?: boolean; 
  refreshInterval?: number;
  limit?: number;
} = {}) {
  const { autoRefresh = true, refreshInterval = 30_000, limit = 50 } = options;
  
  const [data, setData] = useState<ElasticSearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchSearch = useCallback(async (force = false) => {
    if (!location) return;
    
    if (force) setIsLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        lat: location.lat.toString(),
        lon: location.lon.toString(),
        radius: location.radius || "5km",
        limit: limit.toString(),
      });

      const response = await fetch(`/api/search/nearby?${params}`);
      if (!response.ok) throw new Error(`Search failed: ${response.status}`);
      
      const result = await response.json();
      setData(result);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
    } finally {
      setIsLoading(false);
    }
  }, [location, limit]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh || !location) return;
    
    const interval = setInterval(() => {
      fetchSearch(false);
    }, refreshInterval);
    
    return () => clearInterval(interval);
  }, [autoRefresh, location, refreshInterval, fetchSearch]);

  // Initial fetch
  useEffect(() => {
    if (location) {
      fetchSearch(false);
    }
  }, [location, fetchSearch]);

  const forceRefresh = useCallback(() => {
    fetchSearch(true);
  }, [fetchSearch]);

  return {
    data,
    isLoading,
    error,
    lastRefresh,
    forceRefresh,
  };
}

// ─── Filter endpoint hook ─────────────────────────────────────────────────────
export function useElasticFilterSearch(filters: {
  category?: string;
  location?: string;
} | null, options: { 
  autoRefresh?: boolean; 
  refreshInterval?: number;
  limit?: number;
} = {}) {
  const { autoRefresh = true, refreshInterval = 30_000, limit = 50 } = options;
  
  const [data, setData] = useState<ElasticSearchResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchSearch = useCallback(async (force = false) => {
    if (force) setIsLoading(true);
    setError(null);
    
    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
      });
      
      if (filters?.category) {
        params.set("category", filters.category);
      }
      if (filters?.location) {
        params.set("location", filters.location);
      }

      const response = await fetch(`/api/search/filter?${params}`);
      if (!response.ok) throw new Error(`Search failed: ${response.status}`);
      
      const result = await response.json();
      setData(result);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Unknown error"));
    } finally {
      setIsLoading(false);
    }
  }, [filters, limit]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      fetchSearch(false);
    }, refreshInterval);
    
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchSearch]);

  // Initial fetch
  useEffect(() => {
    fetchSearch(false);
  }, [fetchSearch]);

  const forceRefresh = useCallback(() => {
    fetchSearch(true);
  }, [fetchSearch]);

  return {
    data,
    isLoading,
    error,
    lastRefresh,
    forceRefresh,
  };
}