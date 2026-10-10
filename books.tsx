import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLoad } from "@/lib/use-load";
import { logActivity } from "@/lib/activity";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/books")({
  head: () => ({ meta: [{ title: "Books — MGSS Library" }] }),
  component: Books,
});

type Book = { id: string; title: string; author: string; isbn: string | null; category: string; total_copies: number; available_copies: number };

function Books() {
  const { role } = Route.useRouteContext();
  const { data, reload } = useLoad(async () => {
    const { data } = await supabase.from("books").select("*").order("title");
    return (data ?? []) as Book[];
  }, [] as Book[]);
  const [q, setQ] = useState("");
  const [f, setF] = useState({ title: "", author: "", isbn: "", category: "General", copies: "1" });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const n = Math.max(1, parseInt(f.copies) || 1);
    const { error } = await supabase.from("books").insert({
      title: f.title.trim(), author: f.author.trim(), isbn: f.isbn.trim() || null,
      category: f.category.trim() || "General", total_copies: n, available_copies: n,
    });
    if (error) { toast.error(error.message); return; }
    await logActivity("Book added", f.title);
    toast.success("Book added");
    setF({ title: "", author: "", isbn: "", category: "General", copies: "1" });
    reload();
  }

  async function remove(b: Book) {
    if (!confirm(`Delete "${b.title}"?`)) return;
    const { error } = await supabase.from("books").delete().eq("id", b.id);
    if (error) { toast.error("Cannot delete — this book may have loan records."); return; }
    await logActivity("Book deleted", b.title);
    reload();
  }

  const list = data.filter((b) => `${b.title} ${b.author} ${b.category}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-semibold">Books</h1>
      <form onSubmit={add} className="grid gap-2 rounded-xl border bg-card p-4 md:grid-cols-6">
        <Input required placeholder="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} className="md:col-span-2" />
        <Input placeholder="Author" value={f.author} onChange={(e) => setF({ ...f, author: e.target.value })} />
        <Input placeholder="ISBN" value={f.isbn} onChange={(e) => setF({ ...f, isbn: e.target.value })} />
        <Input placeholder="Category" value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} />
        <div className="flex gap-2">
          <Input type="number" min={1} value={f.copies} onChange={(e) => setF({ ...f, copies: e.target.value })} className="w-20" />
          <Button type="submit">Add</Button>
        </div>
      </form>
      <Input placeholder="Search books…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr><th className="p-3">Title</th><th className="p-3">Author</th><th className="p-3">Category</th><th className="p-3">Available</th><th /></tr>
          </thead>
          <tbody>
            {list.map((b) => (
              <tr key={b.id} className="border-t">
                <td className="p-3 font-medium">{b.title}</td>
                <td className="p-3">{b.author}</td>
                <td className="p-3">{b.category}</td>
                <td className="p-3">{b.available_copies} / {b.total_copies}</td>
                <td className="p-3 text-right">
                  {role === "admin" && (
                    <Button size="icon" variant="ghost" onClick={() => remove(b)} aria-label="Delete">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
