import { routeAgentRequest } from "agents";

import { AIChatAgent } from "agents/ai-chat-agent";
import {
  streamText,
  createUIMessageStream,
  convertToModelMessages,
  createUIMessageStreamResponse
} from "ai";
import { createWorkersAI } from "workers-ai-provider";

/**
 * Chat Agent implementation that handles real-time AI chat interactions
 */
export class Chat extends AIChatAgent<Env> {
  async onChatMessage() {
    const workersAI = createWorkersAI({ binding: this.env.AI });
    const model = workersAI("@cf/meta/llama-3-8b-instruct");

    this.messages = this.messages.map((m: any) => {
      // if metadata exists with createdAt, keep it
      if (m.metadata?.createdAt) return m;

      // otherwise assign createdAt
      return {
        ...m,
        metadata: {
          ...m.metadata,
          createdAt: new Date().toISOString()
        }
      };
    });
    console.log("messages before sending:", this.messages);

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        const result = streamText({
          system: `You are a friendly and knowledgeable assistant`,
          messages: convertToModelMessages(this.messages),
          model
        });

        writer.merge(result.toUIMessageStream());
      }
    });

    return createUIMessageStreamResponse({ stream });
  }
}

/**
 * Worker entry point that routes incoming requests to the appropriate handler
 */
export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext) {
    // Route the request to our agent or return 404 if not found
    return (
      (await routeAgentRequest(request, env)) ||
      new Response("Not found", { status: 404 })
    );
  }
} satisfies ExportedHandler<Env>;
