import { useEffect, useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import QRCode from "qrcode";
import { Award, Printer, ShieldCheck, ShieldX, Search, Loader2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/AppShell";
import { LogoMark } from "@/components/Logo";
import { api } from "@/lib/queryClient";

const verifyLink = (id: string) => `${window.location.origin}${window.location.pathname}#/verify/${id}`;
const fmtDate = (s: string) => new Date(s.replace(" ", "T") + "Z").toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });

export function Certificates() {
  const { data, isLoading } = useQuery<any[]>({ queryKey: ["/api/certificates"] });
  return (
    <div>
      <PageHeader title="Certificates" subtitle="LAI Certificates of Completion you have earned. Each has a unique ID and a public verification page." />
      {isLoading ? <Skeleton className="h-32" /> : data?.length ? (
        <div className="grid gap-4 md:grid-cols-2">{data.map((c) => (
          <Link key={c.id} href={`/certificate/${c.id}`} className="flex items-center gap-4 rounded-xl border bg-card p-5 hover:border-primary" data-testid={`card-cert-${c.id}`}>
            <Award className="h-10 w-10 shrink-0 text-primary" />
            <div className="min-w-0"><p className="font-semibold">{c.course_title}</p><p className="text-xs text-muted-foreground">{c.id} · {fmtDate(c.issued_at)}{c.status !== "valid" ? " · revoked" : ""}</p></div>
          </Link>))}</div>
      ) : <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">No certificates yet. Complete all topics of a certification course, pass the final assessment and the project to earn one.<div className="mt-4"><Link href="/courses?cat=certifications"><Button variant="outline">See certification courses</Button></Link></div></div>}
    </div>
  );
}

export function CertificateView() {
  const { id } = useParams<{ id: string }>();
  const [c, setC] = useState<any>(null); const [err, setErr] = useState(""); const [qr, setQr] = useState("");
  useEffect(() => {
    api<any>("GET", `/api/certificates/${id}/verify`).then(setC).catch((e) => setErr(e.message));
    QRCode.toDataURL(verifyLink(id), { margin: 1, width: 220, color: { dark: "#1b2a6b", light: "#ffffff" } }).then(setQr).catch(() => {});
  }, [id]);
  if (err) return <p className="text-sm text-destructive">{err}</p>;
  if (!c) return <Skeleton className="aspect-[1.414] w-full max-w-4xl" />;
  return (
    <div>
      <div className="no-print mb-4 flex flex-wrap gap-2">
        <Button onClick={() => window.print()} data-testid="button-print"><Printer className="mr-2 h-4 w-4" />Print / Save as PDF</Button>
        <Button variant="outline" onClick={() => navigator.clipboard?.writeText(verifyLink(id))} data-testid="button-copy-verify"><Copy className="mr-2 h-4 w-4" />Copy verification link</Button>
        <Link href={`/verify/${id}`}><Button variant="outline" data-testid="button-open-verify">Open verification page</Button></Link>
      </div>
      <div className="mx-auto aspect-[1.414] w-full max-w-4xl overflow-hidden rounded-lg bg-[#fbf8f1] p-[3%] text-[#1b2238] shadow-xl" data-testid="certificate">
        <div className="relative flex h-full flex-col rounded border-[3px] border-[#1b2a6b] p-[4%]">
          <div className="absolute inset-[6px] rounded border border-[#c9a13b]" />
          <div className="relative flex items-center gap-3"><LogoMark className="h-[clamp(28px,5vw,48px)] w-[clamp(28px,5vw,48px)]" /><div><p className="font-display text-[clamp(14px,2.2vw,22px)] font-extrabold tracking-tight">LAI – Learning AI</p><p className="text-[clamp(8px,1vw,11px)] uppercase tracking-[0.2em] text-[#5b6480]">See it · Interact · Build · Prove</p></div></div>
          <div className="relative flex flex-1 flex-col items-center justify-center text-center">
            <p className="text-[clamp(9px,1.2vw,13px)] uppercase tracking-[0.3em] text-[#8a6d1f]">Certificate of Completion</p>
            <p className="mt-[2%] text-[clamp(10px,1.3vw,14px)] text-[#5b6480]">This certifies that</p>
            <p className="mt-[1%] font-hand text-[clamp(24px,5vw,54px)] leading-tight text-[#1b2a6b]" data-testid="text-cert-name">{c.student_name}</p>
            <p className="mt-[1%] text-[clamp(10px,1.3vw,14px)] text-[#5b6480]">has successfully completed the course</p>
            <p className="mt-[1%] font-display text-[clamp(16px,3vw,32px)] font-bold" data-testid="text-cert-course">{c.course_title}</p>
            <p className="mt-[1.5%] max-w-[70%] text-[clamp(8px,1.05vw,12px)] text-[#5b6480]">including all lessons and topic tests, the final assessment{c.score != null ? ` (score ${c.score}%)` : ""} and a reviewed final project.</p>
          </div>
          <div className="relative flex items-end justify-between gap-4 text-[clamp(8px,1vw,12px)]">
            <div><p className="text-[#5b6480]">Date of issue</p><p className="font-semibold">{fmtDate(c.issued_at)}</p><p className="mt-2 text-[#5b6480]">Certificate ID</p><p className="font-mono font-semibold" data-testid="text-cert-id">{c.id}</p></div>
            <div className="text-center"><p className="font-hand text-[clamp(14px,2vw,22px)] text-[#1b2a6b]">Aman Kumar Tiwary</p><div className="mx-auto my-1 h-px w-[clamp(90px,16vw,180px)] bg-[#1b2238]" /><p className="text-[#5b6480]">Founder, LAI – Learning AI</p></div>
            <div className="text-center">{qr && <img src={qr} alt="QR code linking to the verification page" className="h-[clamp(56px,10vw,110px)] w-[clamp(56px,10vw,110px)]" />}<p className="mt-1 text-[#5b6480]">Scan to verify</p></div>
          </div>
          {!c.valid && <div className="absolute inset-0 flex items-center justify-center"><span className="rotate-[-18deg] rounded border-4 border-red-600 px-6 py-2 text-4xl font-extrabold uppercase text-red-600 opacity-80">Revoked</span></div>}
        </div>
      </div>
      <p className="no-print mx-auto mt-3 max-w-4xl text-center text-xs text-muted-foreground">Issued by LAI – Learning AI. This is not a certificate from OpenAI, Google, Anthropic, Microsoft or any other company.</p>
    </div>
  );
}

export function Verify() {
  const params = useParams<{ id?: string }>(); const [, nav] = useLocation();
  const [id, setId] = useState(params.id || ""); const [r, setR] = useState<any>(null); const [busy, setBusy] = useState(false);
  const check = async (v = id) => {
    if (!v.trim()) return; setBusy(true); setR(null);
    try { setR(await api("GET", `/api/certificates/${encodeURIComponent(v.trim())}/verify`)); } catch (e: any) { setR({ valid: false, notFound: true, message: e.message }); } finally { setBusy(false); }
  };
  useEffect(() => { if (params.id) { setId(params.id); check(params.id); } }, [params.id]);
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Verify a LAI certificate" subtitle="Enter the certificate ID printed on the certificate, or scan its QR code." />
      <form onSubmit={(e) => { e.preventDefault(); nav(`/verify/${id.trim().toUpperCase()}`); check(); }} className="flex gap-2">
        <Input value={id} onChange={(e) => setId(e.target.value)} placeholder="LAI-2026-XXXX-XXXX" className="font-mono" data-testid="input-verify-id" />
        <Button type="submit" disabled={busy} data-testid="button-verify">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="mr-1.5 h-4 w-4" />}Verify</Button>
      </form>
      {r && (r.valid ? (
        <div className="mt-5 rounded-xl border border-emerald-500/50 bg-emerald-500/10 p-5" data-testid="panel-verify-valid">
          <p className="flex items-center gap-2 font-semibold text-emerald-700 dark:text-emerald-400"><ShieldCheck className="h-5 w-5" />Valid certificate</p>
          <dl className="mt-3 grid grid-cols-[120px_1fr] gap-y-1.5 text-sm"><dt className="text-muted-foreground">Name</dt><dd className="font-medium">{r.student_name}</dd><dt className="text-muted-foreground">Course</dt><dd className="font-medium">{r.course_title}</dd><dt className="text-muted-foreground">Issued</dt><dd>{fmtDate(r.issued_at)}</dd><dt className="text-muted-foreground">ID</dt><dd className="font-mono">{r.id}</dd></dl>
          <Link href={`/certificate/${r.id}`}><Button size="sm" variant="outline" className="mt-4">View certificate</Button></Link>
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-destructive/50 bg-destructive/10 p-5" data-testid="panel-verify-invalid">
          <p className="flex items-center gap-2 font-semibold text-destructive"><ShieldX className="h-5 w-5" />{r.notFound ? "Not found" : "Certificate revoked"}</p>
          <p className="mt-1 text-sm">{r.notFound ? "No LAI certificate exists with this ID. Check for typos." : `This certificate for ${r.course_title} was revoked and is no longer valid.`}</p>
        </div>
      ))}
    </div>
  );
}
