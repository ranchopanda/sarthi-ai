import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useCallback } from "react";
import {
  Package,
  Plus,
  Upload,
  Search,
  Loader2,
  Trash2,
  Pencil,
  ImagePlus,
  FileSpreadsheet,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  uploadCatalog,
  generateEmbeddings,
} from "@/lib/api/catalog.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/catalog")({
  head: () => ({
    meta: [{ title: "Catalog · Sarthi AI" }, { name: "robots", content: "noindex" }],
  }),
  component: CatalogPage,
});

function CatalogPage() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<any>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [csvOpen, setCsvOpen] = useState(false);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products", user.id],
    queryFn: () => getProducts({ data: { userId: user.id } }),
  });

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku?.toLowerCase().includes(search.toLowerCase()) ||
      p.category?.toLowerCase().includes(search.toLowerCase()),
  );

  const deleteMut = useMutation({
    mutationFn: (productId: string) => deleteProduct({ data: { userId: user.id, productId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product deleted");
      setDeleteId(null);
    },
    onError: (e: any) => toast.error(e.message ?? "Delete failed"),
  });

  return (
    <div className="flex flex-1 flex-col">
      <div className="border-b border-border bg-card/60 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-semibold">Catalog</h1>
            <p className="text-sm text-muted-foreground">
              {products.length} product{products.length !== 1 ? "s" : ""} in your store
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setCsvOpen(true)}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Upload CSV
            </Button>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add product
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6">
        <div className="mb-4 flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search products..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card p-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Package className="h-6 w-6" />
            </div>
            <h2 className="mt-4 font-display text-xl font-semibold">
              {products.length === 0 ? "No products yet" : "No matches"}
            </h2>
            <p className="mt-2 max-w-sm text-sm text-muted-foreground">
              {products.length === 0
                ? "Upload a CSV or add products manually so Sarthi can recommend them to customers."
                : "Try a different search term."}
            </p>
            {products.length === 0 && (
              <div className="mt-6 flex gap-2">
                <Button variant="outline" onClick={() => setCsvOpen(true)}>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload CSV
                </Button>
                <Button onClick={() => setAddOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add product
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="w-[100px]">SKU</TableHead>
                  <TableHead className="w-[120px] text-right">Price</TableHead>
                  <TableHead className="w-[80px] text-right">Stock</TableHead>
                  <TableHead className="w-[100px]">Category</TableHead>
                  <TableHead className="w-[80px] text-center">Active</TableHead>
                  <TableHead className="w-[100px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {p.image_url ? (
                          <img
                            src={p.image_url}
                            alt={p.name}
                            className="h-10 w-10 rounded-md object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
                            <ImagePlus className="h-4 w-4" />
                          </div>
                        )}
                        <div>
                          <div className="font-medium">{p.name}</div>
                          {p.description && (
                            <div className="max-w-[300px] truncate text-xs text-muted-foreground">
                              {p.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {p.sku || "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ₹{(p.price_paise / 100).toLocaleString("en-IN")}
                    </TableCell>
                    <TableCell className="text-right">
                      {p.stock != null ? (
                        <Badge variant={p.stock > 0 ? "secondary" : "destructive"}>{p.stock}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {p.category ? (
                        <Badge variant="outline">{p.category}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={p.active ? "secondary" : "destructive"}>
                        {p.active ? "Active" : "Draft"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setEditProduct(p)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setDeleteId(p.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <ProductDialog open={addOpen} onOpenChange={setAddOpen} userId={user.id} />
      {editProduct && (
        <ProductDialog
          open={!!editProduct}
          onOpenChange={(v) => !v && setEditProduct(null)}
          userId={user.id}
          product={editProduct}
        />
      )}
      <CsvUploadDialog open={csvOpen} onOpenChange={setCsvOpen} userId={user.id} />
      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete product?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the product from your catalog. Sarthi won't be able to
              recommend it anymore.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMut.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMut.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ProductDialog({
  open,
  onOpenChange,
  userId,
  product,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
  product?: any;
}) {
  const qc = useQueryClient();
  const isEdit = !!product;
  const [form, setForm] = useState({
    name: product?.name ?? "",
    sku: product?.sku ?? "",
    description: product?.description ?? "",
    price: product ? String(product.price_paise / 100) : "",
    stock: product?.stock != null ? String(product.stock) : "",
    category: product?.category ?? "",
    image_url: product?.image_url ?? "",
    active: product?.active ?? true,
  });
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.price) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        sku: form.sku.trim() || null,
        description: form.description.trim() || null,
        price_paise: Math.round(parseFloat(form.price) * 100),
        stock: form.stock ? parseInt(form.stock) : null,
        category: form.category.trim() || null,
        image_url: form.image_url.trim() || null,
        active: form.active,
      };
      if (isEdit) {
        await updateProduct({
          data: { userId, productId: product.id, product: payload },
        });
        toast.success("Product updated");
      } else {
        await createProduct({ data: { userId, product: payload } });
        toast.success("Product added");
      }
      qc.invalidateQueries({ queryKey: ["products"] });
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message ?? "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit product" : "Add product"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the product details below."
              : "Add a product to your catalog so Sarthi can recommend it."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="p-name">Name *</Label>
            <Input
              id="p-name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Blue Kurta"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="p-sku">SKU</Label>
              <Input
                id="p-sku"
                value={form.sku}
                onChange={(e) => set("sku", e.target.value)}
                placeholder="SKU-001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-category">Category</Label>
              <Input
                id="p-category"
                value={form.category}
                onChange={(e) => set("category", e.target.value)}
                placeholder="Kurtas"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-desc">Description</Label>
            <Textarea
              id="p-desc"
              rows={2}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Cotton kurta in royal blue..."
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="p-price">Price (₹) *</Label>
              <Input
                id="p-price"
                type="number"
                step="1"
                min="0"
                value={form.price}
                onChange={(e) => set("price", e.target.value)}
                placeholder="1299"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-stock">Stock</Label>
              <Input
                id="p-stock"
                type="number"
                min="0"
                value={form.stock}
                onChange={(e) => set("stock", e.target.value)}
                placeholder="50"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="p-image">Image URL</Label>
            <Input
              id="p-image"
              type="url"
              value={form.image_url}
              onChange={(e) => set("image_url", e.target.value)}
              placeholder="https://..."
            />
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={form.active} onCheckedChange={(v) => set("active", v)} />
            <Label className="text-sm">Active in catalog</Label>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !form.name.trim()}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Save changes" : "Add product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CsvUploadDialog({
  open,
  onOpenChange,
  userId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
}) {
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<
    {
      name: string;
      price: number;
      stock?: number;
      sku?: string;
      category?: string;
      description?: string;
      image_url?: string;
    }[]
  >([]);
  const [uploading, setUploading] = useState(false);
  const [embedding, setEmbedding] = useState(false);
  const [result, setResult] = useState<{ imported: number } | null>(null);

  const parseCsv = useCallback((text: string) => {
    const lines = text.trim().split("\n");
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const nameIdx = headers.findIndex((h) => h === "name");
    const priceIdx = headers.findIndex((h) => h === "price");
    const stockIdx = headers.findIndex((h) => h === "stock");
    const skuIdx = headers.findIndex((h) => h === "sku");
    const catIdx = headers.findIndex((h) => h === "category");
    const descIdx = headers.findIndex((h) => h === "description");
    const imgIdx = headers.findIndex((h) => h === "image_url" || h === "image");

    if (nameIdx === -1 || priceIdx === -1) return [];

    return lines.slice(1).map((line) => {
      const cols = line.split(",").map((c) => c.trim().replace(/^["']|["']$/g, ""));
      return {
        name: cols[nameIdx] ?? "",
        price: Math.round(parseFloat(cols[priceIdx] || "0") * 100),
        stock: stockIdx >= 0 ? parseInt(cols[stockIdx] || "") || undefined : undefined,
        sku: skuIdx >= 0 ? cols[skuIdx] || undefined : undefined,
        category: catIdx >= 0 ? cols[catIdx] || undefined : undefined,
        description: descIdx >= 0 ? cols[descIdx] || undefined : undefined,
        image_url: imgIdx >= 0 ? cols[imgIdx] || undefined : undefined,
      };
    });
  }, []);

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const rows = parseCsv(text);
    setPreview(rows.filter((r) => r.name && r.price > 0));
  };

  const onUpload = async () => {
    if (!preview.length) return;
    setUploading(true);
    try {
      const { imported } = await uploadCatalog({
        data: {
          userId,
          rows: preview.map((r) => ({
            name: r.name,
            price: r.price,
            stock: r.stock,
            sku: r.sku,
            category: r.category,
            description: r.description,
            image_url: r.image_url,
          })),
        },
      });
      setResult({ imported });
      qc.invalidateQueries({ queryKey: ["products"] });

      setEmbedding(true);
      try {
        const { embedded } = await generateEmbeddings({ data: { userId } });
        if (embedded > 0) {
          toast.success(`${imported} products imported, ${embedded} embedded`);
        } else {
          toast.success(`${imported} products imported`);
        }
      } catch {
        toast.success(`${imported} products imported`);
      } finally {
        setEmbedding(false);
      }
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    setPreview([]);
    setResult(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Upload catalog CSV</DialogTitle>
          <DialogDescription>
            CSV must have <code className="text-xs">name</code> and{" "}
            <code className="text-xs">price</code> columns. Optional: sku, description, stock,
            category, image_url.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="flex flex-col items-center py-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10 text-success">
              <Package className="h-6 w-6" />
            </div>
            <h3 className="mt-3 font-display text-lg font-semibold">
              {result.imported} products imported
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {embedding
                ? "Generating embeddings for semantic search..."
                : "Your catalog is ready."}
            </p>
            <Button className="mt-6" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </div>
        ) : (
          <>
            <div
              className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-8 text-center transition-colors hover:border-primary/50 hover:bg-primary/5 cursor-pointer"
              onClick={() => fileRef.current?.click()}
            >
              <FileSpreadsheet className="h-8 w-8 text-muted-foreground" />
              <p className="mt-2 text-sm font-medium">Click to choose a CSV file</p>
              <p className="mt-1 text-xs text-muted-foreground">
                .csv with headers: name, price, sku, description, stock, category, image_url
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={onFileChange}
              />
            </div>

            {preview.length > 0 && (
              <div className="mt-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">
                    {preview.length} product{preview.length !== 1 ? "s" : ""} found
                  </p>
                  <Button variant="ghost" size="sm" onClick={reset}>
                    <X className="mr-1 h-3.5 w-3.5" /> Clear
                  </Button>
                </div>
                <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-right">Stock</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {preview.slice(0, 20).map((r, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{r.name}</TableCell>
                          <TableCell className="text-right">
                            ₹{(r.price / 100).toLocaleString("en-IN")}
                          </TableCell>
                          <TableCell className="text-right">{r.stock ?? "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button onClick={onUpload} disabled={preview.length === 0 || uploading}>
                {uploading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Import {preview.length} products
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
