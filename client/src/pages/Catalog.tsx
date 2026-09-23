import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Search, PlayCircle, Award, Layers, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/AppShell";
import { cn } from "@/lib/utils";

export default function Catalog() {
  const initial = new URLSearchParams(window.location.hash.split("?")[1] || "").get("cat") || "all";
  const [cat, setCat] = useState(initial); const [qs, setQs] = useState("");
  const { data: cats } = useQuery<any[]>({ queryKey: ["/api/categories"] });
  const { data: courses, isLoading } = useQuery<any[]>({ queryKey: ["/api/courses"] });
  const list = (courses || []).filter((c) => (cat === "all" ? true : cat === "certifications" ? c.certifiable : c.category === cat))
    .filter((c) => !qs || (c.title + " " + c.description).toLowerCase().includes(qs.toLowerCase()))
    .sort((a, b) => (a.content_status === b.content_status ? 0 : a.content_status === "full" ? -1 : 1));
  return (
    <div>
      <PageHeader title="Courses" subtitle="Course → Subject → Chapter → Topic → Lesson. Full courses have video lessons, notes, practice and tests; outline courses show the syllabus and are being built." />
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="flex flex-wrap gap-2">
          {[{ slug: "all", name: "All" }, ...(cats || [])].map((c) => (
            <button key={c.slug} onClick={() => setCat(c.slug)} className={cn("rounded-full border px-3.5 py-1.5 text-sm font-medium", cat === c.slug ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary")} data-testid={`button-cat-${c.slug}`}>{c.name}</button>
          ))}
        </div>
        <div className="relative md:ml-auto md:w-64"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={qs} onChange={(e) => setQs(e.target.value)} placeholder="Search courses" className="pl-9" data-testid="input-search-courses" /></div>
      </div>
      {isLoading ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-44" />)}</div> : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((c) => (
            <Link key={c.slug} href={`/course/${c.slug}`} className="flex flex-col rounded-xl border bg-card p-5 transition-colors hover:border-primary" data-testid={`card-course-${c.slug}`}>
              <div className="flex flex-wrap gap-1.5">
                {c.content_status === "full" ? <Badge className="bg-emerald-600 hover:bg-emerald-600">Full course</Badge> : <Badge variant="secondary"><Clock className="mr-1 h-3 w-3" />Outline · in production</Badge>}
                {!!c.certifiable && <Badge variant="outline"><Award className="mr-1 h-3 w-3" />Certificate</Badge>}
                {c.level && <Badge variant="outline">{c.level}</Badge>}
              </div>
              <h3 className="mt-3 font-semibold">{c.title}</h3>
              <p className="mt-1 line-clamp-2 flex-1 text-sm text-muted-foreground">{c.description}</p>
              <div className="mt-4 flex gap-4 text-xs text-muted-foreground"><span className="flex items-center gap-1"><Layers className="h-3.5 w-3.5" />{c.chapters} chapters · {c.topics} topics</span>{c.videos > 0 && <span className="flex items-center gap-1"><PlayCircle className="h-3.5 w-3.5" />{c.videos} videos</span>}</div>
              {c.enrolled && <div className="mt-3"><Progress value={c.progress} className="h-1.5" /><p className="mt-1 text-xs text-muted-foreground">{c.progress}% complete</p></div>}
            </Link>
          ))}
          {!list.length && <p className="text-sm text-muted-foreground">No courses match your search.</p>}
        </div>
      )}
    </div>
  );
}
