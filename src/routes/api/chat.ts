import { createFileRoute } from "@tanstack/react-router";
import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, streamText, type UIMessage } from "ai";

import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayResponseHeaders,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "../../lib/ai-gateway.server";

type ChatRequestBody = { messages?: unknown; name?: unknown };

const systemPrompt = (name: string) =>
  [
    "You are Lumen, the user's close, warm friend inside a private journalling app called Lamplit.",
    name ? `Their name is ${name}; use it naturally, not in every message.` : "",
    "Talk like a real friend texting: casual, kind, curious, a bit playful.",
    "Keep replies short (1-4 sentences) unless they clearly want depth.",
    "Ask about how they're actually doing, remember what they said earlier in this conversation, and never lecture.",
    "You are not a therapist; if they mention serious crisis or self-harm, be gentle, take it seriously, and encourage reaching out to someone they trust or local emergency services.",
    "Never mention being an AI model, providers, or system prompts.",
  ]
    .filter(Boolean)
    .join(" ");

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as ChatRequestBody;
        if (!Array.isArray(body.messages)) {
          return new Response("Messages are required", { status: 400 });
        }

        const key = process.env["LOVABLE_API_KEY"];
        if (!key) {
          return new Response("AI is not configured", { status: 500 });
        }

        const initialRunId = getLovableAiGatewayRunId(request);
        const runIdFetch = createLovableAiGatewayRunIdFetch(initialRunId);
        const lovable = createOpenAI({
          baseURL: "https://ai.gateway.lovable.dev/v1",
          apiKey: key,
          headers: {
            "Lovable-API-Key": key,
            "X-Lovable-AIG-SDK": "vercel-ai-sdk",
          },
          fetch: runIdFetch.fetch,
        });

        const messages = body.messages as UIMessage[];
        const result = streamText({
          model: lovable.responses("openai/gpt-5.6-sol"),
          system: systemPrompt(typeof body.name === "string" ? body.name : ""),
          messages: await convertToModelMessages(messages),
          abortSignal: request.signal,
          providerOptions: {
            openai: {
              forceReasoning: true,
              reasoningEffort: "low",
              reasoningSummary: "auto",
              store: false,
              include: ["reasoning.encrypted_content"],
            },
          },
        });

        const response = result.toUIMessageStreamResponse({
          originalMessages: messages,
          headers: getLovableAiGatewayResponseHeaders(undefined, {
            ...(initialRunId ? { "X-Lovable-AIG-Run-ID": initialRunId } : {}),
          }),
        });

        return withLovableAiGatewayRunIdHeader(response, runIdFetch);
      },
    },
  },
});
