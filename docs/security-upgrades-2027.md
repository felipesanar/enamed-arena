# Security upgrades 2027: F3-10 brought forward

## Status

The scoped implementation is complete, including official Linux MCP generation
and removal of the eight resolved audit exceptions. Global validation, deployment
and live authorization checks remain separate release requirements. The worker
did not install packages, edit the lockfile, read secrets or deploy; Codex supplied
the isolated installation, generated lockfile and official Linux artifact.

Exact selected versions (official registry metadata supplied by Codex):

| Component | Version |
| --- | --- |
| Node (.nvmrc, package engines, all six CI jobs) | 24.16.0 |
| @lovable.dev/mcp-js | 3.4.0 |
| zod | 4.6.7 |
| @hookform/resolvers | 7.0.2 |
| vite | 7.3.7 |
| @vitejs/plugin-react-swc | 4.3.3 |
| vitest | 5.1.0 |

The existing react-hook-form range (^7.61.1) satisfies the new resolver peer
requirement (^7.55). No unrelated dependencies were upgraded. Existing Vitest
configuration uses no identified removed options; targeted tests passed against
Vitest 5 with env-file loading disabled. Existing MCP tools/auth APIs are present in
the locally supplied official 3.4 declarations. Analytics uses Zod APIs retained
in v4; no speculative source migration was made.

The six CI checks remain: lint, typecheck, unit tests, Edge pins, build, audit.
The unit test job additionally runs the dependency-free security script tests.
The eight original audit exceptions were removed after the supplied post-install
audit and corrected official Edge artifact were reviewed. No deadline was renewed.

## Explicit official generation

Normal `dev`, `build`, and `build:dev` do not load the MCP plugin and do not
rewrite Edge artifacts. Explicit generation is separate:

```sh
npm run generate:mcp -- --project-ref lljnbysgcwvkhlnaqxtt
```

The public project ref must match `supabase/config.toml`. The generator copies
only the MCP source directory and package.json into a temporary project on the
same volume. A child with an allowlisted environment invokes the official
`@lovable.dev/mcp-js/stacks/supabase/vite` plugin using Vite's public
`resolveConfig` API. No application build, Supabase connection, deploy, hand-built
bundle, or real project env loading is involved. Runtime Supabase credentials
are still read only by the authenticated tool handlers, not by code generation.

Two official emissions must match before publication. Validation rejects
machine paths (including Windows drive paths), local node_modules, bare/unmapped
imports, loose external versions, a wrong project issuer, a non-authenticated
audience, or missing official SDK/handler provenance. Import-map values, when
present, must also be pinned and portable. The Edge pin checker additionally
checks multiline imports, dynamic literal imports and deno.json imports/scopes.
These checks validate the known official output format, not arbitrary hostile
JavaScript: they do not replace code review or authorization tests.

The checked-in source retains the direct Supabase issuer, audience
`authenticated`, authenticated-only read tools, the caller bearer token (RLS),
and PRO notebook access. Phase B added an explicit caller-profile PRO check
before reading entries, in addition to database authorization. No service-role key,
SQL/RLS policy, edition logic or UI was changed. Live PRO/RLS enforcement is not
verified here and remains a required release review, not an inferred guarantee.

### Official package discrepancy and Windows

The supplied 3.4.0 `vite.d.ts` mentions index.ts plus deno.json. The actual supplied
`vite.js` says no import map is emitted and emits direct npm: imports instead,
cleaning legacy generated maps. The wrapper accepts the official file set
(index.ts and optional deno.json); it never invents a map to match stale docs.

The supplied implementation also resolves its wrapper import to an absolute
entry path but only excludes dot-prefixed or slash-prefixed paths from bare npm
externalization. A Windows drive-letter path may still be misclassified. This
was confirmed by actual 3.4 Windows generation: validation failed and preserved
canonical files. Official generation subsequently succeeded on Linux.
Do not patch generated code, copy the main checkout's corrupted bundle, or
pretend regeneration succeeded. Escalate an upstream fix or an explicitly
authorized POSIX generation environment to the orchestrator.

### Failure and recovery

Generation and validation failures occur before canonical replacement. Publishing
uses an exclusive lock, moves the old directory into the lock as `previous`,
then moves the validated directory into place. A publication error triggers
rollback. The two directory renames are not one crash-atomic transaction: a
process/OS interruption between them can leave the canonical directory absent.
The backup and lock survive failed rollback or interruption. Never blindly
remove a non-empty `supabase/functions/.mcp-generation-lock`; inspect and restore
`previous` under human review before retrying. The lock blocks concurrent runs.
An interrupted run may also leave a `.mcp-generation-*` temporary directory;
inspect it before cleanup. Unknown canonical files block replacement.

## Verification and release handoff

Dependency-free tests were added first and observed failing before implementation.
Run only these scope tests during this worker job:

```sh
node --test scripts/check-edge-function-pins.test.mjs scripts/generate-mcp.test.mjs
node scripts/check-edge-function-pins.mjs
node node_modules/vitest/vitest.mjs run src/lib/mcp/security.test.ts src/lib/analytics.test.ts
```

