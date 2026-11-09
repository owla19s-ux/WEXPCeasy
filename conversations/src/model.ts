export type FileReference = {kind:'local-reference';contextId:string;addressId:string;version:string;mime:'text/plain'};
export type Segment = { id: string; text: string; source?:FileReference };
export type Message = { id: string; role: 'user' | 'assistant'; segments: Segment[]; replaces?: string };
export type Generation = {
  id: string; inputMessageId: string; outputMessageId?: string;
  status: 'pending' | 'running' | 'completed' | 'cancelled' | 'failed' | 'unknown';
  operationId?: string;
  requestId?: string;
  replyId?: string;
};
export type Conversation = {
  id: string; revision: number; messages: Message[]; generations: Generation[];
  selections?: { messageId: string; segmentIds: string[] }[];
};
export type ConversationChange =
  | { kind: 'create' }
  | { kind: 'select'; messageId: string; segmentIds: string[] }
  | { kind: 'append'; messageId: string; segments: Segment[] }
  | { kind: 'resend'; messageId: string; replaces: string; segments: Segment[]; generationId: string }
  | { kind: 'begin'; generationId: string; inputMessageId: string }
  | { kind: 'finish'; generationId: string; messageId: string; segments: Segment[] }
  | { kind: 'dispatch'; generationId: string; operationId: string; requestId?: string; replyId?: string }
  | { kind: 'cancel' | 'fail' | 'unknown'; generationId: string };
export type State = { format: 1; conversations: Conversation[]; receipts: Record<string, { fingerprint: string; revision: number }> };

