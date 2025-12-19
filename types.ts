
export interface Document {
  id: string;
  title: string;
  content: string;
  chunks: Chunk[];
  timestamp: number;
}

export interface Chunk {
  id: string;
  docId: string;
  text: string;
  score?: number;
}

export enum AgentActionType {
  ANSWER = 'ANSWER',
  SUMMARIZE = 'SUMMARIZE',
  CATEGORIZE = 'CATEGORIZE',
  REPORT = 'REPORT'
}

export interface AgentAction {
  type: AgentActionType;
  reasoning: string;
  parameters?: any;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  action?: AgentAction;
  sources?: Chunk[];
  timestamp: number;
}