The Node tests use clearly labelled validator fixtures and injected emitters.
They prove validation and filesystem safety behavior; an additional regression
test validates the actual checked-in official Linux artifact and its authorization
boundaries. Pin checking alone does not prove that advisories are fixed.

Codex/orchestrator must run global typecheck/build/full tests and the six CI
checks after reviewing the scope tests. Live signed-token/JWKS, RLS and PRO
checks require separately authorized Supabase access before release. Future
regeneration must use the official plugin in Linux until the Windows defect is
fixed; do not patch generated output or bypass validation.

Deployment and live Supabase checks are outside this job and require separate
authorization. A Node dependency audit alone does not update a deployed Edge
Function or prove its runtime dependency graph is safe.

## Phase B evidence (2026-11-04)

Codex supplied an isolated, script-free dependency installation and the generated
lockfile. This worker did not edit package-lock.json or shared dependencies.
The actual installed packages report mcp-js 3.4.0 and MCP SDK 1.32.2. The targeted
tests ran successfully with Vitest 5.1.0 and Zod 4.6.7.

The supplied local `.superpowers/upgrade-deps/audit.json` has audit format 2 and
reports high=0, critical=0, moderate=25, low=1. Its advisory entries contain none
of the eight original exception IDs. This is evidence for the installed Node
graph only. Following official Linux generation and artifact review, all eight
exceptions were removed. The 25 moderate and one low findings remain outside
this upgrade's high/critical exception scope; the audit is not vulnerability-free.

### Additional safety changes

Every rename and recursive removal in generate-mcp.mjs now goes through explicit
resolved-path checks. They reject the root itself (including Windows casing
aliases), lexical traversal, symlink/junction ancestors and linked descendants,
and require every existing realpath to remain inside the physical intended root.
Source, stage, output, canonical, lock and backup paths are checked. Tests create
real Windows junctions to an outside sentinel directory and confirm rejection.
This is fail-closed path validation with an exclusive writer lock, not protection
against an adversary replacing filesystem entries between validation and use.

MCP sources now refuse client creation for an unauthenticated/missing-bearer
caller and check the caller's own profile segment before notebook access. The
same public-key client and caller bearer are used for profile and entry reads;
there is no service-role access. Profile errors and non-PRO profiles deny access.
OAuth explicitly disables the SDK's resource-claim audience fallback, requiring
the configured authenticated audience. Vitest env-file loading is disabled;
tests provide fake environment values explicitly and block global fetch.

The real SDK's ToolContext, defineTool definitions and Supabase handler are used
in the compatibility tests. An anonymous HTTP request receives 401 without
network or DB access. Supabase calls are mocked to verify bearer forwarding,
read-only operations, caller filters, PRO gating, caps and notebook filters.
These are not live RLS-policy or signed-token/JWKS integration tests; those remain
outside this no-network, no-Supabase job.

### Windows failure and Linux resolution

The actual installed official plugin was invoked with:

```sh
node scripts/generate-mcp.mjs --project-ref lljnbysgcwvkhlnaqxtt
```

It emitted a machine-specific import of this shape:

```text
npm:C:\\Users\\...\\.mcp-generation-<temporary-id>\\src\\lib\\mcp\\index.ts
```

The validator rejected it with `Machine path in MCP artifact` before canonical
replacement. A second diagnostic run confirmed the exact offending import.
At that point the canonical Edge bundle remained at mcp-js 0.20.0 / Zod 3.25.76.
Temporary output
was removed only after the path checks. No hand-built bundle or main-checkout
artifact was substituted.

Codex subsequently ran the identical explicit generator in the existing WSL
Ubuntu 24.04 environment using official SHA-verified portable Node 24.16.0,
the same lockfile and script-free npm installation in an isolated minimal
project without env files. Two official emissions matched and passed validation;
the supplied log ends with `Official MCP artifacts generated, validated twice
and published. No deploy performed.` The validated artifact was copied back
with matching hashes, not rewritten by hand.

The checked-in bundle now imports mcp-js 3.4.0, Zod 4.6.7 and Supabase 2.99.2.
Review confirmed the direct project issuer, authenticated audience, disabled
resource-claim fallback, caller bearer forwarding, five read-only tools and
fail-closed PRO notebook gate. The official plugin emitted only index.ts; no
deno.json was invented. This resolves the local generation blocker, not the
upstream Windows defect or the separately required production deployment.

### Latest scope checks

```sh
node node_modules/vitest/vitest.mjs run src/lib/mcp/security.test.ts src/lib/analytics.test.ts
# 17 passed, 0 failed
node --test scripts/check-edge-function-pins.test.mjs scripts/generate-mcp.test.mjs
# 12 passed, 0 failed
node scripts/check-edge-function-pins.mjs
# 43 files checked, 0 unpinned imports; pin checking alone is not proof of upgrade.
```

Targeted ESLint over the five changed TypeScript files also completed with no
errors or warnings. The worker did not run global lint/typecheck/build/test jobs.

The new behavior was tested red before implementation, including the Windows
root casing alias, missing authentication, non-PRO/profile-error denial, and
strict audience fallback configuration. Global suite, typecheck and builds
remain the orchestrator's responsibility. Scoped implementation is complete;
production runtime security is not claimed without deployment and live checks.
