import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { createHandler } from './handler.ts';
import type { EditionClient } from '../_shared/aiEditionContext.ts';

// Narrow the SDK's recursive query generics at the read-only DI boundary.
Deno.serve(createHandler({ env: key => Deno.env.get(key), createClient: (url, key, options) => createClient(url, key, options) as unknown as EditionClient }));
