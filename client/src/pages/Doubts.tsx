import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/AppShell";
import { DoubtChat } from "@/components/DoubtChat";
import { Camera, Mic, FileText, Languages } from "lucide-react";

export default function Doubts() {
  const { data: hist } = useQuery<any[]>({ queryKey: ["/api/doubts"] });
  return (
    <div>
      <PageHeader title="AI Doubt Solver" subtitle="Text, photo, voice or your own PDF notes. Choose how you want it explained and in which language." />
      <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
        <DoubtChat />
        <aside className="space-y-3">
          <div className="rounded-xl border bg-card p-4 text-sm">
            <p className="font-semibold">How to ask</p>
            <ul className="mt-2 space-y-2 text-muted-foreground">
              <li className="flex gap-2"><Camera className="mt-0.5 h-4 w-4 shrink-0 text-primary" />Photo of a handwritten question, textbook page or error screenshot. If it's unreadable, the tutor will ask you to re-upload.</li>
              <li className="flex gap-2"><Mic className="mt-0.5 h-4 w-4 shrink-0 text-primary" />Speak your question, then press Listen to hear the answer.</li>
              <li className="flex gap-2"><FileText className="mt-0.5 h-4 w-4 shrink-0 text-primary" />Upload a PDF of notes and ask questions about it.</li>
              <li className="flex gap-2"><Languages className="mt-0.5 h-4 w-4 shrink-0 text-primary" />Answers stay in the language you choose.</li>
            </ul>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <p className="text-sm font-semibold">Recent doubts</p>
            {hist?.length ? <ul className="mt-2 space-y-2">{hist.slice(0, 8).map((h) => <li key={h.id} className="text-xs"><p className="line-clamp-2 font-medium">{h.question}</p><p className="text-muted-foreground">{h.input_type} · {h.mode} · {new Date(h.created_at + "Z").toLocaleDateString()}</p></li>)}</ul> : <p className="mt-2 text-xs text-muted-foreground">Your questions will appear here.</p>}
          </div>
        </aside>
      </div>
    </div>
  );
}
