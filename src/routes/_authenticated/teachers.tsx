import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Trash2, Upload, UserRound, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLoad } from "@/lib/use-load";
import { logActivity } from "@/lib/activity";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/teachers")({
  head: () => ({ meta: [{ title: "Teachers & Groups — MGSS Library" }] }),
  component: TeachersGroups,
});

type Teacher = { id: string; teacher_no: string; full_name: string; subject: string; email: string | null; phone: string | null; photo_url: string | null };
type Group = { id: string; group_no: string; name: string; leader_name: string; member_count: number; description: string; photo_url: string | null };
type Loan = { id: string; teacher_id: string | null; group_id: string | null; due_date: string; returned_at: string | null; books: { title: string } | null };

async function load() {
  const [t, g, l] = await Promise.all([
    supabase.from("teachers").select("*").order("full_name"),
    supabase.from("reading_groups").select("*").order("name"),
    supabase.from("loans").select("id, teacher_id, group_id, due_date, returned_at, books(title)").is("returned_at", null),
  ]);
  return { teachers: (t.data ?? []) as Teacher[], groups: (g.data ?? []) as Group[], loans: (l.data ?? []) as Loan[] };
}

async function uploadLibraryPhoto(file: File, kind: "student" | "teacher" | "group") {
  if (!file) return "";

  if (file.size > 5 * 1024 * 1024) {
    toast.error("Image must be smaller than 5MB.");
    return "";
  }

  const fileExt = file.name.split(".").pop() || "jpg";
  const objectPath = `${kind}s/${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;

  const { error } = await supabase.storage
    .from("library-photos")
    .upload(objectPath, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type || "image/jpeg",
    });

  if (error) {
    console.error(error);
    toast.error("Photo upload failed. Create the Supabase storage bucket named 'library-photos' first.");
    return "";
  }

  const { data } = supabase.storage.from("library-photos").getPublicUrl(objectPath);
  return data.publicUrl;
}

function TeachersGroups() {
  const { role } = Route.useRouteContext();
  const { data, reload } = useLoad(load, { teachers: [] as Teacher[], groups: [] as Group[], loans: [] as Loan[] });
  const [tab, setTab] = useState<"teachers" | "groups">("teachers");
  const [q, setQ] = useState("");
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<{ kind: "t"; item: Teacher } | { kind: "g"; item: Group } | null>(null);
  const emptyT = { teacher_no: "", full_name: "", subject: "", email: "", phone: "", photo_url: "" };
  const emptyG = { group_no: "", name: "", leader_name: "", member_count: "1", description: "", photo_url: "" };
  const [ft, setFt] = useState(emptyT);
  const [fg, setFg] = useState(emptyG);
  const [uploading, setUploading] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (tab === "teachers") {
      const { error } = await supabase.from("teachers").insert({ ...ft, email: ft.email || null, phone: ft.phone || null, photo_url: ft.photo_url || null });
      if (error) { toast.error(error.message); return; }
      await logActivity("Teacher added", ft.full_name);
      setFt(emptyT);
    } else {
      const { error } = await supabase.from("reading_groups").insert({ ...fg, member_count: Number(fg.member_count) || 1, description: fg.description || "", photo_url: fg.photo_url || null });
      if (error) { toast.error(error.message); return; }
      await logActivity("Group added", fg.name);
      setFg(emptyG);
    }
    toast.success("Saved");
    setAdding(false);
    reload();
  }

  async function remove() {
    if (!open || !confirm("Delete this record?")) return;
    const table = open.kind === "t" ? "teachers" : "reading_groups";
    const { error } = await supabase.from(table).delete().eq("id", open.item.id);
    if (error) { toast.error("Cannot delete — there are borrowing records."); return; }
    await logActivity(open.kind === "t" ? "Teacher deleted" : "Group deleted", open.kind === "t" ? open.item.full_name : open.item.name);
    setOpen(null);
    reload();
  }

  const needle = q.toLowerCase();
  const teachers = data.teachers.filter((t) => `${t.full_name} ${t.teacher_no} ${t.subject}`.toLowerCase().includes(needle));
  const groups = data.groups.filter((g) => `${g.name} ${g.group_no} ${g.leader_name}`.toLowerCase().includes(needle));
  const openLoans = open ? data.loans.filter((l) => (open.kind === "t" ? l.teacher_id : l.group_id) === open.item.id) : [];

  return (
    <div className="space-y-6">
      <header className="rounded-xl bg-gradient-to-br from-primary to-accent p-6 text-primary-foreground">
        <h1 className="font-display text-3xl font-semibold">Teachers &amp; Groups</h1>
        <p className="opacity-90">Register teachers and reading groups, and see what they have borrowed.</p>
      </header>
      <div className="flex flex-wrap gap-2">
        {(["teachers", "groups"] as const).map((t) => (
          <Button key={t} variant={tab === t ? "default" : "outline"} onClick={() => { setTab(t); setAdding(false); }}>
            {t === "teachers" ? "Teacher Panel" : "Groups Panel"}
          </Button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 rounded-xl border bg-card p-4">
        <Input className="min-w-48 flex-1" placeholder={tab === "teachers" ? "Search teachers…" : "Search groups…"} value={q} onChange={(e) => setQ(e.target.value)} />
        <Button onClick={() => setAdding((a) => !a)}>{adding ? "Cancel" : tab === "teachers" ? "+ Add Teacher" : "+ Add Group"}</Button>
      </div>

      {adding && (
        <form onSubmit={save} className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-3">
          {tab === "teachers" ? (
            <>
              <Input required placeholder="Teacher ID *" value={ft.teacher_no} onChange={(e) => setFt({ ...ft, teacher_no: e.target.value })} />
              <Input required placeholder="Full name *" value={ft.full_name} onChange={(e) => setFt({ ...ft, full_name: e.target.value })} />
              <Input placeholder="Subject" value={ft.subject} onChange={(e) => setFt({ ...ft, subject: e.target.value })} />
              <Input type="email" placeholder="Email" value={ft.email} onChange={(e) => setFt({ ...ft, email: e.target.value })} />
              <Input placeholder="Phone" value={ft.phone} onChange={(e) => setFt({ ...ft, phone: e.target.value })} />
              <div className="flex items-center gap-3 rounded-md border border-dashed p-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-secondary px-3 py-2 text-sm font-medium">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {uploading ? "Uploading..." : ft.photo_url ? "Change photo" : "Upload photo"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setUploading(true);
                      const url = await uploadLibraryPhoto(file, "teacher");
                      if (url) setFt({ ...ft, photo_url: url });
                      setUploading(false);
                      e.target.value = "";
                    }}
                  />
                </label>
                {ft.photo_url && <img src={ft.photo_url} alt="Teacher preview" className="h-12 w-12 rounded-full object-cover" />}
              </div>
            </>
          ) : (
            <>
              <Input required placeholder="Group ID *" value={fg.group_no} onChange={(e) => setFg({ ...fg, group_no: e.target.value })} />
              <Input required placeholder="Group name *" value={fg.name} onChange={(e) => setFg({ ...fg, name: e.target.value })} />
              <Input required placeholder="Group leader *" value={fg.leader_name} onChange={(e) => setFg({ ...fg, leader_name: e.target.value })} />
              <Input required type="number" min={1} placeholder="Number of members *" value={fg.member_count} onChange={(e) => setFg({ ...fg, member_count: e.target.value })} />
              <Input className="md:col-span-2" placeholder="Description" value={fg.description} onChange={(e) => setFg({ ...fg, description: e.target.value })} />
              <div className="md:col-span-3 flex items-center gap-3 rounded-md border border-dashed p-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-secondary px-3 py-2 text-sm font-medium">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {uploading ? "Uploading..." : fg.photo_url ? "Change photo" : "Upload photo"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setUploading(true);
                      const url = await uploadLibraryPhoto(file, "group");
                      if (url) setFg({ ...fg, photo_url: url });
                      setUploading(false);
                      e.target.value = "";
                    }}
                  />
                </label>
                {fg.photo_url && <img src={fg.photo_url} alt="Group preview" className="h-12 w-12 rounded-full object-cover" />}
              </div>
            </>
          )}
          <Button type="submit" className="md:col-span-3">Save Record</Button>
        </form>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tab === "teachers"
          ? teachers.map((t) => {
              const n = data.loans.filter((l) => l.teacher_id === t.id).length;
              return (
                <button key={t.id} onClick={() => setOpen({ kind: "t", item: t })} className="rounded-xl border bg-card p-5 text-left transition hover:-translate-y-0.5 hover:shadow-md">
                  <Avatar url={t.photo_url} />
                  <h3 className="mt-2 font-semibold">{t.full_name}</h3>
                  <p className="text-sm text-muted-foreground">{t.teacher_no} · {t.subject || "No subject"}</p>
                  <Badge n={n} />
                </button>
              );
            })
          : groups.map((g) => {
              const n = data.loans.filter((l) => l.group_id === g.id).length;
              return (
                <button key={g.id} onClick={() => setOpen({ kind: "g", item: g })} className="rounded-xl border bg-card p-5 text-left transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary"><Users className="h-7 w-7 text-primary" /></div>
                  <h3 className="mt-2 font-semibold">{g.name}</h3>
                  <p className="text-sm text-muted-foreground">{g.group_no} · Leader: {g.leader_name} · {g.member_count} members</p>
                  <Badge n={n} />
                </button>
              );
            })}
      </div>
      {(tab === "teachers" ? teachers : groups).length === 0 && <p className="text-muted-foreground">Nothing here yet.</p>}

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent>
          {open && (
            <>
              <DialogHeader><DialogTitle>{open.kind === "t" ? open.item.full_name : open.item.name}</DialogTitle></DialogHeader>
              <div className="space-y-1 text-sm">
                {open.kind === "t" ? (
                  <>
                    <p>Teacher ID: {open.item.teacher_no}</p>
                    <p>Subject: {open.item.subject || "—"}</p>
                    <p>Email: {open.item.email || "—"}</p>
                    <p>Phone: {open.item.phone || "—"}</p>
                  </>
                ) : (
                  <>
                    <p>Group ID: {open.item.group_no}</p>
                    <p>Leader: {open.item.leader_name}</p>
                    <p>Members: {open.item.member_count}</p>
                    <p>{open.item.description}</p>
                  </>
                )}
              </div>
              <h4 className="mt-3 font-semibold">Books not yet returned</h4>
              {openLoans.length === 0 ? <p className="text-sm text-muted-foreground">None.</p> : (
                <ul className="space-y-1 text-sm">
                  {openLoans.map((l) => (
                    <li key={l.id} className={l.due_date < today ? "text-destructive" : ""}>{l.books?.title} — due {l.due_date}</li>
                  ))}
                </ul>
              )}
              <p className="text-xs text-muted-foreground">To lend a book, use Borrow &amp; Return.</p>
              {role === "admin" && <Button variant="destructive" onClick={remove}><Trash2 className="mr-1 h-4 w-4" />Delete</Button>}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Avatar({ url }: { url: string | null }) {
  return url ? <img src={url} alt="" className="h-16 w-16 rounded-full object-cover" /> : (
    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary"><UserRound className="h-7 w-7 text-primary" /></div>
  );
}

function Badge({ n }: { n: number }) {
  return <span className={`mt-2 inline-block rounded-full px-2.5 py-1 text-xs ${n ? "bg-destructive/10 text-destructive" : "bg-secondary text-secondary-foreground"}`}>{n ? `${n} borrowed` : "No books out"}</span>;
}
