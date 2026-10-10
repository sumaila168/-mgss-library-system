import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Eraser, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLoad } from "@/lib/use-load";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/activity")({
  head: () => ({ meta: [{ title: "Activity Log — MGSS Library" }] }),
  component: Activity,
});

type Row = { id: string; action: string; details: string; created_at: string; user_id: string | null };

function Activity() {
  const { role } = Route.useRouteContext();
  const { data, loading, reload } = useLoad(async () => {
    const [log, profiles] = await Promise.all([
      supabase.from("activity_log").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("profiles").select("id, full_name"),
    ]);
    const names = new Map((profiles.data ?? []).map((p) => [p.id, p.full_name]));
    return ((log.data ?? []) as Row[]).map((r) => ({ ...r, who: (r.user_id && names.get(r.user_id)) || "—" }));
  }, [] as (Row & { who: string })[]);

  const [q, setQ] = useState("");
  const [clearing, setClearing] = useState(false);

  async function clearHistory() {
    if (!confirm("Clear the whole activity history? This cannot be undone.")) return;
    setClearing(true);
    const { error } = await supabase
      .from("activity_log")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    setClearing(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Activity history cleared");
    reload();
  }

  const list = data.filter((r) =>
    `${r.action} ${r.details} ${r.who}`.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-semibold">Activity Log</h1>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search activity…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {loading ? "Loading…" : `${list.length} of ${data.length} entries`}
        </p>
        {role === "admin" && (
          <Button
            variant="outline"
            size="sm"
            onClick={clearHistory}
            disabled={clearing || data.length === 0}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Eraser className="h-4 w-4" />
            {clearing ? "Clearing…" : "Clear history"}
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr><th className="p-3">When</th><th className="p-3">Staff</th><th className="p-3">Action</th><th className="p-3">Details</th></tr>
          </thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-3 whitespace-nowrap">{new Date(r.created_at).toLocaleString()}</td>
                <td className="p-3">{r.who}</td>
                <td className="p-3 font-medium">{r.action}</td>
                <td className="p-3">{r.details}</td>
              </tr>
            ))}
            {!loading && list.length === 0 && (
              <tr>
                <td className="p-6 text-center text-muted-foreground" colSpan={4}>
                  {data.length === 0 ? "No activity recorded yet." : "No activity matches that search."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
