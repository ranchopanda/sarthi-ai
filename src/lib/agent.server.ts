import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const SYSTEM_PROMPT = `You are Sarthi — a first-principles AI employee for Indian small businesses. Your single goal is to maximize the merchant's time, sales, and customer satisfaction while never risking their WhatsApp number or reputation.

You are not a chatbot. You are their best salesperson + support agent combined. You speak like a sharp, respectful, commercially intelligent local employee who has worked with the merchant for 3 years. You naturally use Hinglish when it feels human. You use "ji", "sir", "bhaiya", "didi", "ma'am" appropriately.

=== CORE RULES (VIOLATE THESE AND YOU MUST ESCALATE IMMEDIATELY) ===
1. Grounding is non-negotiable. Never invent prices, stock, discounts, delivery dates, or product details. Always call tools first.
2. You have perfect memory of this specific business (catalog, pricing policy, offers, tone, return policy). Use it.
3. Never confirm an order or promise delivery until payment is verified (except COD for trusted customers).
4. If customer is angry, confused, asking for refund, order >₹8000, or negotiation is complex — escalate without hesitation.
5. Confidence < 87% → escalate. Be extremely conservative.
6. Never send more than 2 consecutive messages without customer reply (anti-spam).
7. Always be transparent if asked: "Main Sarthi hoon, aapke business ki AI assistant ji."
8. Maximize revenue but never be pushy. Respect is paramount in Indian commerce.

=== BUSINESS CONTEXT (Injected at runtime) ===
Business Name: {{BUSINESS_NAME}}
Tone/Voice: {{BRAND_VOICE}}
Language: {{LANGUAGE}}
UPI ID: {{UPI_ID}}
Current Date: {{CURRENT_DATE}}
Customer Name: {{CUSTOMER_NAME}}

You have access to the following tools. Use them when needed.`;

const TOOLS = [
  {
    name: "search_catalog",
    description:
      "Search the business catalog for products. Use when customer asks about products, prices, availability, or wants recommendations.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search query (product name, category, etc.)" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_customer_history",
    description: "Get past orders, preferences, and interaction history for a customer.",
    parameters: {
      type: "object",
      properties: {
        wa_id: { type: "string", description: "Customer WhatsApp ID" },
      },
      required: ["wa_id"],
    },
  },
  {
    name: "create_draft_order",
    description:
      "Create a draft order with items. Returns order ID and total. Do NOT confirm until payment is verified.",
    parameters: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              product_id: { type: "string" },
              name: { type: "string" },
              quantity: { type: "number" },
              price_paise: { type: "number" },
            },
            required: ["product_id", "name", "quantity", "price_paise"],
          },
          description: "Order items",
        },
        customer_name: { type: "string", description: "Customer name if known" },
        notes: { type: "string", description: "Any special instructions" },
      },
      required: ["items"],
    },
  },
  {
    name: "generate_upi_link",
    description: "Generate a UPI payment link for an order. Requires order_id and amount.",
    parameters: {
      type: "object",
      properties: {
        order_id: { type: "string", description: "Order ID from create_draft_order" },
        amount: { type: "number", description: "Amount in paise" },
      },
      required: ["order_id", "amount"],
    },
  },
  {
    name: "check_payment_status",
    description: "Check if payment has been received for an order.",
    parameters: {
      type: "object",
      properties: {
        order_id: { type: "string", description: "Order ID to check" },
      },
      required: ["order_id"],
    },
  },
  {
    name: "record_order",
    description: "Mark an order as confirmed after payment is verified.",
    parameters: {
      type: "object",
      properties: {
        order_id: { type: "string" },
        status: { type: "string", enum: ["confirmed", "cod"] },
      },
      required: ["order_id", "status"],
    },
  },
  {
    name: "escalate_to_human",
    description:
      "Escalate conversation to the merchant. Use when: customer is angry, refund request, order >₹8000, complex negotiation, or you're unsure.",
    parameters: {
      type: "object",
      properties: {
        reason: { type: "string", description: "Why escalating" },
        suggested_reply: { type: "string", description: "Suggested reply for the merchant" },
        confidence: { type: "number", description: "Your confidence 0-100" },
      },
      required: ["reason", "suggested_reply", "confidence"],
    },
  },
  {
    name: "save_customer_memory",
    description: "Store a fact about the customer for future reference.",
    parameters: {
      type: "object",
      properties: {
        key: { type: "string", description: "Fact key (e.g. preferred_language, name, address)" },
        value: { type: "string", description: "Fact value" },
      },
      required: ["key", "value"],
    },
  },
];

function getAdminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase not configured");
  return createClient<Database>(url, key);
}

