import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider, QueryObserver } from '@tanstack/react-query';
const api = vi.hoisted(() => ({ updateQuestion: vi.fn(), updateOption: vi.fn(), setCorrectOption: vi.fn(), deleteQuestion: vi.fn() }));
vi.mock('@/admin/services/adminApi', () => ({ adminApi: api }));
vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));
import { useUpdateQuestion, useUpdateOption, useSetCorrectOption, useDeleteQuestion } from './useAdminQuestionEditor';
const cases = [ ['question',useUpdateQuestion,{ id:'q',payload:{ text:'Q',area:'CM',theme:'T',difficulty:'easy',explanation:null,image_url:null,explanation_image_url:null,image_url_2:null } }],
 ['option',useUpdateOption,{optionId:'o',text:'Novo'}], ['key',useSetCorrectOption,{questionId:'q',optionId:'o'}], ['delete',useDeleteQuestion,'q'] ] as const;
beforeEach(()=>{Object.values(api).forEach(mock=>mock.mockReset().mockResolvedValue(undefined));});
describe('question authorship cache updates',()=>{
  it.each(cases)('%s invalidates versioned bank data without fetching it under an author mutation',async(_name,hook,input)=>{
    const client=new QueryClient(); const keys=[['question-bank','staff'],['question-bank-versions','staff','b'],['question-bank-item-analysis','staff','b']];
    keys.forEach(key=>client.setQueryData(key,{})); const fetch=vi.fn().mockResolvedValue({});
    const observer=new QueryObserver(client,{queryKey:keys[0],queryFn:fetch,staleTime:Infinity});const stop=observer.subscribe(()=>{});
    const {result}=renderHook(()=>hook('sim'),{wrapper:({children})=><QueryClientProvider client={client}>{children}</QueryClientProvider>});
    await act(async()=>{await result.current.mutateAsync(input as never);});
    keys.forEach(key=>expect(client.getQueryState(key)?.isInvalidated).toBe(true));expect(fetch).not.toHaveBeenCalled();stop();client.clear();
  });
  it('does not invalidate the bank after a rejected mutation',async()=>{
    api.deleteQuestion.mockRejectedValue(new Error('rejected'));const client=new QueryClient();const key=['question-bank','staff'];client.setQueryData(key,{});
    const {result}=renderHook(()=>useDeleteQuestion('sim'),{wrapper:({children})=><QueryClientProvider client={client}>{children}</QueryClientProvider>});
    await act(async()=>{await expect(result.current.mutateAsync('q')).rejects.toThrow('rejected');});expect(client.getQueryState(key)?.isInvalidated).toBe(false);client.clear();
  });
});
