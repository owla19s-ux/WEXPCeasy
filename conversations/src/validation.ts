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
    if(segment.source!==undefined){
      const source=segment.source;
      if(!source||Object.getPrototypeOf(source)!==Object.prototype||Object.keys(source).sort().join(',')!=='addressId,contextId,kind,mime,version'||
         source.kind!=='local-reference'||source.mime!=='text/plain'||!id(source.contextId)||!id(source.addressId)||!/^[a-f0-9]{64}$/.test(source.version))throw Error('invalid_file_reference');
      return {id:segment.id,text:segment.text,source:{kind:source.kind,contextId:source.contextId,addressId:source.addressId,version:source.version,mime:source.mime}};
    }
    return { id: segment.id, text: segment.text };
  });
}

