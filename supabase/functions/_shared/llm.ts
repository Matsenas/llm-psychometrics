export type LlmProvider = "anthropic" | "openai";

export interface LlmMessage {
  role: string;
  content: string;
}

export interface LlmSettingsOptions {
  models?: Partial<Record<LlmProvider, string>>;
}

export interface LlmSettings {
  provider: LlmProvider;
  model: string;
}

export interface GenerateTextOptions extends LlmSettingsOptions {
  taskName: string;
  system: string;
  messages: LlmMessage[];
  maxTokens: number;
  temperature?: number;
}

export interface GenerateTextResult extends LlmSettings {
  text: string;
}

interface AnthropicResponse {
  content?: Array<{ text?: string }>;
  completion?: string;
  text?: string;
}

interface OpenAIChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>;
    };
  }>;
}

const DEFAULT_MODELS: Record<LlmProvider, string> = {
  anthropic: "claude-3-5-sonnet-20241022",
  openai: "gpt-4o-mini",
};

const LLM_PROVIDER: LlmProvider = "openai";

export function resolveLlmSettings(options: LlmSettingsOptions = {}): LlmSettings {
  const provider = LLM_PROVIDER;
  const model = options.models?.[provider]?.trim()
    || DEFAULT_MODELS[provider];

  return { provider, model };
}

export async function generateText(options: GenerateTextOptions): Promise<GenerateTextResult> {
  const settings = resolveLlmSettings(options);

  if (settings.provider === "anthropic") {
    return {
      ...settings,
      text: await generateAnthropicText(options, settings.model),
    };
  }

  return {
    ...settings,
    text: await generateOpenAIText(options, settings.model),
  };
}

async function generateAnthropicText(options: GenerateTextOptions, model: string): Promise<string> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      system: options.system,
      messages: normalizeAnthropicMessages(options.messages),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${options.taskName} Anthropic API error: ${response.status} ${errorText}`);
  }

  return getAnthropicText(await response.json() as AnthropicResponse);
}

async function generateOpenAIText(options: GenerateTextOptions, model: string): Promise<string> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const messages = [
    { role: "system", content: options.system },
    ...options.messages.map((message) => ({
      role: normalizeOpenAIRole(message.role),
      content: message.content,
    })),
  ];

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      max_completion_tokens: options.maxTokens,
      temperature: options.temperature,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${options.taskName} OpenAI API error: ${response.status} ${errorText}`);
  }

  return getOpenAIText(await response.json() as OpenAIChatCompletionResponse);
}

function normalizeAnthropicMessages(messages: LlmMessage[]): LlmMessage[] {
  return messages
    .filter((message) => message.content?.trim())
    .map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: message.content,
    }));
}

function normalizeOpenAIRole(role: string): string {
  if (role === "assistant" || role === "system" || role === "developer") {
    return role;
  }

  return "user";
}

function getAnthropicText(response: AnthropicResponse): string {
  const text = response.content?.find((part) => typeof part.text === "string" && part.text.trim())?.text;
  if (text) return text;

  if (typeof response?.completion === "string" && response.completion.trim()) {
    return response.completion;
  }

  if (typeof response?.text === "string" && response.text.trim()) {
    return response.text;
  }

  console.error("Unexpected Anthropic response shape:", response);
  throw new Error("Unexpected Anthropic response format");
}

function getOpenAIText(response: OpenAIChatCompletionResponse): string {
  const content = response.choices?.[0]?.message?.content;
  if (typeof content === "string" && content.trim()) {
    return content;
  }

  if (Array.isArray(content)) {
    const text = content
      .map((part) => part.text)
      .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
      .join("\n");

    if (text.trim()) return text;
  }

  console.error("Unexpected OpenAI response shape:", response);
  throw new Error("Unexpected OpenAI response format");
}
