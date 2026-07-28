# pdf-render

LaTeX/Tectonic-based PDF render service for ENAMED exam simulados. A plain
Node.js `http` server (no framework) that receives a JSON exam payload,
fetches/normalizes question images, fills the `templates/*.tex` LaTeX
templates, compiles the result with [Tectonic](https://tectonic-typesetting.github.io/),
and returns the resulting PDF bytes.

## Running locally (without Docker)

Requires Node.js >= 20 and a `tectonic` binary on `PATH` (or point
`compile.ts`'s subprocess call at one — see `src/compile.ts`). Fonts are
expected under `/opt/fonts/...` in production (see `templates/preamble.tex`);
`src/server.test.ts` shows how tests substitute a local fonts directory
instead — there is no supported "run the real templates locally without
`/opt/fonts`" mode outside Docker.

```bash
npm install
npm run build      # tsc: src/ -> dist/
node dist/server.js
```

The server listens on `PORT` (default `8080`) and requires
`PDF_RENDER_SERVICE_SECRET` to be set for `POST /render` to authenticate
(see `src/auth.ts`); export it before starting the server:

```bash
export PDF_RENDER_SERVICE_SECRET=some-secret
node dist/server.js
```

## Running tests

```bash
npm install
npm test        # vitest run
```

## Building the Docker image

The Tectonic binary this image pins is only published for
`x86_64-unknown-linux-gnu` — there is no `linux/arm64` Tectonic 0.17.0
release. Because of that, this image must always be built and run for
`linux/amd64`, **even on Apple Silicon (arm64) hosts**.

On Apple Silicon (Colima/Docker Desktop with QEMU emulation), plain
`docker build --platform linux/amd64 ...` was found to silently produce an
image with the **wrong** architecture — a real bug encountered during this
migration. Always use `docker buildx` with a builder that actually supports
cross-platform emulation (this repo uses a `docker-container` driver
builder named `multiarch`):

```bash
# One-time (if the builder doesn't already exist):
docker buildx create --name multiarch --driver docker-container --use

cd services/pdf-render
docker buildx build --builder multiarch --platform linux/amd64 --load -t pdf-render .
```

`--load` is required to make the resulting image available to the local
`docker` CLI (e.g. for `docker run`) — without it, buildx only keeps the
image in its own build cache.

The build has two stages:
- `build`: installs full `devDependencies` and compiles TypeScript
  (`npm run build`, i.e. `tsc`) to produce `dist/`. It also generates
  `priming-exam.tex` (via `scripts/generate-priming-fixture.mjs`), by
  running the real `renderExamTex()` code path against the real
  `test/fixtures/sample-payload.json` — a full, self-contained exam
  document (cover page, header bar, `tikz`/`eso-pic`/math-mode content and
  all), not a simplified stand-in.
- `runtime`: the Tectonic + vendored-fonts + cached-LaTeX-packages image,
  plus the compiled app. Installs **production-only** dependencies
  (`npm ci --omit=dev`) freshly *inside* the container for this stage's
  actual target platform — `sharp` ships a platform-specific native binary,
  so its `node_modules` is never copied in from the host or from the
  `build` stage; only `dist/`, `package.json`/`package-lock.json`, and
  `templates/` cross the stage boundary. The Tectonic package-cache priming
  step compiles **both** `test/fixtures/minimal.tex` (a minimal fixture) and
  `priming-exam.tex` (the real-template fixture from `build`), so every
  LaTeX package/font a genuine `/render` request needs — including
  `eso-pic` and the default Computer Modern math fonts `tikz`/`pgf` pull in
  — is cached at build time. A final smoke-test recompiles both fixtures
  again with Tectonic *after* every Node-related layer, confirming the app
  image didn't disturb the Tectonic/fonts/packages setup.

**No network at runtime, verified**: because the cache is fully populated
by both fixtures at build time, the resulting container needs zero network
access to serve `/render` — confirmed by running the image with `docker run
--network none ...` and a real `POST /render` (see below). If you ever add
a new LaTeX package/font/glyph construct to `templates/*.tex`, make sure
`test/fixtures/sample-payload.json` (or `minimal.tex`) actually exercises
it, otherwise the build-time priming step won't cache it and a real request
would need network access on first use.

## Running the container locally

```bash
docker run --rm --platform linux/amd64 -p 8080:8080 \
  -e PDF_RENDER_SERVICE_SECRET=<value> \
  pdf-render
```

Then, from another terminal:

```bash
curl -s localhost:8080/healthz
# ok

curl -s -X POST localhost:8080/render \
  -H "x-internal-secret: <value>" \
  -H "Content-Type: application/json" \
  -d @test/fixtures/sample-payload.json \
  -o /tmp/render-test.pdf
file /tmp/render-test.pdf
# /tmp/render-test.pdf: PDF document, ...
```

### Verifying no network access is needed at runtime

`--network none` removes port publishing along with everything else, so
reach the server via `docker exec` (loopback still works) instead of `-p`:

```bash
docker run --rm --network none --platform linux/amd64 \
  -e PDF_RENDER_SERVICE_SECRET=<value> -d --name pdf-render-netcheck pdf-render
docker cp test/fixtures/sample-payload.json pdf-render-netcheck:/tmp/sample-payload.json

docker exec pdf-render-netcheck curl -s localhost:8080/healthz
# ok

docker exec pdf-render-netcheck curl -s -X POST localhost:8080/render \
  -H "x-internal-secret: <value>" -H "Content-Type: application/json" \
  -d @/tmp/sample-payload.json -o /tmp/netcheck.pdf -w "%{http_code}\n"
# 200

docker cp pdf-render-netcheck:/tmp/netcheck.pdf /tmp/netcheck.pdf
file /tmp/netcheck.pdf
# /tmp/netcheck.pdf: PDF document, ...

docker stop pdf-render-netcheck
```

## Endpoints

- `GET /healthz` — liveness check, always `200 ok`.
- `POST /render` — requires header `x-internal-secret: <PDF_RENDER_SERVICE_SECRET>`.
  Body: exam JSON payload (see `test/fixtures/sample-payload.json` for shape).
  Response: `200` with `Content-Type: application/pdf` and the rendered PDF
  bytes, or a JSON error body (`{ error, stage }`) with an appropriate
  4xx/5xx status on failure — see `src/errors.ts` for the stage taxonomy.
