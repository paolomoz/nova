export interface AITool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface AIToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface AIToolResult {
  toolCallId: string;
  content: string;
  isError?: boolean;
}

export interface AIExecuteRequest {
  prompt: string;
  projectId: string;
  context?: AIContext;
}

export interface AIExecuteResponse {
  id: string;
  result: string;
  toolCalls?: AIToolCall[];
  actions?: ActionRecord[];
}

export interface AIContext {
  recentActions?: ActionRecord[];
  currentPath?: string;
  selectedContent?: string;
}

export interface ActionRecord {
  id: string;
  userId: string;
  projectId: string;
  actionType: string;
  description?: string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  status: 'pending' | 'completed' | 'failed';
  createdAt: string;
}

export interface AIStreamEvent {
  event: 'thinking' | 'tool_call' | 'tool_result' | 'text' | 'done' | 'error';
  data: Record<string, unknown>;
}
