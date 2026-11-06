import { describe, expect, it } from 'vitest';
import { createProject, fromHex, sanitizeSettings, timecode, toHex } from '../src/model/project';

describe('project model', () => {
  it('creates 1080p30 defaults with linear light off', () => {
    const p = createProject('x', 1);
    expect(p.settings).toMatchObject({ width: 1920, height: 1080, fps: 30, linearLight: false });
    expect(p.id).toHaveLength(12);
  });
  it('clamps settings to supported ranges', () => {
    const s = sanitizeSettings({ ...createProject().settings, width: 99999, height: -5, fps: 500, duration: 0.2 });
    expect(s).toMatchObject({ width: 8192, height: 16, fps: 120, duration: 1 });
  });
  it('falls back to defaults on NaN input', () => {
    const s = sanitizeSettings({ ...createProject().settings, width: NaN, fps: NaN });
    expect(s.width).toBe(1920);
    expect(s.fps).toBe(30);
  });
  it('round-trips hex colours', () => {
    expect(toHex(fromHex('#7c9cff'))).toBe('#7c9cff');
    expect(fromHex('nope')).toEqual([0, 0, 0, 1]);
  });
  it('formats timecode', () => {
    expect(timecode(0, 30)).toBe('00:00:00');
    expect(timecode(95, 30)).toBe('00:03:05');
  });
});
