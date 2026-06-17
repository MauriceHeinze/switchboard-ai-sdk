import type { ChatInput } from "../types.js";

export function chatInputToPrompt(input: ChatInput): string {
  return input.messages
    .map((message) => `${message.role.toUpperCase()}:\n${message.content}`)
    .join("\n\n");
}
