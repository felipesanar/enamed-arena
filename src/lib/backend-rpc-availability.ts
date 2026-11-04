/** Only a schema-cache signature miss proves this RPC was not dispatched. */
export function isMissingRpcSignature(error: unknown, name: string, args: readonly string[], status?: number): boolean {
  if (!error || typeof error !== 'object') return false;
  const failure = error as Record<string, unknown>;
  if (failure.code !== 'PGRST202' || typeof failure.message !== 'string') return false;
  if ([status, failure.status, failure.statusCode].some(value => value !== undefined && value !== 404)) return false;
  const match = /^Could not find the function public\.([a-z_]+)\(([^()]*)\) in the schema cache\.?$/.exec(failure.message);
  if (!match || match[1] !== name) return false;
  const actual = match[2].split(',').map(arg => arg.trim()).sort();
  const expected = [...args].sort();
  return actual.length === expected.length && actual.every((arg, index) => arg === expected[index]);
}
