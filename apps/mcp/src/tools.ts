/**
 * MCP tool definitions and handlers for the COS gateway.
 *
 * Tools exposed:
 *   cos_create_surface — open a new cognitive learning surface
 *   cos_ask            — ask a learning question on a surface
 *   cos_expand         — expand a block to a deeper explanation layer
 *   cos_get_state      — retrieve the current folded surface state
 *
 * §2 law: only @inevitable/sdk imported — no substrate package imports.
 */
import { type CosClient, CosClientError } from "@inevitable/sdk";

export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, { type: string; description: string }>;
    required?: string[];
  };
}

export const TOOLS: McpTool[] = [
  {
    name: "cos_create_surface",
    description: "Open a new cognitive learning surface on the COS gateway.",
    inputSchema: {
      type: "object",
      properties: {
        goal: { type: "string", description: "The learning goal or question for this surface." },
        learnerId: {
          type: "string",
          description: "Optional persistent learner ID to resume context.",
        },
      },
    },
  },
  {
    name: "cos_ask",
    description:
      "Ask a learning question on an open surface. Returns the number of blocks generated.",
    inputSchema: {
      type: "object",
      properties: {
        surfaceId: {
          type: "string",
          description: "The surface ID returned by cos_create_surface.",
        },
        goal: { type: "string", description: "The question or learning goal to ask." },
      },
      required: ["surfaceId", "goal"],
    },
  },
  {
    name: "cos_expand",
    description: "Expand a surface block to a deeper explanation layer (0–6).",
    inputSchema: {
      type: "object",
      properties: {
        surfaceId: { type: "string", description: "The surface ID." },
        blockId: { type: "string", description: "The block ID to expand." },
        layer: {
          type: "number",
          description: "Depth layer to expand to (0=intuition … 6=research).",
        },
      },
      required: ["surfaceId", "blockId", "layer"],
    },
  },
  {
    name: "cos_get_state",
    description: "Retrieve the current folded SurfaceState for a surface.",
    inputSchema: {
      type: "object",
      properties: {
        surfaceId: { type: "string", description: "The surface ID." },
      },
      required: ["surfaceId"],
    },
  },
];

export function buildToolHandlers(
  client: CosClient,
): Record<string, (args: unknown) => Promise<unknown>> {
  return {
    cos_create_surface: async (args: unknown) => {
      const a = args as { goal?: string; learnerId?: string };
      try {
        const surface = await client.createSurface({ goal: a.goal, learnerId: a.learnerId });
        return { content: [{ type: "text", text: JSON.stringify(surface) }] };
      } catch (err) {
        return errorContent(err);
      }
    },

    cos_ask: async (args: unknown) => {
      const a = args as { surfaceId: string; goal: string };
      try {
        const result = await client.ask(a.surfaceId, a.goal);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (err) {
        return errorContent(err);
      }
    },

    cos_expand: async (args: unknown) => {
      const a = args as { surfaceId: string; blockId: string; layer: number };
      try {
        const result = await client.expand(a.surfaceId, a.blockId, a.layer);
        return { content: [{ type: "text", text: JSON.stringify(result) }] };
      } catch (err) {
        return errorContent(err);
      }
    },

    cos_get_state: async (args: unknown) => {
      const a = args as { surfaceId: string };
      try {
        const state = await client.getState(a.surfaceId);
        return { content: [{ type: "text", text: JSON.stringify(state) }] };
      } catch (err) {
        return errorContent(err);
      }
    },
  };
}

function errorContent(err: unknown): { isError: true; content: [{ type: "text"; text: string }] } {
  const msg =
    err instanceof CosClientError
      ? `COS gateway error ${err.status}: ${err.message}`
      : err instanceof Error
        ? err.message
        : String(err);
  return { isError: true, content: [{ type: "text", text: msg }] };
}
