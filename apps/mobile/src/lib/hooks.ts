import NetInfo from '@react-native-community/netinfo';
import { onlineManager, useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { LocationNode, PublicSettings } from '@dar/shared';
import { get } from './api';

// React Query pauses requests while offline and retries when the connection returns.
onlineManager.setEventListener((setOnline) => NetInfo.addEventListener((s) => setOnline(!!s.isConnected)));

export function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => NetInfo.addEventListener((s) => setOnline(s.isConnected !== false)), []);
  return online;
}

export function useApi<T>(key: unknown[], path: string | null, opts: Partial<UseQueryOptions<T>> = {}) {
  return useQuery<T>({ queryKey: key, queryFn: () => get<T>(path!), enabled: !!path, ...opts } as UseQueryOptions<T>);
}

export function useSettings() {
  return useApi<PublicSettings>(['settings'], '/v1/settings/public', { staleTime: 5 * 60_000 });
}

export function useLocations() {
  return useApi<LocationNode[]>(['locations'], '/v1/locations', { staleTime: 60 * 60_000 });
}
