import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const productSchema = z.object({
  name: z.string().min(1),
  sku: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  price_paise: z.coerce.number().int().min(0),
  stock: z.coerce.number().int().min(0).optional().nullable(),
  image_url: z.string().url().optional().nullable(),
  category: z.string().optional().nullable(),
  active: z.boolean().default(true),
});

type ProductInput = z.infer<typeof productSchema>;

async function getBusinessId(ownerId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("businesses")
    .select("id")
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (error || !data) throw new Error("Business not found");
  return data.id;
}

export const getProducts = createServerFn({ method: "GET" })
  .validator(z.object({ userId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const businessId = await getBusinessId(data.userId);
    const { data: products, error } = await supabaseAdmin
      .from("products")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return products ?? [];
  });

export const createProduct = createServerFn({ method: "POST" })
  .validator(z.object({ userId: z.string().uuid(), product: productSchema }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const businessId = await getBusinessId(data.userId);
    const { data: product, error } = await supabaseAdmin
      .from("products")
      .insert({ ...data.product, business_id: businessId })
      .select()
      .single();
    if (error) throw error;
    return product;
  });

export const updateProduct = createServerFn({ method: "POST" })
  .validator(
    z.object({
      userId: z.string().uuid(),
      productId: z.string().uuid(),
      product: productSchema.partial(),
    }),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const businessId = await getBusinessId(data.userId);
    const { data: product, error } = await supabaseAdmin
      .from("products")
      .update(data.product)
      .eq("id", data.productId)
      .eq("business_id", businessId)
      .select()
      .single();
    if (error) throw error;
    return product;
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .validator(z.object({ userId: z.string().uuid(), productId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const businessId = await getBusinessId(data.userId);
    const { error } = await supabaseAdmin
      .from("products")
      .delete()
      .eq("id", data.productId)
      .eq("business_id", businessId);
    if (error) throw error;
    return { success: true };
  });

export const uploadCatalog = createServerFn({ method: "POST" })
  .validator(
    z.object({
      userId: z.string().uuid(),
      rows: z.array(
        z.object({
          name: z.string().min(1),
          sku: z.string().optional().nullable(),
          description: z.string().optional().nullable(),
          price: z.coerce.number().int().min(0),
          stock: z.coerce.number().int().min(0).optional().nullable(),
          category: z.string().optional().nullable(),
          image_url: z.string().url().optional().nullable(),
        }),
      ),
    }),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const businessId = await getBusinessId(data.userId);

    const inserts = data.rows.map((row) => ({
      business_id: businessId,
      name: row.name,
      sku: row.sku || null,
      description: row.description || null,
      price_paise: row.price,
      stock: row.stock ?? null,
      category: row.category || null,
      image_url: row.image_url || null,
      active: true,
    }));

    const { data: products, error } = await supabaseAdmin.from("products").insert(inserts).select();
    if (error) throw error;

    return { imported: products?.length ?? 0, products: products ?? [] };
  });

export const generateEmbeddings = createServerFn({ method: "POST" })
  .validator(z.object({ userId: z.string().uuid() }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const businessId = await getBusinessId(data.userId);

    const { data: products, error } = await supabaseAdmin
      .from("products")
      .select("id, name, description, category")
      .eq("business_id", businessId)
      .is("embedding", null)
      .limit(100);
    if (error) throw error;
    if (!products?.length) return { embedded: 0 };

    const texts = products.map(
      (p) =>
        `${p.name}${p.description ? ` - ${p.description}` : ""}${p.category ? ` [${p.category}]` : ""}`,
    );

    const LOVABLE_API_KEY = process.env.LOVABLE_API_KEY;
    if (!LOVABLE_API_KEY || LOVABLE_API_KEY.startsWith("mock")) {
      console.warn("[catalog] LOVABLE_API_KEY not configured — skipping embeddings");
      return { embedded: 0, reason: "mock_key" };
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gemini-embedding-001",
        input: texts,
      }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error("[catalog] Embedding API error:", body);
      return { embedded: 0, reason: "api_error", detail: body };
    }

    const result = await response.json();
    const embeddings: string[] = result.data.map(
      (d: { embedding: number[] }) => `[${d.embedding.join(",")}]`,
    );

    let embedded = 0;
    for (let i = 0; i < products.length; i++) {
      const { error: updateErr } = await supabaseAdmin
        .from("products")
        .update({ embedding: embeddings[i] })
        .eq("id", products[i].id);
      if (updateErr) {
        console.error("[catalog] Embedding update error:", updateErr);
      } else {
        embedded++;
      }
    }

    return { embedded };
  });

export const searchCatalog = createServerFn({ method: "POST" })
  .validator(z.object({ userId: z.string().uuid(), query: z.string().min(1) }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const businessId = await getBusinessId(data.userId);

    const { data: products, error } = await supabaseAdmin
      .from("products")
      .select("id, name, sku, description, price_paise, stock, image_url, category")
      .eq("business_id", businessId)
      .eq("active", true)
      .ilike("name", `%${data.query}%`)
      .order("name")
      .limit(10);
    if (error) throw error;
    return products ?? [];
  });
