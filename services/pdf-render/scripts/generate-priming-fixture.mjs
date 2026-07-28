#!/usr/bin/env node
/**
 * Docker build-time tool (Task 13 fix — "no network at runtime" gap).
 *
 * Generates a fully self-contained `.tex` fixture by running the REAL
 * production template-rendering code path (`renderExamTex`, from the
 * compiled `dist/renderTemplate.js`) against the REAL `sample-payload.json`
 * fixture, so the Dockerfile's Tectonic package-cache priming step can warm
 * the cache with EXACTLY the LaTeX packages/fonts the real render pipeline
 * needs — not just whatever `test/fixtures/minimal.tex` (a deliberately
 * minimal Task 2 fixture) happens to need.
 *
 * Background: priming with only `minimal.tex` left `eso-pic` (loaded
 * unconditionally by `templates/exam.tex` for the full-bleed header bar)
 * and several default Computer Modern math fonts (pulled in by tikz/pgf
 * internals and `cover.tex`'s `$\cdot$` math-mode bullets) uncached, so a
 * real `POST /render` request needed network access at request time to
 * download them on first use — defeating the "no network at runtime"
 * reliability goal the whole build-time-priming design exists for.
 *
 * `renderExamTex()` inlines `preamble.tex` and `cover.tex` verbatim into
 * the returned string in place of exam.tex's `\input{preamble}` /
 * `\input{cover}` lines (see renderTemplate.ts), so the file this script
 * writes is a single, self-contained `.tex` document — it does not need
 * `templates/` to be present alongside it when Tectonic compiles it later.
 *
 * Run only inside the Dockerfile's `build` stage, after `npm run build` has
 * produced `dist/`. Not part of the app's runtime or test surface — it is
 * never imported by `src/` and has no test of its own; its only job is to
 * produce `priming-exam.tex` for the Dockerfile to feed to `tectonic`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { renderExamTex } from '../dist/renderTemplate.js';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(scriptDir, '..');

const samplePayloadPath = path.join(projectRoot, 'test/fixtures/sample-payload.json');
const payload = JSON.parse(readFileSync(samplePayloadPath, 'utf8'));

// Map the HTTP request-body shape (`image_url`) to renderExamTex's
// `RenderInput` shape (`localImagePath`, already resolved by fetchImages.ts
// in the real pipeline). `sample-payload.json` has `image_url: null` for
// every question, so `localImagePath: null` is an exact match here — this
// fixture is not meant to exercise the image/`graphicx` path, only the
// cover/header/eso-pic/tikz/math-mode packages every render hits
// regardless of whether any question has an image.
const input = {
  simulado: payload.simulado,
  questions: payload.questions.map((q) => ({
    number: q.number,
    text: q.text,
    localImagePath: null,
    options: q.options,
  })),
};

const templatesDir = path.join(projectRoot, 'templates');
const tex = renderExamTex(input, templatesDir);

const outPath = path.join(projectRoot, 'priming-exam.tex');
writeFileSync(outPath, tex, 'utf8');
console.log(`[generate-priming-fixture] wrote ${outPath} (${tex.length} bytes) from sample-payload.json via renderExamTex`);
