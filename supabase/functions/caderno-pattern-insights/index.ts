import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { createPatternHandler } from './handler.ts';
import type { PatternClient } from './scope.ts';

Deno.serve(createPatternHandler({
  env: key => Deno.env.get(key),
  createClient: (url, key, options): PatternClient =>
    createClient(url, key, options) as unknown as PatternClient,
}));
