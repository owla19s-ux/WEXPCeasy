import type { Segment } from './model.js';

export const id = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-zA-Z0-9_-]{1,120}$/.test(value);

export function segments(input: Segment[]): Segment[] {
  if (!Array.isArray(input) || input.length === 0 || input.length > 256) throw Error('invalid_segments');
  const seen = new Set<string>();
  return input.map(segment => {
    if (!id(segment.id) || seen.has(segment.id) || typeof segment.text !== 'string' ||
        segment.text.length === 0 || segment.text.length > 32000) throw Error('invalid_segment');
    seen.add(segment.id);
    return { id: segment.id, text: segment.text };
  });
}

