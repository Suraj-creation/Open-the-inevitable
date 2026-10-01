import OpenAI, { AzureOpenAI } from "openai";
import type { FacultyRequest, FacultyResponse, ModelFaculty } from "@uci/harness";
import { classify, DEFAULT_TIMEOUT_MS, strictObjects } from "./shared.js";

type ChatClient = Pick<OpenAI, "chat">;

interface ChatFacultyConfig {
  readonly id: string;
  readonly provider: string;
  readonly model: string;
  readonly client: ChatClient;
  /** Omit for models that reject a temperature parameter (o-series / gpt-5 family). */
  readonly temperature?: number;
  readonly maxTokens: number;
}

/**
 * Chat Completions faculties (OpenAI and Azure OpenAI share the protocol). One request per
 * respond(), SDK retries disabled. The reply is constrained with a strict json_schema response
 * format (optional fields become nullable; the harness reads null as absent), then validated.
 */
class ChatCompletionsFaculty implements ModelFaculty {
  readonly id: string;
  readonly model: string;

  constructor(private readonly config: ChatFacultyConfig) {
    this.id = config.id;
    this.model = config.model;
  }

  async respond(request: FacultyRequest): Promise<FacultyResponse> {
    let completion;
    try {
      completion = await this.config.client.chat.completions.create({
        model: this.config.model,
        messages: [
          { role: "system", content: request.system },
          { role: "user", content: request.prompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: { name: "proposal", schema: strictObjects(request.schema), strict: true },
        },
        max_completion_tokens: this.config.maxTokens,
        ...(this.config.temperature !== undefined ? { temperature: this.config.temperature } : {}),
      });
    } catch (error) {
      throw classify(error, this.config.provider);
    }
    const choice = completion.choices[0];
    return {
      text: choice?.message?.content ?? "",
      usage: {
        inTokens: completion.usage?.prompt_tokens ?? 0,
        outTokens: completion.usage?.completion_tokens ?? 0,
      },
      servedBy: completion.model,
    };
  }
}

export interface OpenAIFacultyOptions {
  readonly apiKey: string;
  readonly model?: string;
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly timeoutMs?: number;
  readonly client?: ChatClient;
}

export function openAIFaculty(options: OpenAIFacultyOptions): ModelFaculty {
  const model = options.model ?? "gpt-4.1-mini";
  return new ChatCompletionsFaculty({
    id: "openai@1",
    provider: "openai",
    model,
    client:
      options.client ??
      new OpenAI({
        apiKey: options.apiKey,
        maxRetries: 0,
        timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      }),
    temperature: options.temperature ?? 0,
    maxTokens: options.maxTokens ?? 8_000,
  });
}

export interface AzureFacultyOptions {
  readonly endpoint: string;
  readonly apiKey: string;
  readonly apiVersion: string;
  /** The deployment name (Azure routes by deployment, not model name). */
  readonly deployment: string;
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly timeoutMs?: number;
  readonly client?: ChatClient;
}

export function azureFaculty(options: AzureFacultyOptions): ModelFaculty {
  return new ChatCompletionsFaculty({
    id: "azure-openai@1",
    provider: "azure-openai",
    model: options.deployment,
    client:
      options.client ??
      new AzureOpenAI({
        endpoint: options.endpoint,
        apiKey: options.apiKey,
        apiVersion: options.apiVersion,
        deployment: options.deployment,
        maxRetries: 0,
        timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      }),
    temperature: options.temperature ?? 0,
    maxTokens: options.maxTokens ?? 8_000,
  });
}
