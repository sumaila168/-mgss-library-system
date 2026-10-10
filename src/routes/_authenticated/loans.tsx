import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useLoad } from "@/lib/use-load";
import { logActivity } from "@/lib/activity";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";

export const Route = createFileRoute("/_authenticated/loans")({
  head: () => ({ meta: [{ title: "Borrow & Return — MGSS Library" }] }),
  component: Loans,
});

type Kind = "student" | "teacher" | "group";
type Loan = {
  id: string; due_date: string; issued_at: string; returned_at: string | null; book_id: string;
  student_id: string | null; teacher_id: string | null; group_id: string | null;
  books: { title: string } | null;
  students: { full_name: string; admission_no: string } | null;
  teachers: { full_name: string; teacher_no: string } | null;
  reading_groups: { name: string; group_no: string } | null;
};
type Opt = { id: string; name: string; code: string };

async function load() {
  const [loans, books, s, t, g] = await Promise.all([
    supabase.from("loans").select("*, books(title), students(full_name, admission_no), teachers(full_name, teacher_no), reading_groups(name, group_no)").order("issued_at", { ascending: false }),
    supabase.from("books").select("id, title, available_copies").order("title"),
    supabase.from("students").select("id, full_name, admission_no").order("full_name"),
    supabase.from("teachers").select("id, full_name, teacher_no").order("full_name"),
    supabase.from("reading_groups").select("id, name, group_no").order("name"),
  ]);
  return {
    loans: (loans.data ?? []) as Loan[],
    books: books.data ?? [],
    student: (s.data ?? []).map((x) => ({ id: x.id, name: x.full_name, code: x.admission_no })),
    teacher: (t.data ?? []).map((x) => ({ id: x.id, name: x.full_name, code: x.teacher_no })),
    group: (g.data ?? []).map((x) => ({ id: x.id, name: x.name, code: x.group_no })),
  };
}

const label: Record<Kind, string> = { student: "Student", teacher: "Teacher", group: "Group" };
const borrower = (l: Loan) =>
  l.students ? `${l.students.full_name} (Student)` : l.teachers ? `${l.teachers.full_name} (Teacher)` : l.reading_groups ? `${l.reading_groups.name} (Group)` : "—";

