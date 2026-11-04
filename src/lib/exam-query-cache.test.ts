import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { invalidateExamQueries } from './exam-query-cache';

describe('exam query invalidation', () => {
  it('marks only relevant user scopes stale and never starts remote fetches', () => {
    const client = new QueryClient();
    const relevant = [['user-performance', 'u1', 'e'], ['ranking', 'u1', 'e', 's'],
      ['ranking-simulados', 'u1', 'e'], ['comparative', 'u1', 'e', false],
      ['exam-result', 'u1', 'slug'], ['exam-result-details', 'u1', 's', 'a'],
      ['simulados', 'u1', true], ['simulado', 's', 'u1', true, false],
      ['simulado', 'slug', 'u1', true, false]];
    const untouched = [['user-performance', 'u2', 'e'], ['ranking', 'u2', 'e', 's'],
      ['simulados', 'u2', true], ['simulado', 's', 'u2', true], ['simulado', 'other', 'u1'],
      ['admin', 'user-attempts', 'u1'], ['app-config', 'u1', 'editions_ui']];
    [...relevant, ...untouched].forEach(key => client.setQueryData(key, {}));
    const fetch = vi.fn().mockResolvedValue({});
    const observer = new QueryObserver(client, { queryKey: relevant[0], queryFn: fetch, staleTime: Infinity });
    const unsubscribe = observer.subscribe(() => {});
    invalidateExamQueries(client, 'u1', 's', 'slug');
    relevant.forEach(key => expect(client.getQueryState(key)?.isInvalidated, JSON.stringify(key)).toBe(true));
    untouched.forEach(key => expect(client.getQueryState(key)?.isInvalidated, JSON.stringify(key)).toBe(false));
    expect(fetch).not.toHaveBeenCalled();
    unsubscribe(); client.clear();
  });
  it('missing user never invalidates another account', () => {
    const client = new QueryClient(); client.setQueryData(['simulados', 'u2'], {});
    invalidateExamQueries(client, undefined, 's');
    expect(client.getQueryState(['simulados', 'u2'])?.isInvalidated).toBe(false); client.clear();
  });
});
