import { describe, expect, it } from 'vitest';
import { isMissingRpcSignature } from './backend-rpc-availability';

const missing = { code: 'PGRST202', message: 'Could not find the function public.finalize_attempt_with_results(p_auto_submit, p_attempt_id) in the schema cache' };
const args = ['p_attempt_id', 'p_auto_submit'];
describe('strict missing RPC detection', () => {
  it('accepts only the exact function and argument set, regardless of argument order', () => {
    expect(isMissingRpcSignature(missing, 'finalize_attempt_with_results', args, 404)).toBe(true);
    expect(isMissingRpcSignature(missing, 'another_rpc', args)).toBe(false);
    expect(isMissingRpcSignature(missing, 'finalize_attempt_with_results', ['p_attempt_id'])).toBe(false);
  });
  it.each([null, new Error('timeout'), { ...missing, code: '42883' }, { ...missing, code: 'PGRST203' },
    { ...missing, message: 'Not Found' }, { ...missing, status: 403 }, { ...missing, statusCode: 500 },
    { ...missing, message: `wrapper: ${missing.message}` }])('rejects ambiguous or non-schema failures: %j', error => {
    expect(isMissingRpcSignature(error, 'finalize_attempt_with_results', args)).toBe(false);
  });
  it.each([401, 403, 500, 503, 0])('rejects a conflicting HTTP status %s even with a missing-signature body', status => {
    expect(isMissingRpcSignature(missing, 'finalize_attempt_with_results', args, status)).toBe(false);
  });
});
