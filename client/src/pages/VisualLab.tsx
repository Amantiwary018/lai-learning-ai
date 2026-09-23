import { Link, useParams } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/AppShell";
import { VISUALS } from "@/components/visuals";

export default function VisualLab() {
  const { id } = useParams<{ id?: string }>();
  const V = id ? VISUALS[id] : null;
  if (V) return (
    <div>
      <Link href="/visual"><Button variant="ghost" size="sm" className="mb-3" data-testid="button-back-visuals"><ArrowLeft className="mr-1.5 h-4 w-4" />All visuals</Button></Link>
      <PageHeader title={V.title} subtitle={V.description}><Badge variant="secondary">{V.mode}</Badge></PageHeader>
      <V.Component />
    </div>
  );
  return (
    <div>
      <PageHeader title="Visual & 3D Learning Lab" subtitle="Rotate, zoom, click parts and run simulations. We use 3D only where depth helps understanding; everything else is a clear interactive diagram." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(VISUALS).map(([k, v]) => (
          <Link key={k} href={`/visual/${k}`} className="rounded-xl border bg-card p-5 transition-colors hover:border-primary" data-testid={`card-visual-${k}`}>
            <div className="flex gap-1.5"><Badge variant={v.mode === "3D" ? "default" : "secondary"}>{v.mode}</Badge><Badge variant="outline">{v.subject}</Badge></div>
            <h3 className="mt-3 font-semibold">{v.title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{v.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
