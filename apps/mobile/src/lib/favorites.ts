import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { del, get, put } from './api';
import { useAuth } from './auth';

/** Favorite IDs with optimistic toggling. Visitors are sent to sign-in. */
export function useFavorites() {
  const { user, requireAuth } = useAuth();
  const qc = useQueryClient();
  const ids = useQuery<string[]>({ queryKey: ['favorite-ids'], queryFn: () => get('/v1/me/favorites/ids'), enabled: !!user });
  const set = new Set(ids.data ?? []);
  const m = useMutation({
    mutationFn: ({ id, on }: { id: string; on: boolean }) => (on ? put(`/v1/me/favorites/${id}`) : del(`/v1/me/favorites/${id}`)),
    onMutate: async ({ id, on }) => {
      await qc.cancelQueries({ queryKey: ['favorite-ids'] });
      const prev = qc.getQueryData<string[]>(['favorite-ids']) ?? [];
      qc.setQueryData(['favorite-ids'], on ? [...prev, id] : prev.filter((x) => x !== id));
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx && qc.setQueryData(['favorite-ids'], ctx.prev),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['favorite-ids'] });
      qc.invalidateQueries({ queryKey: ['favorites'] });
    },
  });
  return {
    isFavorite: (id: string) => set.has(id),
    toggle: (id: string) => {
      if (!requireAuth()) return;
      m.mutate({ id, on: !set.has(id) });
    },
  };
}
