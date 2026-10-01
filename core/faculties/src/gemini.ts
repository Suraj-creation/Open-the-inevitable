import { GoogleGenAI } from "@google/genai";
import type { FacultyRequest, FacultyResponse, ModelFaculty } from "@uci/harness";
import { classify, DEFAULT_TIMEOUT_MS, geminiSchema } from "./shared.js";

export interface GeminiFacultyOptions {
  readonly apiKey: string;
  /** Default `gemini-flash-latest`. */
  readonly model?: string;
  readonly temperature?: number;
  readonly timeoutMs?: number;
  readonly client?: Pick<GoogleGenAI, "models">;
}

/** Gemini as a faculty, via the official SDK; one request per respond(), JSON constrained by responseSchema. */
export class GeminiFaculty implements ModelFaculty {
  readonly id = "google-gemini@1";
  readonly model: string;
  private readonly client: Pick<GoogleGenAI, "models">;
  private readonly temperature: number;

  constructor(options: GeminiFacultyOptions) {
    this.model = options.model ?? "gemini-flash-latest";
    this.temperature = options.temperature ?? 0;
    this.client =
      options.client ??
      new GoogleGenAI({
        apiKey: options.apiKey,
        httpOptions: { timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS },
      });
  }

  async respond(request: FacultyRequest): Promise<FacultyResponse> {
    let response;
    try {
      response = await this.client.models.generateContent({
        model: this.model,
        contents: [{ role: "user", parts: [{ text: request.prompt }] }],
        config: {
          systemInstruction: request.system,
          responseMimeType: "application/json",
          responseSchema: geminiSchema(request.schema),
          temperature: this.temperature,
        },
      });
    } catch (error) {
      throw classify(error, "gemini");
    }
    const usage = response.usageMetadata;
    return {
      text: response.text ?? "",
      usage: {
        inTokens: usage?.promptTokenCount ?? 0,
        outTokens: (usage?.candidatesTokenCount ?? 0) + (usage?.thoughtsTokenCount ?? 0),
      },
      servedBy: response.modelVersion ?? this.model,
    };
  }
}
