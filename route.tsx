import { createFileRoute, Outlet, redirect, Link, useRouter } from "@tanstack/react-router";
import {
  BookOpen,
  LayoutDashboard,
  Users,
  ArrowLeftRight,
  ScrollText,
  LogOut,
  Library,
  GraduationCap,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw redirect({ to: "/auth" });

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    const role = roles?.some((r) => r.role === "admin") ? "admin" : "librarian";

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();

    return { user, role, fullName: profile?.full_name ?? user.email ?? "Staff" };
  },
  component: AuthenticatedLayout,
});

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/books", label: "Books", icon: BookOpen },
  { to: "/students", label: "Students", icon: Users },
  { to: "/teachers", label: "Teachers & Groups", icon: GraduationCap },
  { to: "/loans", label: "Borrow & Return", icon: ArrowLeftRight },
  { to: "/activity", label: "Activity Log", icon: ScrollText },
] as const;

function AuthenticatedLayout() {
  const { role, fullName } = Route.useRouteContext();
  const router = useRouter();

  async function signOut() {
    await supabase.auth.signOut();
    router.navigate({ to: "/auth" });
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="flex w-60 shrink-0 flex-col bg-sidebar text-sidebar-foreground shadow-lg shadow-black/5">
        <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#d9b464] via-[#c7a552] to-[#a77d2d] text-[#173a2d] shadow-md shadow-black/10">
            <Library className="h-5 w-5" />
          </div>
          <div>
            <p className="font-display text-sm font-bold leading-tight tracking-tight">MGSS Library</p>
            <p className="text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/70">Mzuzu Government Sec.</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: false }}
              activeProps={{
                className: "bg-[#d9b464] text-[#173a2d] shadow-sm",
              }}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-sidebar-foreground/80 transition-all duration-200 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="border-t border-sidebar-border bg-[#123b31]/20 px-5 py-4">
          <p className="truncate text-sm font-semibold text-sidebar-foreground">{fullName}</p>
          <p className="text-[10px] uppercase tracking-[0.18em] text-sidebar-foreground/60">{role}</p>
          <button
            onClick={signOut}
            className="mt-3 flex items-center gap-2 text-xs font-medium text-sidebar-foreground/80 transition-colors hover:text-sidebar-foreground"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-6 py-8 lg:px-10">
        <Outlet />
      </main>
    </div>
  );
}
