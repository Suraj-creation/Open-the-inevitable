import { describe, expect, it } from "vitest";
import { FacultyError, type FacultyRequest, PROPOSAL_SCHEMA } from "@uci/harness";
import {
  azureFaculty,
  ClaudeFaculty,
  classify,
  closedObjects,
  GeminiFaculty,
  geminiSchema,
  openAIFaculty,
  strictObjects,
} from "../src/index.js";

const request: FacultyRequest = {
  system: "sys",
  prompt: "prompt",
  schema: PROPOSAL_SCHEMA,
  model: "x",
  temperature: 0,
};

describe("schema dialects", () => {
  it("closes every object for Claude and OpenAI, leaving the contract otherwise unchanged", () => {
    const s = closedObjects(PROPOSAL_SCHEMA) as {
      additionalProperties: boolean;
      properties: Record<
        string,
        { additionalProperties?: boolean; items?: { additionalProperties?: boolean } }
      >;
    };
    expect(s.additionalProperties).toBe(false);
    expect(s.properties["decision"]?.additionalProperties).toBe(false);
    expect(s.properties["claims"]?.items?.additionalProperties).toBe(false);
    expect((s as unknown as { required: string[] }).required).toEqual(
      (PROPOSAL_SCHEMA as { required: string[] }).required,
    );
  });
  it("strict dialect: every property required, optional ones nullable", () => {
    const s = strictObjects(PROPOSAL_SCHEMA) as {
      required: string[];
      properties: Record<string, { anyOf?: unknown[]; required?: string[] }>;
    };
    expect(s.required).toContain("open_decision");
    expect(s.properties["open_decision"]?.anyOf).toHaveLength(2);
    expect(s.properties["decision"]?.anyOf).toBeUndefined();
  });
  it("uppercases types for Gemini and drops additionalProperties", () => {
    const s = geminiSchema(closedObjects(PROPOSAL_SCHEMA)) as {
      type: string;
      additionalProperties?: boolean;
      properties: Record<string, { type: string }>;
    };
    expect(s.type).toBe("OBJECT");
    expect(s.additionalProperties).toBeUndefined();
    expect(s.properties["claims"]?.type).toBe("ARRAY");
  });
});

describe("failure classification by delivery", () => {
  it("a provider status means received; no status means ambiguous", () => {
    expect(classify({ status: 429, message: "slow down" }, "p")).toMatchObject({
      delivery: "rejected",
      retryable: true,
    });
    expect(classify({ status: 503, message: "busy" }, "p")).toMatchObject({
      delivery: "rejected",
      retryable: true,
    });
    expect(classify({ status: 400, message: "bad" }, "p")).toMatchObject({
      delivery: "rejected",
      retryable: false,
    });
    expect(classify(new Error("socket hang up"), "p")).toMatchObject({
      delivery: "ambiguous",
      retryable: true,
    });
  });
  it("never echoes a key in an error message", () => {
    expect(
      classify({ status: 401, message: "bad key sk-proj-abcdefghijklmnop" }, "p").message,
    ).not.toContain("sk-proj-abcdefghijklmnop");
  });
});

