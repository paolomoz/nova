import type { ModelPreset, ModelRole, ModelConfig } from '@nova/shared-types';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ModelResponse {
  content: string;
  usage?: { inputTokens: number; outputTokens: number };
}

const MODEL_PRESETS: Record<string, ModelPreset> = {
  production: {
    reasoning: {
      provider: 'anthropic',
      model: 'claude-opus-4-6',
      maxTokens: 4096,
      temperature: 0.7,
    },
    content: {
      provider: 'cerebras',
      model: 'gpt-oss-120b',
      maxTokens: 4096,
      temperature: 0.8,
    },
    classification: {
      provider: 'cerebras',
      model: 'llama-3.1-8b',
      maxTokens: 500,
      temperature: 0.3,
    },
  },
  fast: {
    reasoning: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-5-20250929',
      maxTokens: 4096,
      temperature: 0.5,
    },
    content: {
      provider: 'cerebras',
      model: 'llama-3.3-70b',
      maxTokens: 4096,
      temperature: 0.8,
    },
    classification: {
      provider: 'cerebras',
      model: 'llama-3.1-8b',
      maxTokens: 200,
      temperature: 0.3,
    },
  },
};

export class ModelFactory {
  private preset: ModelPreset;

  constructor(presetName: string = 'production') {
    this.preset = MODEL_PRESETS[presetName] || MODEL_PRESETS.production;
  }

  async call(
    role: ModelRole,
    messages: Message[],
    env: { ANTHROPIC_API_KEY?: string; CEREBRAS_API_KEY?: string },
  ): Promise<ModelResponse> {
    const config = this.preset[role];
    switch (config.provider) {
      case 'anthropic':
        return this.callAnthropic(config, messages, env.ANTHROPIC_API_KEY || '');
      case 'cerebras':
        return this.callCerebras(config, messages, env.CEREBRAS_API_KEY || '');
      default:
        throw new Error(`Unknown provider: ${config.provider}`);
    }
  }

  private async callAnthropic(
    config: ModelConfig,
    messages: Message[],
    apiKey: string,
  ): Promise<ModelResponse> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        messages: messages.filter((m) => m.role !== 'system'),
        system: messages.find((m) => m.role === 'system')?.content,
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status}`);
    }

    const data = (await response.json()) as {
      content: Array<{ text: string }>;
      usage: { input_tokens: number; output_tokens: number };
    };

    return {
      content: data.content[0]?.text || '',
      usage: {
        inputTokens: data.usage.input_tokens,
        outputTokens: data.usage.output_tokens,
      },
    };
  }

  private async callCerebras(
    config: ModelConfig,
    messages: Message[],
    apiKey: string,
  ): Promise<ModelResponse> {
    const response = await fetch('https://api.cerebras.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        messages,
      }),
    });

    if (!response.ok) {
      throw new Error(`Cerebras API error: ${response.status}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
      usage?: { prompt_tokens: number; completion_tokens: number };
    };

    return {
      content: data.choices[0]?.message?.content || '',
      usage: data.usage
        ? { inputTokens: data.usage.prompt_tokens, outputTokens: data.usage.completion_tokens }
        : undefined,
    };
  }
}
