import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const historySchema = z.array(
  z.object({
    role: z.enum(["customer", "agent"]),
    content: z.string(),
  }),
);

export const runPlaygroundAgent = createServerFn({ method: "POST" })
  .validator(
    z.object({
      userId: z.string().uuid(),
      businessId: z.string().uuid(),
      messageText: z.string().min(1),
      conversationHistory: historySchema.default([]),
    }),
  )
  .handler(async ({ data }) => {
    const { runAgent } = await import("@/lib/agent.server");
    return runAgent({
      businessId: data.businessId,
      customerWaId: "playground_user",
      customerName: "Playground User",
      messageText: data.messageText,
      conversationHistory: data.conversationHistory,
    });
  });
