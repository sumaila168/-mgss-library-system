import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useLoad } from "@/lib/use-load";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — MGSS Library" }] }),
  component: Dashboard,
});

async function loadStats() {
  const today = new Date().toISOString().slice(0, 10);
  const [books, students, active, overdue, activity] = await Promise.all([
    supabase.from("books").select("id", { count: "exact", head: true }),
    supabase.from("students").select("id", { count: "exact", head: true }),
    supabase.from("loans").select("id", { count: "exact", head: true }).is("returned_at", null),
    supabase
      .from("loans")
      .select("id", { count: "exact", head: true })
      .is("returned_at", null)
      .lt("due_date", today),
    supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(8),
  ]);
  return {
    books: books.count ?? 0,
    students: students.count ?? 0,
    active: active.count ?? 0,
    overdue: overdue.count ?? 0,
    activity: activity.data ?? [],
  };
}

function Dashboard() {
  const { data } = useLoad(loadStats, {
    books: 0, students: 0, active: 0, overdue: 0,
    activity: [] as { id: string; action: string; details: string; created_at: string }[],
  });
  const cards = [
    ["Book titles", data.books],
    ["Students", data.students],
    ["Books on loan", data.active],
    ["Overdue", data.overdue],
  ] as const;
  return (
    <div className="space-y-8">
      <h1 className="font-display text-3xl font-semibold">Dashboard</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map(([label, value]) => (
          <div key={label} className="rounded-xl border bg-card p-5">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-2 font-display text-3xl font-semibold">{value}</p>
          </div>
        ))}
      </div>
      <div className="rounded-xl border bg-card p-5">
        <h2 className="mb-3 font-display text-lg font-semibold">Recent activity</h2>
        {data.activity.length === 0 && <p className="text-sm text-muted-foreground">No activity yet.</p>}
        <ul className="divide-y">
          {data.activity.map((a) => (
            <li key={a.id} className="py-2 text-sm">
              <span className="font-medium">{a.action}</span> — {a.details}
              <span className="ml-2 text-xs text-muted-foreground">
                {new Date(a.created_at).toLocaleString()}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