function Loans() {
  const { user } = Route.useRouteContext();
  const { data, reload } = useLoad(load, { loans: [] as Loan[], books: [] as { id: string; title: string; available_copies: number }[], student: [] as Opt[], teacher: [] as Opt[], group: [] as Opt[] });
  const twoWeeks = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);
  const [kind, setKind] = useState<Kind>("student");
  const [f, setF] = useState({ book_id: "", who: "", due_date: twoWeeks });
  const [filter, setFilter] = useState<"out" | "all">("out");
  const [q, setQ] = useState("");
  const today = new Date().toISOString().slice(0, 10);

  async function issue(e: React.FormEvent) {
    e.preventDefault();
    const book = data.books.find((b) => b.id === f.book_id);
    const person = data[kind].find((p) => p.id === f.who);
    if (!book || !person) { toast.error(`Choose a book and a ${label[kind].toLowerCase()}`); return; }
    if (book.available_copies < 1) { toast.error("No copies available"); return; }
    const { error } = await supabase.from("loans").insert({
      book_id: book.id, due_date: f.due_date, issued_by: user.id,
      student_id: kind === "student" ? person.id : null,
      teacher_id: kind === "teacher" ? person.id : null,
      group_id: kind === "group" ? person.id : null,
    });
    if (error) { toast.error(error.message); return; }
    await supabase.from("books").update({ available_copies: book.available_copies - 1 }).eq("id", book.id);
    await logActivity("Book issued", `${book.title} → ${person.name} (${label[kind]})`);
    toast.success("Book issued");
    setF({ book_id: "", who: "", due_date: twoWeeks });
    reload();
  }

  async function giveBack(l: Loan) {
    const { error } = await supabase.from("loans").update({ returned_at: new Date().toISOString() }).eq("id", l.id);
    if (error) { toast.error(error.message); return; }
    const { data: b } = await supabase.from("books").select("available_copies").eq("id", l.book_id).single();
    if (b) await supabase.from("books").update({ available_copies: b.available_copies + 1 }).eq("id", l.book_id);
    await logActivity("Book returned", `${l.books?.title} ← ${borrower(l)}`);
    toast.success("Book returned");
    reload();
  }

  const rows = data.loans.filter((l) =>
    (filter === "all" || !l.returned_at) &&
    `${l.books?.title} ${borrower(l)}`.toLowerCase().includes(q.toLowerCase()));

  const selectedBorrower = f.who ? data[kind].find((p) => p.id === f.who) : null;
  const selectedBorrowerLoans = selectedBorrower
    ? data.loans.filter((l) => {
        if (kind === "student") return l.student_id === selectedBorrower.id;
        if (kind === "teacher") return l.teacher_id === selectedBorrower.id;
        return l.group_id === selectedBorrower.id;
      })
    : [];

  return (
    <div className="space-y-6">
      <header className="rounded-xl bg-gradient-to-br from-primary to-accent p-6 text-center text-primary-foreground">
        <h1 className="font-display text-3xl font-semibold">Borrow &amp; Return</h1>
        <p className="opacity-90">Lend books to students, teachers, or groups.</p>
      </header>
      <div className="flex flex-wrap justify-center gap-2">
        {(Object.keys(label) as Kind[]).map((k) => (
          <Button key={k} variant={kind === k ? "default" : "outline"} onClick={() => { setKind(k); setF({ ...f, who: "" }); }}>
            {label[k]} Panel
          </Button>
        ))}
      </div>
      <form onSubmit={issue} className="space-y-4 rounded-xl border bg-card p-6 shadow-sm">
        <div>
          <h2 className="text-xl font-semibold">Borrow a Book — {label[kind]}</h2>
          <p className="text-sm text-muted-foreground">Search and pick a book and a {label[kind].toLowerCase()}.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <p className="text-sm font-semibold">Book *</p>
            <Combobox ariaLabel="Select book" placeholder="Choose available book…" searchPlaceholder="Search books by title…" emptyText="No book matches that search."
              value={f.book_id} onChange={(v) => setF({ ...f, book_id: v })}
              options={data.books.map((b) => ({ value: b.id, label: b.title, description: b.available_copies < 1 ? "none left" : `${b.available_copies} left`, disabled: b.available_copies < 1 }))} />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold">{label[kind]} *</p>
            <Combobox ariaLabel={`Select ${kind}`} placeholder={`Select ${label[kind].toLowerCase()}…`} searchPlaceholder="Search by name or ID…" emptyText={`No ${label[kind].toLowerCase()} matches. Add them first.`}
              value={f.who} onChange={(v) => setF({ ...f, who: v })}
              options={data[kind].map((p) => ({ value: p.id, label: p.name, description: p.code }))} />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-semibold">Due date *</p>
            <Input type="date" required value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} />
          </div>
        </div>
        <Button type="submit">Borrow Book</Button>
      </form>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card p-4">
          <h3 className="mb-3 text-lg font-semibold">Books list</h3>
          <div className="space-y-2">
            {data.books.length === 0 ? (
              <p className="text-sm text-muted-foreground">No books available yet.</p>
            ) : (
              data.books.map((book) => (
                <div key={book.id} className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="font-medium">{book.title}</p>
                    <p className="text-xs text-muted-foreground">{book.available_copies} available / {book.total_copies || book.available_copies} total</p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-xs ${book.available_copies > 0 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {book.available_copies > 0 ? "Available" : "Out of stock"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <h3 className="mb-3 text-lg font-semibold">
            {selectedBorrower ? `Books borrowed by ${selectedBorrower.name}` : `Books borrowed by a ${label[kind].toLowerCase()}`}
          </h3>
          {!selectedBorrower ? (
            <p className="text-sm text-muted-foreground">Select a {label[kind].toLowerCase()} to view current loans.</p>
          ) : selectedBorrowerLoans.length === 0 ? (
            <p className="text-sm text-muted-foreground">No books currently borrowed.</p>
          ) : (
            <div className="space-y-2">
              {selectedBorrowerLoans.map((l) => (
                <div key={l.id} className="rounded-md border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">{l.books?.title || "Unknown title"}</p>
                      <p className="text-xs text-muted-foreground">Due: {l.due_date}</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-xs ${l.returned_at ? "bg-secondary text-secondary-foreground" : l.due_date < today ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                      {l.returned_at ? "Returned" : l.due_date < today ? "Overdue" : "On loan"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input className="min-w-48 flex-1" placeholder="Search by book or borrower…" value={q} onChange={(e) => setQ(e.target.value)} />
        <Button variant={filter === "out" ? "default" : "outline"} onClick={() => setFilter("out")}>Not yet returned</Button>
        <Button variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>All records</Button>
      </div>
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr><th className="p-3">Book</th><th className="p-3">Borrower</th><th className="p-3">Due</th><th className="p-3">Status</th><th /></tr>
          </thead>
          <tbody>
            {rows.map((l) => {
              const overdue = !l.returned_at && l.due_date < today;
              return (
                <tr key={l.id} className="border-t">
                  <td className="p-3 font-medium">{l.books?.title}</td>
                  <td className="p-3">{borrower(l)}</td>
                  <td className="p-3">{l.due_date}</td>
                  <td className={`p-3 ${overdue ? "font-semibold text-destructive" : ""}`}>{l.returned_at ? "Returned" : overdue ? "Overdue" : "On loan"}</td>
                  <td className="p-3 text-right">{!l.returned_at && <Button size="sm" variant="outline" onClick={() => giveBack(l)}>Return</Button>}</td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">No records.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
