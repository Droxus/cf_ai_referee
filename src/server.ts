import { routeAgentRequest } from "agents";
import { AIChatAgent } from "agents/ai-chat-agent";
import {
  streamText,
  createUIMessageStream,
  convertToModelMessages,
  createUIMessageStreamResponse
} from "ai";
import { createWorkersAI } from "workers-ai-provider";

export interface StoredMessage {
  role: "user" | "assistant" | "system";
  content: string;
  metadata?: {
    createdAt: string;
  };
}

/**
 * Chat Agent implementation with persistent memory and context window management
 */
export class Chat extends AIChatAgent<Env> {
  // Configuration for context management
  private readonly MAX_MESSAGES_IN_CONTEXT = 15;
  private readonly MAX_STORED_MESSAGES = 100;

  private getRecentMessages(messages: StoredMessage[]): StoredMessage[] {
    if (messages.length <= this.MAX_MESSAGES_IN_CONTEXT) {
      return messages;
    }
    return messages.slice(-this.MAX_MESSAGES_IN_CONTEXT);
  }

  private trimStoredHistory(messages: StoredMessage[]): StoredMessage[] {
    if (messages.length <= this.MAX_STORED_MESSAGES) {
      return messages;
    }
    return messages.slice(-this.MAX_STORED_MESSAGES);
  }

  /**
   * Extract content from a message
   */
  private extractContent(message: any): string {
    let content = "";

    if (message.parts && Array.isArray(message.parts)) {
      for (const part of message.parts) {
        if (part.type === "text" && part.text) {
          content += part.text;
        }
      }
    }

    return content.trim();
  }

  /**
   * Get ONLY the latest user message from incoming messages
   */
  private getLatestUserMessage(incomingMessages: any[]): any | null {
    // Find the last user message in the array
    for (let i = incomingMessages.length - 1; i >= 0; i--) {
      const msg = incomingMessages[i];
      if (msg.role === "user") {
        const content = this.extractContent(msg);
        if (content.length > 0) {
          return msg;
        }
      }
    }
    return null;
  }

  /**
   * Convert message to StoredMessage format
   */
  private toStoredMessage(
    message: any,
    timestamp?: string
  ): StoredMessage | null {
    const content = this.extractContent(message);

    if (!content || content.length === 0) {
      return null;
    }

    return {
      role: message.role,
      content: content,
      metadata: {
        createdAt:
          timestamp || message.metadata?.createdAt || new Date().toISOString()
      }
    };
  }

  /**
   * Convert StoredMessage to UIMessage format
   */
  private toUIMessage(message: StoredMessage): any {
    return {
      role: message.role,
      parts: [
        {
          type: "text",
          text: message.content
        }
      ],
      metadata: message.metadata
    };
  }

  async onChatMessage() {
    const workersAI = createWorkersAI({ binding: this.env.AI });
    const model = workersAI("@cf/meta/llama-3-8b-instruct");

    // Load conversation history from storage
    const storedHistory =
      (await this.ctx.storage.get<StoredMessage[]>("conversation_history")) ||
      [];

    console.log(`📦 Loaded ${storedHistory.length} messages from storage`);
    console.log(`📨 Received ${this.messages.length} messages in request`);

    // Get ONLY the latest user message
    const latestUserMessage = this.getLatestUserMessage(this.messages);

    if (!latestUserMessage) {
      console.log("⚠️ No valid user message found");
      return new Response("No valid message", { status: 200 });
    }

    const userMessageContent = this.extractContent(latestUserMessage);
    console.log(
      `💬 Processing user message: "${userMessageContent.substring(0, 50)}..."`
    );

    // Check if this exact message is already in storage (avoid duplicates)
    const isDuplicate = storedHistory.some(
      (msg) => msg.role === "user" && msg.content === userMessageContent
    );

    if (isDuplicate) {
      console.log("⚠️ Duplicate message detected, skipping");
      return new Response("Duplicate message", { status: 200 });
    }

    // Create timestamped user message
    const now = new Date().toISOString();
    const userMessageWithTimestamp = {
      ...latestUserMessage,
      metadata: {
        ...latestUserMessage.metadata,
        createdAt: now
      }
    };

    // Get recent history for context
    const recentHistory = this.getRecentMessages(storedHistory);
    const recentHistoryAsUI = recentHistory.map((m) => this.toUIMessage(m));

    // Combine history with the new user message
    const contextMessages = [...recentHistoryAsUI, userMessageWithTimestamp];

    console.log(
      `🤖 Using ${contextMessages.length} messages for AI (${recentHistoryAsUI.length} history + 1 new)`
    );

    const stream = createUIMessageStream({
      execute: async ({ writer }) => {
        let assistantMessage = "";

        const result = streamText({
          system: `You are a friendly and knowledgeable assistant. You have access to recent conversation history to maintain context.`,
          messages: convertToModelMessages(contextMessages),
          model,
          onFinish: async (event) => {
            assistantMessage = event.text;

            console.log(
              `✅ AI response: "${assistantMessage.substring(0, 50)}..."`
            );

            // Convert user message to storage format
            const userStoredMessage = this.toStoredMessage(
              userMessageWithTimestamp,
              now
            );

            if (!userStoredMessage) {
              console.log("⚠️ Failed to convert user message");
              return;
            }

            // Create assistant response
            const assistantMessageObj: StoredMessage = {
              role: "assistant" as const,
              content: assistantMessage,
              metadata: { createdAt: new Date().toISOString() }
            };

            // Build updated history: old + user message + assistant response
            const updatedHistory: StoredMessage[] = [
              ...storedHistory,
              userStoredMessage,
              assistantMessageObj
            ];

            // Trim to prevent unlimited growth
            const trimmedHistory = this.trimStoredHistory(updatedHistory);

            // Save to storage
            await this.ctx.storage.put("conversation_history", trimmedHistory);

            console.log(
              `💾 Saved ${trimmedHistory.length} messages (${storedHistory.length} → ${trimmedHistory.length})`
            );
          }
        });

        writer.merge(result.toUIMessageStream());
      }
    });

    return createUIMessageStreamResponse({ stream });
  }

  async onClose() {
    console.log("Chat connection closed");
  }
}

/**
 * Worker entry point
 */
export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext) {
    return (
      (await routeAgentRequest(request, env)) ||
      new Response("Not found", { status: 404 })
    );
  }
} satisfies ExportedHandler<Env>;
