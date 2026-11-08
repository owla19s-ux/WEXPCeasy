export type ModelReference = { connectionId: string; modelId: string };
export type VerifyModel = (request: object, reference: Readonly<ModelReference>) => boolean;
export type Configuration =
  | { kind: 'role'; name: string; prompt: string }
  | { kind: 'position'; name: string; responsibility: string }
  | { kind: 'agent'; name: string; roleId: string; positionId: string; model: ModelReference };
export type Entry = Configuration & { id: string; revision: number };
export type Receipt = { intent: string; command: string; entry: Entry };
export type State = { version: 1; entries: Entry[]; receipts: Receipt[] };
export type ConfigAccess = {
  action: 'read' | 'write' | 'list'; kind: Configuration['kind']; id: string;
};
