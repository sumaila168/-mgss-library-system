import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Trash2, Upload, UserRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLoad } from "@/lib/use-load";
import { logActivity } from "@/lib/activity";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/students")({
  head: () => ({ meta: [{ title: "Students — MGSS Library" }] }),
  component: Students,
});

type Student = { id: string; admission_no: string; full_name: string; class_name: string; phone: string | null; photo_url: string | null };
type Loan = { id: string; student_id: string | null; issued_at: string; due_date: string; returned_at: string | null; books: { title: string } | null };

async function load() {
  const [s, l] = await Promise.all([
    supabase.from("students").select("*").order("full_name"),
    supabase.from("loans").select("id, student_id, issued_at, due_date, returned_at, books(title)").not("student_id", "is", null).order("issued_at", { ascending: false }),
  ]);
  return { students: (s.data ?? []) as Student[], loans: (l.data ?? []) as Loan[] };
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

function Students() {
  const { role } = Route.useRouteContext();
  const { data, reload } = useLoad(load, { students: [] as Student[], loans: [] as Loan[] });
  const [q, setQ] = useState("");
  const [cls, setCls] = useState("All classes");
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<Student | null>(null);
  const [uploading, setUploading] = useState(false);
  const empty = { admission_no: "", full_name: "", class_name: "", phone: "", photo_url: "" };
  const [f, setF] = useState(empty);
  const today = new Date().toISOString().slice(0, 10);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.from("students").insert({
      admission_no: f.admission_no.trim(), full_name: f.full_name.trim(), class_name: f.class_name.trim(),
      phone: f.phone || null, photo_url: f.photo_url || null,
    });
    if (error) { toast.error(error.message); return; }
    await logActivity("Student added", `${f.full_name} (${f.admission_no})`);
    toast.success("Student added");
    setF(empty); setAdding(false);
    reload();
  }

  async function remove(s: Student) {
    if (!confirm(`Delete ${s.full_name}?`)) return;
    const { error } = await supabase.from("students").delete().eq("id", s.id);
    if (error) { toast.error("Cannot delete — this student has borrowing records."); return; }
    await logActivity("Student deleted", s.full_name);
    setOpen(null);
    reload();
  }

  const classes = ["All classes", ...Array.from(new Set(data.students.map((s) => s.class_name))).sort()];
  const list = data.students.filter((s) =>
    (cls === "All classes" || s.class_name === cls) &&
    `${s.full_name} ${s.admission_no}`.toLowerCase().includes(q.toLowerCase()));
  const out = (id: string) => data.loans.filter((l) => l.student_id === id && !l.returned_at);
  const history = open ? data.loans.filter((l) => l.student_id === open.id) : [];

  return (
    <div className="space-y-6">
      <header className="rounded-xl bg-gradient-to-br from-primary to-accent p-6 text-primary-foreground">
        <h1 className="font-display text-3xl font-semibold">Student Panel</h1>
        <p className="opacity-90">Browse students by class and see what each one has borrowed.</p>
      </header>
      <div className="flex flex-wrap gap-2 rounded-xl border bg-card p-4">
        <Input className="min-w-48 flex-1" placeholder="Search by name or student ID…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button onClick={() => setAdding((a) => !a)}>{adding ? "Cancel" : "+ Add Student"}</Button>
      </div>
      {adding && (
        <form onSubmit={add} className="grid gap-3 rounded-xl border bg-card p-4 md:grid-cols-3">
          <Input required placeholder="Student ID *" value={f.admission_no} onChange={(e) => setF({ ...f, admission_no: e.target.value })} />
          <Input required placeholder="Full name *" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} />
          <Input required placeholder="Class (e.g. Form 3) *" value={f.class_name} onChange={(e) => setF({ ...f, class_name: e.target.value })} />
          <Input placeholder="Phone" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          <div className="md:col-span-2 flex items-center gap-3 rounded-md border border-dashed p-3">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-secondary px-3 py-2 text-sm font-medium">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? "Uploading..." : f.photo_url ? "Change photo" : "Upload photo"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploading(true);
                  const url = await uploadLibraryPhoto(file, "student");
                  if (url) {
                    setF({ ...f, photo_url: url });
                  }
                  setUploading(false);
                  e.target.value = "";
                }}
              />
            </label>
            {f.photo_url && <img src={f.photo_url} alt="Student preview" className="h-12 w-12 rounded-full object-cover" />}
          </div>
          <Button type="submit" className="md:col-span-3">Register</Button>
        </form>
      )}
      <div className="flex flex-wrap gap-2">
        {classes.map((c) => (
          <button key={c} onClick={() => setCls(c)} className={`rounded-full px-4 py-2 text-sm ${cls === c ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>{c}</button>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {list.map((s) => {
          const n = out(s.id).length;
          return (
            <button key={s.id} onClick={() => setOpen(s)} className="flex flex-col items-center rounded-xl border bg-card p-5 text-center transition hover:-translate-y-0.5 hover:shadow-md">
              {s.photo_url ? <img src={s.photo_url} alt="" className="h-20 w-20 rounded-full object-cover" /> : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-secondary"><UserRound className="h-8 w-8 text-primary" /></div>
              )}
              <h3 className="mt-2 font-semibold">{s.full_name}</h3>
              <p className="text-sm text-muted-foreground">{s.admission_no} · {s.class_name}</p>
              <span className={`mt-2 rounded-full px-2.5 py-1 text-xs ${n ? "bg-destructive/10 text-destructive" : "bg-secondary text-secondary-foreground"}`}>{n ? `${n} borrowed` : "No books out"}</span>
            </button>
          );
        })}
      </div>
      {list.length === 0 && <p className="text-muted-foreground">No students found.</p>}

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-2xl">
          {open && (
            <>
              <DialogHeader><DialogTitle>{open.full_name}</DialogTitle></DialogHeader>
              <div className="flex items-center gap-4">
                {open.photo_url ? <img src={open.photo_url} alt="Student" className="h-20 w-20 rounded-full object-cover" /> : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-secondary"><UserRound className="h-8 w-8 text-primary" /></div>
                )}
                <p className="text-sm text-muted-foreground">{open.admission_no} · {open.class_name}{open.phone ? ` · ${open.phone}` : ""}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-muted p-3 text-sm">Books currently borrowed<strong className="block text-2xl">{out(open.id).length}</strong></div>
                <div className="rounded-lg bg-muted p-3 text-sm">Total borrowed<strong className="block text-2xl">{history.length}</strong></div>
              </div>
              <div className="max-h-72 overflow-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-muted-foreground"><tr><th className="p-2">Book</th><th className="p-2">Borrowed</th><th className="p-2">Due date</th><th className="p-2">Status</th></tr></thead>
                  <tbody>
                    {history.map((l) => {
                      const overdue = !l.returned_at && l.due_date < today;
                      return (
                        <tr key={l.id} className="border-t">
                          <td className="p-2">{l.books?.title}</td>
                          <td className="p-2">{l.issued_at.slice(0, 10)}</td>
                          <td className="p-2">{l.due_date}</td>
                          <td className={`p-2 ${overdue ? "font-semibold text-destructive" : ""}`}>{l.returned_at ? "Returned" : overdue ? "Overdue" : "Borrowed"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {role === "admin" && <Button variant="destructive" onClick={() => remove(open)}><Trash2 className="mr-1 h-4 w-4" />Delete student</Button>}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
