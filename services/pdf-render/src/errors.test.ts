import { describe, expect, it } from 'vitest';
import { RenderStageError } from './errors.js';

describe('RenderStageError', () => {
  it('defaults httpStatus to 500 when not provided', () => {
    const err = new RenderStageError('compile', 'boom');
    expect(err.httpStatus).toBe(500);
  });

  it('uses the provided httpStatus when given', () => {
    const err = new RenderStageError('fetch_images', 'upstream image host unreachable', {
      httpStatus: 502,
    });
    expect(err.httpStatus).toBe(502);
  });

  it('sets name, message, and stage', () => {
    const err = new RenderStageError('escape', 'bad input');
    expect(err.name).toBe('RenderStageError');
    expect(err.message).toBe('bad input');
    expect(err.stage).toBe('escape');
    expect(err).toBeInstanceOf(Error);
  });

  it('accepts every stage in the RenderStage union', () => {
    for (const stage of ['fetch_images', 'escape', 'compile', 'unknown'] as const) {
      expect(new RenderStageError(stage, 'x').stage).toBe(stage);
    }
  });

  it('carries subprocess metadata fields when provided (compile.ts use case)', () => {
    const err = new RenderStageError('compile', 'tectonic timed out', {
      pid: 1234,
      timedOut: true,
      signal: 'SIGKILL',
    });
    expect(err.pid).toBe(1234);
    expect(err.timedOut).toBe(true);
    expect(err.signal).toBe('SIGKILL');
    expect(err.exitCode).toBeUndefined();
    // httpStatus still defaults even when other options are set.
    expect(err.httpStatus).toBe(500);
  });

  it('propagates `cause` when provided', () => {
    const cause = new Error('underlying spawn error');
    const err = new RenderStageError('compile', 'tectonic failed to start', { cause });
    expect(err.cause).toBe(cause);
  });

  it('leaves cause undefined when not provided', () => {
    const err = new RenderStageError('unknown', 'x');
    expect(err.cause).toBeUndefined();
  });
});
