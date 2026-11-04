import { describe, expect, it, vi } from 'vitest';
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { invalidateAdminExamQueries, invalidateExamQueries, invalidateQuestionBankQueries } from './exam-query-cache';

describe('exam query invalidation', () => {
  it('authorship only marks bank queries stale, preserving unrelated admin scopes', () => {
    const client = new QueryClient(); const fetch = vi.fn();
    const keys = [['question-bank','staff','',0],['question-bank-versions','staff','bank'],['question-bank-item-analysis','staff','bank',null]];
    keys.forEach(key => client.setQueryData(key,{})); client.setQueryData(['admin','users'],{});
    const observer = new QueryObserver(client,{queryKey:keys[0],queryFn:fetch,staleTime:Infinity}); const stop=observer.subscribe(()=>{});
    invalidateQuestionBankQueries(client);
    keys.forEach(key=>expect(client.getQueryState(key)?.isInvalidated).toBe(true));
    expect(client.getQueryState(['admin','users'])?.isInvalidated).toBe(false); expect(fetch).not.toHaveBeenCalled(); stop(); client.clear();
  });
  it('marks only relevant user scopes stale and never starts remote fetches', () => {
    const client = new QueryClient();
    const relevant = [['user-performance', 'u1', 'e'], ['ranking', 'u1', 'e', 's'],
      ['ranking-simulados', 'u1', 'e'], ['comparative', 'u1', 'e', false],
      ['exam-result', 'u1', 'slug'], ['exam-result-details', 'u1', 's', 'a'],
      ['simulados', 'u1', true], ['simulado', 's', 'u1', true, false],
      ['simulado', 'slug', 'u1', true, false], ['my-percentile-history', 'u1'],
      ['edition-ranking', 'u1', 'e', 0], ['question-bank-item-analysis', 'u1', 'bank', 'e']];
    const untouched = [['user-performance', 'u2', 'e'], ['ranking', 'u2', 'e', 's'],
      ['simulados', 'u2', true], ['simulado', 's', 'u2', true], ['simulado', 'other', 'u1'],
      ['admin', 'user-attempts', 'u1'], ['app-config', 'u1', 'editions_ui'],
      ['my-percentile-history', 'u2'], ['edition-ranking', 'u2', 'e', 0], ['question-bank-item-analysis', 'u2', 'bank', 'e']];
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
  it('admin mutations invalidate affected users globally without initiating student fetches', () => {
    const client = new QueryClient();
    const relevant = [['my-percentile-history', 'student'], ['edition-ranking', 'other', 'e', 50],
      ['question-bank-item-analysis', 'staff', 'bank', null], ['notebook-page', 'student', 'e'],
      ['ranking', 'other', 'e'], ['admin', 'simulado-detail-stats', 'sim']];
    const untouched = [['app-config', 'staff', 'editions_ui'], ['admin', 'access'], ['question-bank-versions', 'staff', 'bank']];
    [...relevant,...untouched].forEach(key => client.setQueryData(key, {}));
    const fetch = vi.fn().mockResolvedValue({});
    const observer = new QueryObserver(client, { queryKey: relevant[0], queryFn: fetch, staleTime: Infinity });
    const unsubscribe = observer.subscribe(() => {});
    invalidateAdminExamQueries(client);
    relevant.forEach(key => expect(client.getQueryState(key)?.isInvalidated, JSON.stringify(key)).toBe(true));
    untouched.forEach(key => expect(client.getQueryState(key)?.isInvalidated, JSON.stringify(key)).toBe(false));
    expect(fetch).not.toHaveBeenCalled(); unsubscribe(); client.clear();
  });
});
