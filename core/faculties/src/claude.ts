import Anthropic from "@anthropic-ai/sdk";
import {
  FacultyError,
  type FacultyRequest,
  type FacultyResponse,
  type ModelFaculty,
} from "@uci/harness";
import { classify, closedObjects, DEFAULT_TIMEOUT_MS } from "./shared.js";

export interface ClaudeFacultyOptions {
  readonly apiKey: string;
  /** Default `claude-opus-5-5`. */
  readonly model?: string;
  /** Thinking is always on for current models; effort is the depth control. Default `medium`. */
  readonly effort?: "low" | "medium" | "high" | "xhigh" | "max";
  readonly maxTokens?: number;
  readonly timeoutMs?: number;
  /**
   * How proposal@1's schema reaches the model. Default `prompted`: the closed schema is rendered into
   * the user turn and the harness's own parse and validation are the only check. `constrained` uses
   * structured outputs (output_config.format), which on this contract was refused as
   * reasoning_extraction on 16 of 16 calls at effort medium while `prompted` was refused on 0 of 4
   * (journal, 2026-10-01). Kept so the comparison can be re-run on new models.
   */
  readonly output?: "prompted" | "constrained";
  /** Test seam: a client exposing beta.messages.create. */
  readonly client?: Pick<Anthropic, "beta">;
}

/**
 * Claude as a faculty, via the official SDK. One request per respond(): SDK retries are disabled so
 * every attempt is a ledger effect. The reply is asked for as proposal@1 JSON (see `output`); the
 * harness validates it, never the provider. Refusal fallbacks are on (server-side, "default" routing); the model that actually answered is reported
 * as `servedBy` so the record never misattributes an output.
 */
export class ClaudeFaculty implements ModelFaculty {
  readonly id = "anthropic-claude@1";
  readonly model: string;
  private readonly client: Pick<Anthropic, "beta">;
  private readonly effort: NonNullable<ClaudeFacultyOptions["effort"]>;
  private readonly maxTokens: number;
  private readonly output: NonNullable<ClaudeFacultyOptions["output"]>;

  constructor(options: ClaudeFacultyOptions) {
    this.model = options.model ?? "claude-opus-5-5";
    this.effort = options.effort ?? "medium";
    this.maxTokens = options.maxTokens ?? 16_000;
    this.output = options.output ?? "prompted";
    this.client =
      options.client ??
      new Anthropic({
        apiKey: options.apiKey,
        maxRetries: 0,
        timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      });
  }

  async respond(request: FacultyRequest): Promise<FacultyResponse> {
    const schema = closedObjects(request.schema);
    const prompted = this.output === "prompted";
    const content = prompted
      ? `${request.prompt}

Reply with only a JSON object (no prose, no code fence) conforming to this JSON Schema:
${JSON.stringify(schema)}`
      : request.prompt;
    let response;
    try {
      // No temperature: current Claude models reject sampling parameters; effort controls depth.
      response = await this.client.beta.messages.create({
        model: this.model,
        max_tokens: this.maxTokens,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        system: request.system,
        messages: [{ role: "user", content }],
        output_config: prompted
          ? { effort: this.effort }
          : { effort: this.effort, format: { type: "json_schema", schema } },
      });
    } catch (error) {
      throw classify(error, "anthropic");
    }
    if (response.stop_reason === "refusal") {
      const category = response.stop_details?.category ?? "unspecified";
      throw new FacultyError(`anthropic: refused (${category})`, "accepted", false);
    }
    const text = response.content
      .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
      .map((b) => b.text)
      .join("");
    return {
      text,
      usage: { inTokens: response.usage.input_tokens, outTokens: response.usage.output_tokens },
      servedBy: response.model,
    };
  }
}
