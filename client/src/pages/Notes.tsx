import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Trash2, Bookmark, RotateCcw, NotebookPen, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/AppShell";
import { Markdown } from "@/components/Markdown";
import { api, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

const TABS = [{ k: "note", l: "Notes", i: NotebookPen }, { k: "bookmark", l: "Bookmarks", i: Bookmark }, { k: "revision", l: "Revision list", i: RotateCcw }];

export default function Notes() {
  const [tab, setTab] = useState("note"); const [draft, setDraft] = useState("");
  const { data, isLoading } = useQuery<any[]>({ queryKey: ["/api/notes"] });
  const inv = () => queryClient.invalidateQueries({ queryKey: ["/api/notes"] });
  const del = useMutation({ mutationFn: (id: number) => api("DELETE", `/api/notes/${id}`), onSuccess: inv });
  const add = useMutation({ mutationFn: () => api("POST", "/api/notes", { kind: "note", content: draft }), onSuccess: () => { setDraft(""); inv(); } });
  const list = (data || []).filter((n) => n.kind === tab);
  return (
    <div>
      <PageHeader title="My Notes" subtitle="Saved notes, bookmarked topics and your revision list." />
      <div className="mb-5 flex gap-2">{TABS.map((t) => <button key={t.k} onClick={() => setTab(t.k)} className={cn("flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium", tab === t.k ? "border-primary bg-primary text-primary-foreground" : "bg-card")} data-testid={`tab-notes-${t.k}`}><t.i className="h-4 w-4" />{t.l} <span className="tabular-nums opacity-70">{(data || []).filter((n) => n.kind === t.k).length}</span></button>)}</div>
      {tab === "note" && (
        <div className="mb-5 rounded-xl border bg-card p-4">
          <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} placeholder="Write a personal note (Markdown supported)" data-testid="input-new-note" />
          <Button size="sm" className="mt-2" disabled={!draft.trim() || add.isPending} onClick={() => add.mutate()} data-testid="button-add-note">{add.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Plus className="mr-1.5 h-4 w-4" />}Add note</Button>
        </div>
      )}
      {isLoading ? <Skeleton className="h-40" /> : list.length ? (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((n) => (
            <div key={n.id} className="rounded-xl border bg-card p-4" data-testid={`card-note-${n.id}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">{n.topic ? <Link href={`/learn/${n.topic_id}`} className="font-semibold text-primary hover:underline">{n.topic}</Link> : <p className="font-semibold">Personal note</p>}{n.course && <p className="text-xs text-muted-foreground">{n.course}</p>}</div>
                <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => del.mutate(n.id)} aria-label="Delete" data-testid={`button-delete-note-${n.id}`}><Trash2 className="h-4 w-4" /></Button>
              </div>
              {n.content && <div className="mt-2 max-h-64 overflow-y-auto"><Markdown>{n.content}</Markdown></div>}
              <p className="mt-2 text-xs text-muted-foreground">{new Date(n.created_at + "Z").toLocaleString()}</p>
            </div>
          ))}
        </div>
      ) : <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">{tab === "note" ? "No saved notes yet. Save notes from any lesson, or write one above." : tab === "bookmark" ? "Bookmark topics from the lesson page to find them quickly." : "Mark topics for revision from the lesson page."}</div>}
    </div>
  );
}