async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  businessId: string,
  customerWaId: string,
): Promise<string> {
  const db = getAdminClient();

  switch (toolName) {
    case "search_catalog": {
      const query = args.query as string;
      const { data } = await db
        .from("products")
        .select("id, name, sku, description, price_paise, stock, image_url, category")
        .eq("business_id", businessId)
        .eq("active", true)
        .ilike("name", `%${query}%`)
        .order("name")
        .limit(5);
      return JSON.stringify(data ?? []);
    }

    case "get_customer_history": {
      const { data: customer } = await db
        .from("customers")
        .select("id, name, tags, last_seen_at")
        .eq("business_id", businessId)
        .eq("wa_id", customerWaId)
        .maybeSingle();
      if (!customer) return JSON.stringify({ found: false });

      const { data: orders } = await db
        .from("orders")
        .select("id, items, total_paise, status, created_at")
        .eq("business_id", businessId)
        .eq("customer_id", customer.id)
        .order("created_at", { ascending: false })
        .limit(10);

      return JSON.stringify({ customer, orders: orders ?? [] });
    }

    case "create_draft_order": {
      const items = args.items as Array<{
        product_id: string;
        name: string;
        quantity: number;
        price_paise: number;
      }>;
      const total = items.reduce((sum, i) => sum + i.price_paise * i.quantity, 0);

      // Resolve customer
      const { data: cust } = await db
        .from("customers")
        .select("id")
        .eq("business_id", businessId)
        .eq("wa_id", customerWaId)
        .maybeSingle();

      const { data: order } = await db
        .from("orders")
        .insert({
          business_id: businessId,
          customer_id: cust?.id ?? "00000000-0000-0000-0000-000000000000",
          items: items.map((i) => ({
            product_id: i.product_id,
            name: i.name,
            qty: i.quantity,
            price: i.price_paise,
          })),
          total_paise: total,
          status: "draft",
          notes: (args.notes as string) || null,
        })
        .select("id, total_paise")
        .single();

      return JSON.stringify({
        order_id: order?.id,
        total_paise: total,
        items_summary: items.map((i) => `${i.name} x${i.quantity}`).join(", "),
      });
    }

    case "generate_upi_link": {
      const orderId = args.order_id as string;
      const amount = args.amount as number;
      const rkId = process.env.RAZORPAY_KEY_ID;
      const rkSecret = process.env.RAZORPAY_KEY_SECRET;

      if (!rkId || !rkSecret || rkId.startsWith("mock")) {
        return JSON.stringify({
          upi_link: `upi://pay?pa=merchant@upi&pn=Merchant&am=${amount / 100}&tn=Order ${orderId}`,
          payment_id: `mock_${orderId}`,
          note: "Razorpay not configured — using basic UPI link",
        });
      }

      // Create Razorpay payment link
      const authHeader = "Basic " + Buffer.from(`${rkId}:${rkSecret}`).toString("base64");
      const res = await fetch("https://api.razorpay.com/v1/payment_links", {
        method: "POST",
        headers: { Authorization: authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          currency: "INR",
          accept_partial: false,
          description: `Order #${orderId.slice(0, 8)}`,
          reference_id: orderId,
          notify: { sms: false, email: false },
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        console.error("[agent] Razorpay error:", err);
        return JSON.stringify({ upi_link: null, error: "Payment link creation failed" });
      }

      const link = await res.json();
      await db
        .from("orders")
        .update({
          upi_link: link.short_url,
          payment_ref: link.id,
          status: "awaiting_payment",
        })
        .eq("id", orderId);

      return JSON.stringify({ upi_link: link.short_url, payment_id: link.id });
    }

    case "check_payment_status": {
      const orderId = args.order_id as string;
      const { data: order } = await db
        .from("orders")
        .select("status, payment_ref")
        .eq("id", orderId)
        .maybeSingle();

      if (!order?.payment_ref) {
        return JSON.stringify({ status: order?.status ?? "unknown" });
      }

      const rkId = process.env.RAZORPAY_KEY_ID;
      const rkSecret = process.env.RAZORPAY_KEY_SECRET;
      if (!rkId || !rkSecret || rkId.startsWith("mock")) {
        return JSON.stringify({ status: order.status });
      }

      const authHeader = "Basic " + Buffer.from(`${rkId}:${rkSecret}`).toString("base64");
      const res = await fetch(`https://api.razorpay.com/v1/payment_links/${order.payment_ref}`, {
        headers: { Authorization: authHeader },
      });

      if (!res.ok) return JSON.stringify({ status: order.status });

      const link = await res.json();
      if (link.status === "paid") {
        await db.from("orders").update({ status: "paid" }).eq("id", orderId);
        return JSON.stringify({ status: "paid" });
      }
      return JSON.stringify({ status: "pending", razorpay_status: link.status });
    }

    case "record_order": {
      const orderId = args.order_id as string;
      const status = args.status as string;
      await db
        .from("orders")
        .update({ status: status === "cod" ? "cod" : "paid" })
        .eq("id", orderId);
      return JSON.stringify({ recorded: true, order_id: orderId, status });
    }

    case "escalate_to_human": {
      const reason = args.reason as string;
      const suggestedReply = args.suggested_reply as string;
      const confidence = args.confidence as number;

      // Find open conversation
      const { data: cust } = await db
        .from("customers")
        .select("id")
        .eq("business_id", businessId)
        .eq("wa_id", customerWaId)
        .maybeSingle();

      if (cust) {
        const { data: conv } = await db
          .from("conversations")
          .select("id")
          .eq("business_id", businessId)
          .eq("customer_id", cust.id)
          .eq("status", "open")
          .maybeSingle();

        if (conv) {
          await db.from("escalations").insert({
            business_id: businessId,
            conversation_id: conv.id,
            reason,
            status: "open",
          });
        }
      }

      return JSON.stringify({
        escalated: true,
        reason,
        suggested_reply: suggestedReply,
        confidence,
      });
    }

    case "save_customer_memory": {
      const key = args.key as string;
      const value = args.value as string;

      const { data: cust } = await db
        .from("customers")
        .select("id, tags")
        .eq("business_id", businessId)
        .eq("wa_id", customerWaId)
        .maybeSingle();

      if (cust) {
        // Store as tag for simplicity
        const tags = [...(cust.tags ?? []), `${key}:${value}`];
        await db.from("customers").update({ tags }).eq("id", cust.id);
      }

      return JSON.stringify({ saved: true, key, value });
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
}

interface AgentMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
  }>;
}

interface AgentResult {
  reply: string;
  escalated: boolean;
  escalationReason?: string;
  toolCalls: string[];
  confidence: number;
}

export async function runAgent(params: {
  businessId: string;
  customerWaId: string;
  customerName?: string;
  messageText: string;
  conversationHistory: Array<{ role: "customer" | "agent"; content: string }>;
}): Promise<AgentResult> {
  const db = getAdminClient();

  // Fetch business context
  const { data: business } = await db
    .from("businesses")
    .select("name, brand_voice, language, upi_id")
    .eq("id", params.businessId)
    .single();

  const today = new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Build system prompt
  const systemPrompt = SYSTEM_PROMPT.replace("{{BUSINESS_NAME}}", business?.name ?? "Business")
    .replace("{{BRAND_VOICE}}", business?.brand_voice ?? "Friendly, polite, uses 'ji'")
    .replace("{{LANGUAGE}}", business?.language ?? "hinglish")
    .replace("{{UPI_ID}}", business?.upi_id ?? "Not set")
    .replace("{{CURRENT_DATE}}", today)
    .replace("{{CUSTOMER_NAME}}", params.customerName ?? "Customer");

  // Build messages
  const messages: AgentMessage[] = [{ role: "system", content: systemPrompt }];

  // Add conversation history
  for (const msg of params.conversationHistory.slice(-20)) {
    messages.push({
      role: msg.role === "customer" ? "user" : "assistant",
      content: msg.content,
    });
  }

  // Add current message
  messages.push({ role: "user", content: params.messageText });

  const toolCalls: string[] = [];
  let finalReply = "";
  let escalated = false;
  let escalationReason: string | undefined;
  let confidence = 90;

  // ReAct loop: max 3 tool steps
  for (let step = 0; step < 3; step++) {
    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    if (!LOVABLE_API_KEY || LOVABLE_API_KEY.startsWith("mock")) {
      // Mock mode — return a basic reply
      finalReply = "Ji, aapka message mil gaya. Hum jaldi reply karenge! 🙏";
      break;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gemini-3-flash-preview",
        messages,
        tools: TOOLS.map((t) => ({ type: "function", function: t })),
        tool_choice: "auto",
        temperature: 0.3,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("[agent] LLM API error:", err);
      finalReply = "Ji, abhi technical issue hai. Thodi der mein reply karenge. 🙏";
      break;
    }

    const result = await response.json();
    const choice = result.choices?.[0];
    if (!choice) break;

    const assistantMessage = choice.message;

    // Check for tool calls
    if (assistantMessage.tool_calls?.length) {
      messages.push(assistantMessage);

      for (const tc of assistantMessage.tool_calls) {
        const toolName = tc.function.name;
        const toolArgs = JSON.parse(tc.function.arguments);
        toolCalls.push(toolName);

        const toolResult = await executeTool(
          toolName,
          toolArgs,
          params.businessId,
          params.customerWaId,
        );

        messages.push({
          role: "tool",
          content: toolResult,
          tool_call_id: tc.id,
        });

        if (toolName === "escalate_to_human") {
          escalated = true;
          escalationReason = toolArgs.reason;
          confidence = toolArgs.confidence ?? 50;
        }
      }

      if (escalated) break;
      continue;
    }

    // No tool calls — this is the final reply
    finalReply = assistantMessage.content || "";
    break;
  }

  // Confidence check
  if (confidence < 87 && !escalated) {
    escalated = true;
    escalationReason = "Low confidence reply";
  }

  return {
    reply: finalReply,
    escalated,
    escalationReason,
    toolCalls,
    confidence,
  };
}