describe("ClaudeFaculty", () => {
  const recordingClient = (calls: Record<string, unknown>[]) => ({
    beta: {
      messages: {
        create: async (body: Record<string, unknown>) => {
          calls.push(body);
          return {
            stop_reason: "end_turn",
            content: [{ type: "text", text: '{"ok":1}' }],
            usage: { input_tokens: 10, output_tokens: 5 },
            model: "claude-opus-5-5",
          };
        },
      },
    },
  });
  type Body = {
    model: string;
    temperature?: number;
    fallbacks: string;
    betas: string[];
    messages: { role: string; content: string }[];
    output_config: {
      effort: string;
      format?: { type: string; schema: { additionalProperties: boolean } };
    };
  };

  it("makes one call with the closed schema in the prompt, fallbacks, no temperature, reporting the serving model", async () => {
    const calls: Record<string, unknown>[] = [];
    const f = new ClaudeFaculty({ apiKey: "k", client: recordingClient(calls) as never });
    const r = await f.respond(request);
    expect(calls).toHaveLength(1);
    const body = calls[0] as Body;
    expect(body.model).toBe("claude-opus-5-5");
    expect(body.temperature).toBeUndefined();
    expect(body.fallbacks).toBe("default");
    expect(body.betas).toContain("server-side-fallback-2026-07-01");
    expect(body.output_config).toEqual({ effort: "medium" });
    const content = body.messages[0]?.content ?? "";
    expect(content.startsWith(request.prompt)).toBe(true);
    expect(content).toContain('"additionalProperties":false');
    expect(r).toEqual({
      text: '{"ok":1}',
      usage: { inTokens: 10, outTokens: 5 },
      servedBy: "claude-opus-5-5",
    });
  });

  it("constrained mode sends the closed schema as structured output and leaves the prompt unchanged", async () => {
    const calls: Record<string, unknown>[] = [];
    const f = new ClaudeFaculty({
      apiKey: "k",
      output: "constrained",
      client: recordingClient(calls) as never,
    });
    await f.respond(request);
    const body = calls[0] as Body;
    expect(body.messages[0]?.content).toBe(request.prompt);
    expect(body.output_config.format?.type).toBe("json_schema");
    expect(body.output_config.format?.schema.additionalProperties).toBe(false);
  });

  it("a refusal is a non-retryable faculty error, not an output", async () => {
    const client = {
      beta: {
        messages: {
          create: async () => ({
            stop_reason: "refusal",
            stop_details: { category: "bio" },
            content: [],
            usage: { input_tokens: 1, output_tokens: 0 },
            model: "m",
          }),
        },
      },
    };
    await expect(
      new ClaudeFaculty({ apiKey: "k", client: client as never }).respond(request),
    ).rejects.toMatchObject({ name: "FacultyError", retryable: false });
  });

  it("transport failures surface as classified faculty errors", async () => {
    const client = {
      beta: {
        messages: {
          create: async () => {
            throw Object.assign(new Error("overloaded"), { status: 529 });
          },
        },
      },
    };
    const err = await new ClaudeFaculty({ apiKey: "k", client: client as never })
      .respond(request)
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(FacultyError);
    expect(err).toMatchObject({ delivery: "rejected", retryable: true });
  });
});

describe("Chat Completions faculties (OpenAI, Azure)", () => {
  const stub = (calls: Record<string, unknown>[]) => ({
    chat: {
      completions: {
        create: async (body: Record<string, unknown>) => {
          calls.push(body);
          return {
            model: "gpt-4.1-mini-2025",
            choices: [{ message: { content: '{"a":1}' } }],
            usage: { prompt_tokens: 7, completion_tokens: 3 },
          };
        },
      },
    },
  });
  it("Azure routes by deployment and constrains the reply with a strict json_schema", async () => {
    const calls: Record<string, unknown>[] = [];
    const f = azureFaculty({
      endpoint: "https://x",
      apiKey: "k",
      apiVersion: "v",
      deployment: "gpt-4.1-mini",
      client: stub(calls) as never,
    });
    const r = await f.respond(request);
    const body = calls[0] as {
      model: string;
      response_format: { type: string; json_schema: { strict: boolean } };
      temperature: number;
    };
    expect(body.model).toBe("gpt-4.1-mini");
    expect(body.response_format.type).toBe("json_schema");
    expect(body.response_format.json_schema.strict).toBe(true);
    expect(body.temperature).toBe(0);
    expect(r).toEqual({
      text: '{"a":1}',
      usage: { inTokens: 7, outTokens: 3 },
      servedBy: "gpt-4.1-mini-2025",
    });
  });
  it("OpenAI uses the same protocol", async () => {
    const calls: Record<string, unknown>[] = [];
    await openAIFaculty({ apiKey: "k", model: "gpt-4.1", client: stub(calls) as never }).respond(
      request,
    );
    expect((calls[0] as { model: string }).model).toBe("gpt-4.1");
  });
});

describe("GeminiFaculty", () => {
  it("sends the Gemini schema dialect and counts thinking tokens as output", async () => {
    const calls: Record<string, unknown>[] = [];
    const client = {
      models: {
        generateContent: async (body: Record<string, unknown>) => {
          calls.push(body);
          return {
            text: "{}",
            usageMetadata: { promptTokenCount: 9, candidatesTokenCount: 2, thoughtsTokenCount: 4 },
            modelVersion: "gemini-x",
          };
        },
      },
    };
    const r = await new GeminiFaculty({ apiKey: "k", client: client as never }).respond(request);
    const config = (
      calls[0] as { config: { responseMimeType: string; responseSchema: { type: string } } }
    ).config;
    expect(config.responseMimeType).toBe("application/json");
    expect(config.responseSchema.type).toBe("OBJECT");
    expect(r.usage).toEqual({ inTokens: 9, outTokens: 6 });
    expect(r.servedBy).toBe("gemini-x");
  });
});
