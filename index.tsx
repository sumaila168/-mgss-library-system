import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpen, Users, ArrowLeftRight, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mzuzu Government Secondary School Library" },
      {
        name: "description",
        content:
          "The digital library of Mzuzu Government Secondary School — manage books, students and borrowing in one place.",
      },
      { property: "og:title", content: "Mzuzu Government Secondary School Library" },
      {
        property: "og:description",
        content:
          "The digital library of Mzuzu Government Secondary School — manage books, students and borrowing in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const features = [
  {
    icon: BookOpen,
    title: "Book Catalogue",
    text: "Keep every title, author and copy count organised by subject.",
  },
  {
    icon: Users,
    title: "Student Records",
    text: "Register learners by admission number and class.",
  },
  {
    icon: ArrowLeftRight,
    title: "Borrow & Return",
    text: "Issue books with due dates and spot overdue loans instantly.",
  },
  {
    icon: ShieldCheck,
    title: "Staff Roles",
    text: "Admins and librarians each get the right level of access.",
  },
];

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <p className="font-display text-sm font-semibold leading-tight">
              Mzuzu Government Secondary School
            </p>
            <p className="text-xs text-muted-foreground">Library Management System</p>
          </div>
        </div>
        <Link
          to="/auth"
          className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Staff sign in
        </Link>
      </header>

      <main className="mx-auto max-w-5xl px-6">
        <section className="py-16 text-center sm:py-24">
          <p className="text-sm font-semibold uppercase tracking-widest text-accent-foreground/70">
            Mzuzu, Malawi
          </p>
          <h1 className="mx-auto mt-4 max-w-2xl text-4xl font-bold leading-tight sm:text-5xl">
            Every book, every student, one simple system.
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
            The school library, organised. Track the catalogue, register students and manage
            borrowing — from any computer in the staff room.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Link
              to="/auth"
              className="rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Open the library
            </Link>
          </div>
        </section>

        <section className="grid gap-4 pb-20 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className="rounded-xl border bg-card p-5">
              <f.icon className="h-6 w-6 text-primary" />
              <h2 className="mt-3 text-base font-semibold">{f.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        Mzuzu Government Secondary School Library
      </footer>
    </div>
  );
}
