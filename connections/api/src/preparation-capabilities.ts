import type {ModelObservation} from './model.js';
import {fail} from './model.js';

/**
 * Current generation interface accepts text-only messages and produces text.
 * Optional directional evidence must never be mistaken for implicit support.
 * Legacy observations without directional evidence retain their verified
 * text capability until a normalized multimodal request is implemented.
 */
export function requireTextGenerationCapabilities(
 observed:Pick<ModelObservation,'capabilities'|'modalities'>,
 stream:boolean
):void {
 if(observed.capabilities.text!=='supported'||
    (stream&&observed.capabilities.stream!=='supported'))
  fail('capability_unsupported_or_unknown');
 const text=observed.modalities?.text;
 if(text&&(text.input!==undefined&&text.input!=='supported'||
           text.output!==undefined&&text.output!=='supported'))
  fail('capability_unsupported_or_unknown');
}
