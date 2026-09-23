import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, ChevronRight, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

function useClock(playing: boolean) {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!playing) return; let raf = 0; let last = performance.now();
    const f = () => { const n = performance.now(); setT((x) => x + (n - last) / 1000); last = n; raf = requestAnimationFrame(f); };
    raf = requestAnimationFrame(f); return () => cancelAnimationFrame(raf);
  }, [playing]);
  return t;
}
function Info({ title, text }: { title: string; text: string }) {
  return <div className="rounded-xl border bg-card p-4" data-testid="panel-part-info"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Selected</p><p className="mt-1 font-semibold">{title}</p><p className="mt-1 text-sm text-muted-foreground">{text}</p></div>;
}
const Frame = ({ children }: { children: React.ReactNode }) => <div className="overflow-hidden rounded-xl border bg-gradient-to-b from-secondary/50 to-background p-2">{children}</div>;

// ---------------- Human heart ----------------
const CH: Record<string, { name: string; text: string }> = {
  ra: { name: "Right atrium", text: "Receives deoxygenated blood from the body through the superior and inferior vena cava, then pushes it through the tricuspid valve." },
  rv: { name: "Right ventricle", text: "Pumps deoxygenated blood through the pulmonary valve into the pulmonary artery, towards the lungs." },
  la: { name: "Left atrium", text: "Receives oxygen-rich blood from the lungs via the pulmonary veins and passes it through the mitral (bicuspid) valve." },
  lv: { name: "Left ventricle", text: "The strongest chamber — its thick muscular wall pumps oxygenated blood into the aorta and to the entire body." },
  aorta: { name: "Aorta", text: "The largest artery. Carries oxygen-rich blood from the left ventricle to the body." },
  pa: { name: "Pulmonary artery", text: "The only artery that carries deoxygenated blood — from the right ventricle to the lungs." },
  septum: { name: "Septum", text: "The muscular wall separating the left and right sides so oxygenated and deoxygenated blood never mix." },
};
export function HeartVisual() {
  const [playing, setPlaying] = useState(true); const [sel, setSel] = useState("lv"); const t = useClock(playing);
  const beat = 1 + Math.max(0, Math.sin(t * 7.5)) * 0.035;
  const dots = (path: string, color: string, n: number, speed: number, id: string) => Array.from({ length: n }).map((_, i) => (
    <circle key={id + i} r="5" fill={color}><animateMotion dur={`${speed}s`} repeatCount="indefinite" begin={`${(i * speed) / n}s`} path={path} /></circle>));
  const part = (id: string, d: string, fill: string) => <path d={d} fill={fill} stroke={sel === id ? "#f5a524" : "rgba(0,0,0,.25)"} strokeWidth={sel === id ? 4 : 1.5} className="cursor-pointer" onClick={() => setSel(id)} data-testid={`part-${id}`} />;
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <Frame>
        <svg viewBox="0 0 500 420" className="h-auto w-full">
          <g style={{ transform: `scale(${beat})`, transformOrigin: "250px 240px" }}>
            {part("aorta", "M255 40 C255 10 330 10 335 60 L335 110 L300 110 L300 70 C300 55 285 55 285 70 L285 130 L255 130 Z", "#e5484d")}
            {part("pa", "M200 60 C190 30 150 30 140 60 L150 70 C160 55 175 55 180 75 L190 140 L220 140 Z", "#5b7bd5")}
            {part("ra", "M110 150 C110 110 170 100 200 130 L230 200 L130 230 C115 215 108 190 110 150 Z", "#6d8fe6")}
            {part("rv", "M130 235 L230 205 L250 250 L245 380 C200 360 150 320 130 235 Z", "#4a6cd4")}
            {part("la", "M270 130 C300 100 380 110 390 150 C392 190 380 215 365 230 L265 200 Z", "#ef6b6f")}
            {part("lv", "M265 205 L365 235 C350 320 300 365 255 385 L250 250 Z", "#d93a40")}
            {part("septum", "M230 200 L265 200 L250 250 L255 385 L245 385 L250 250 Z", "#8a2a2e")}
          </g>
          {playing && <>{dots("M60 150 L150 160 L190 250 L205 150 L170 50", "#9db4ff", 5, 3.2, "d")}{dots("M430 150 L340 160 L310 270 L290 110 L320 30", "#ffb3b3", 5, 3.2, "o")}</>}
          <text x="40" y="140" fontSize="13" fill="currentColor" opacity=".7">from body</text><text x="400" y="140" fontSize="13" fill="currentColor" opacity=".7">from lungs</text>
          <text x="120" y="30" fontSize="13" fill="currentColor" opacity=".7">to lungs</text><text x="320" y="25" fontSize="13" fill="currentColor" opacity=".7">to body</text>
        </svg>
      </Frame>
      <div className="space-y-3">
        <Button variant="outline" size="sm" onClick={() => setPlaying(!playing)} data-testid="button-heart-play">{playing ? <Pause className="mr-1 h-4 w-4" /> : <Play className="mr-1 h-4 w-4" />}{playing ? "Pause heartbeat" : "Play heartbeat"}</Button>
        <Info title={CH[sel].name} text={CH[sel].text} />
        <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground"><span className="font-medium text-foreground">Blue dots</span> = deoxygenated blood (right side → lungs). <span className="font-medium text-foreground">Red dots</span> = oxygenated blood (left side → body). Simplified 2D diagram for learning, not anatomically to scale.</div>
      </div>
    </div>
  );
}

// ---------------- Network data flow ----------------
const HOPS = [{ x: 60, label: "Your laptop" }, { x: 190, label: "Wi-Fi router" }, { x: 320, label: "ISP / Internet" }, { x: 450, label: "Web server" }];
const LAYERS = [
  { name: "Application (HTTP)", color: "#2847d6", text: "The browser creates an HTTP request: GET /index.html. This is the actual message." },
  { name: "Transport (TCP)", color: "#2f9e68", text: "TCP adds source/destination ports (e.g. 52100 → 443) and sequence numbers so data arrives complete and in order." },
  { name: "Network (IP)", color: "#f5a524", text: "IP adds source and destination IP addresses so routers can forward the packet across networks." },
  { name: "Link (Ethernet/Wi-Fi)", color: "#e5484d", text: "The frame gets MAC addresses for the next hop only. It is re-wrapped at every router." },
];
export function NetworkVisual() {
  const [layer, setLayer] = useState(4); const [playing, setPlaying] = useState(false); const t = useClock(playing);
  const u = playing ? (t * 0.25) % 1 : 0; const x = 60 + u * 390;
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <Frame>
        <svg viewBox="0 0 510 300" className="h-auto w-full">
          <line x1="60" y1="150" x2="450" y2="150" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" strokeDasharray="6 6" />
          {HOPS.map((h) => (<g key={h.x}><rect x={h.x - 38} y="120" width="76" height="60" rx="10" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="2" /><text x={h.x} y="200" textAnchor="middle" fontSize="12" fill="currentColor">{h.label}</text><text x={h.x} y="156" textAnchor="middle" fontSize="13" fontWeight="700" fill="hsl(var(--primary))">{h.x === 60 ? "PC" : h.x === 190 ? "ROUTER" : h.x === 320 ? "ISP" : "SERVER"}</text></g>))}
          <g transform={`translate(${x - 30}, ${60})`}>
            {LAYERS.slice(0, layer).map((l, i) => <rect key={l.name} x={-(layer - 1 - i) * 5} y={-(layer - 1 - i) * 5} width={60 + (layer - 1 - i) * 10} height={34 + (layer - 1 - i) * 10} rx="6" fill={l.color} opacity={0.35 + i * 0.15} />).reverse()}
            <text x="30" y="22" textAnchor="middle" fontSize="11" fill="white" fontWeight="600">packet</text>
          </g>
        </svg>
      </Frame>
      <div className="space-y-3">
        <div className="flex gap-2"><Button size="sm" onClick={() => setPlaying(!playing)} data-testid="button-network-play">{playing ? <Pause className="mr-1 h-4 w-4" /> : <Play className="mr-1 h-4 w-4" />}{playing ? "Pause" : "Send packet"}</Button></div>
        <div className="space-y-1.5">{LAYERS.map((l, i) => <button key={l.name} onClick={() => setLayer(i + 1)} className={cn("flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm", layer === i + 1 && "border-primary bg-secondary")} data-testid={`button-layer-${i}`}><span className="h-3 w-3 rounded-sm" style={{ background: l.color }} />{i + 1}. {l.name}</button>)}</div>
        <Info title={LAYERS[layer - 1].name} text={LAYERS[layer - 1].text + " Each layer wraps the one above it — this is called encapsulation."} />
      </div>
    </div>
  );
}

// ---------------- Electric circuit ----------------
export function CircuitVisual() {
  const [V, setV] = useState(12); const [R1, setR1] = useState(4); const [R2, setR2] = useState(6); const [mode, setMode] = useState<"series" | "parallel">("series");
  const Req = mode === "series" ? R1 + R2 : (R1 * R2) / (R1 + R2);
  const I = V / Req; const I1 = mode === "series" ? I : V / R1; const I2 = mode === "series" ? I : V / R2;
  const t = useClock(true); const speed = Math.min(4, I) * 60;
  const loop = mode === "series" ? "M60 60 L440 60 L440 260 L60 260 Z" : "M60 60 L440 60 L440 260 L60 260 Z";
  const electrons = Array.from({ length: 14 }).map((_, i) => { const L = 1160; const d = ((t * speed + (i * L) / 14) % L); return d; });
  const pt = (d: number) => { if (d < 380) return [60 + d, 60]; if (d < 580) return [440, 60 + (d - 380)]; if (d < 960) return [440 - (d - 580), 260]; return [60, 260 - (d - 960)]; };
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <Frame>
        <svg viewBox="0 0 500 320" className="h-auto w-full">
          <path d={loop} fill="none" stroke="currentColor" strokeOpacity=".5" strokeWidth="3" />
          <g transform="translate(40,140)"><rect width="40" height="60" rx="4" fill="hsl(var(--chart-2))" /><text x="20" y="35" textAnchor="middle" fontSize="13" fontWeight="700" fill="#1a1a1a">{V}V</text></g>
          {mode === "series" ? (<>
            <g transform="translate(170,45)"><rect width="70" height="30" rx="4" fill="hsl(var(--card))" stroke="hsl(var(--primary))" strokeWidth="2.5" /><text x="35" y="20" textAnchor="middle" fontSize="12" fill="currentColor">R1 {R1}Ω</text></g>
            <g transform="translate(300,45)"><rect width="70" height="30" rx="4" fill="hsl(var(--card))" stroke="hsl(var(--primary))" strokeWidth="2.5" /><text x="35" y="20" textAnchor="middle" fontSize="12" fill="currentColor">R2 {R2}Ω</text></g>
          </>) : (<>
            <path d="M200 60 L200 120 L300 120 L300 60 M200 120 L200 200 L300 200 L300 120" fill="none" stroke="currentColor" strokeOpacity=".5" strokeWidth="3" />
            <g transform="translate(215,105)"><rect width="70" height="30" rx="4" fill="hsl(var(--card))" stroke="hsl(var(--primary))" strokeWidth="2.5" /><text x="35" y="20" textAnchor="middle" fontSize="12" fill="currentColor">R1 {R1}Ω</text></g>
            <g transform="translate(215,185)"><rect width="70" height="30" rx="4" fill="hsl(var(--card))" stroke="hsl(var(--primary))" strokeWidth="2.5" /><text x="35" y="20" textAnchor="middle" fontSize="12" fill="currentColor">R2 {R2}Ω</text></g>
          </>)}
          {electrons.map((d, i) => { const [x, y] = pt(d); return <circle key={i} cx={x} cy={y} r="4" fill="#f5a524" />; })}
          <g transform="translate(360,230)"><rect width="110" height="50" rx="8" fill="hsl(var(--card))" stroke="hsl(var(--border))" /><text x="55" y="22" textAnchor="middle" fontSize="11" fill="currentColor" opacity=".7">Ammeter</text><text x="55" y="40" textAnchor="middle" fontSize="15" fontWeight="700" fill="currentColor">{I.toFixed(2)} A</text></g>
        </svg>
      </Frame>
      <div className="space-y-3">
        <div className="flex gap-2">{(["series", "parallel"] as const).map((m) => <Button key={m} size="sm" variant={mode === m ? "default" : "outline"} onClick={() => setMode(m)} data-testid={`button-circuit-${m}`}>{m === "series" ? "Series" : "Parallel"}</Button>)}</div>
        {[["Voltage V", V, setV, 1, 24, "V"], ["R1", R1, setR1, 1, 20, "Ω"], ["R2", R2, setR2, 1, 20, "Ω"]].map(([l, v, s, mn, mx, u]: any) => (
          <div key={l} className="rounded-lg border bg-card p-3"><p className="mb-2 text-sm">{l} = <b>{v} {u}</b></p><Slider value={[v]} min={mn} max={mx} step={1} onValueChange={(x) => s(x[0])} data-testid={`slider-${String(l).split(" ")[0].toLowerCase()}`} /></div>
        ))}
        <div className="rounded-xl border bg-card p-4 font-mono text-sm" data-testid="text-circuit-result">
          <p>R_eq = {mode === "series" ? `R1 + R2 = ${Req.toFixed(2)}` : `(R1·R2)/(R1+R2) = ${Req.toFixed(2)}`} Ω</p>
          <p>I = V / R_eq = {V}/{Req.toFixed(2)} = <b>{I.toFixed(2)} A</b></p>
          <p className="text-muted-foreground">I₁ = {I1.toFixed(2)} A · I₂ = {I2.toFixed(2)} A</p>
          <p className="text-muted-foreground">P = V·I = {(V * I).toFixed(1)} W</p>
        </div>
        <p className="text-xs text-muted-foreground">Electron speed in the animation is proportional to current (conventional current flows the opposite way).</p>
      </div>
    </div>
  );
}

// ---------------- Memory (variables, arrays, pointers) ----------------
const MEM_STEPS = [
  { code: "int a = 10;", cells: [{ addr: 1000, name: "a", val: "10", type: "int (4 bytes)" }], text: "The compiler reserves 4 bytes for the int variable a at some address (here 1000) and stores 10 there." },
  { code: "int b = a + 5;", cells: [{ addr: 1000, name: "a", val: "10", type: "int" }, { addr: 1004, name: "b", val: "15", type: "int" }], text: "b gets its own memory location. The value of a is read, 5 is added, and 15 is stored in b." },
  { code: "int arr[3] = {7, 8, 9};", cells: [{ addr: 1000, name: "a", val: "10", type: "int" }, { addr: 1004, name: "b", val: "15", type: "int" }, { addr: 1008, name: "arr[0]", val: "7", type: "int" }, { addr: 1012, name: "arr[1]", val: "8", type: "int" }, { addr: 1016, name: "arr[2]", val: "9", type: "int" }], text: "An array is stored in contiguous (side-by-side) memory. arr[i] is at address base + i × sizeof(int)." },
  { code: "int *p = &a;", cells: [{ addr: 1000, name: "a", val: "10", type: "int" }, { addr: 1004, name: "b", val: "15", type: "int" }, { addr: 1008, name: "arr[0]", val: "7", type: "int" }, { addr: 1012, name: "arr[1]", val: "8", type: "int" }, { addr: 1016, name: "arr[2]", val: "9", type: "int" }, { addr: 1020, name: "p", val: "1000", type: "int* (pointer)", ptr: 1000 }], text: "A pointer stores an ADDRESS. p holds 1000 — the address of a. The arrow shows p pointing to a." },
  { code: "*p = 50;", cells: [{ addr: 1000, name: "a", val: "50", type: "int", changed: true }, { addr: 1004, name: "b", val: "15", type: "int" }, { addr: 1008, name: "arr[0]", val: "7", type: "int" }, { addr: 1012, name: "arr[1]", val: "8", type: "int" }, { addr: 1016, name: "arr[2]", val: "9", type: "int" }, { addr: 1020, name: "p", val: "1000", type: "int*", ptr: 1000 }], text: "*p means 'the value at the address in p'. Writing 50 through the pointer changes a itself — a is now 50." },
];
export function MemoryVisual() {
  const [step, setStep] = useState(0); const [sel, setSel] = useState<any>(null); const S = MEM_STEPS[step];
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <Frame>
        <div className="p-3">
          <div className="mb-3 rounded-lg bg-[#0f1629] p-3 font-mono text-sm text-[#dbe4ff]">{MEM_STEPS.slice(0, step + 1).map((s, i) => <div key={i} className={i === step ? "text-[#ffcc66]" : ""}>{i === step ? "▶ " : "  "}{s.code}</div>)}</div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {S.cells.map((c: any) => (
              <button key={c.addr} onClick={() => setSel(c)} className={cn("rounded-lg border-2 bg-card p-2 text-left transition-all", c.changed && "border-amber-500", c.ptr && "border-primary", sel?.addr === c.addr && "ring-2 ring-primary")} data-testid={`cell-${c.addr}`}>
                <p className="font-mono text-[10px] text-muted-foreground">{c.addr}</p><p className="font-mono text-lg font-bold">{c.val}</p><p className="truncate text-xs font-medium">{c.name}</p>
              </button>
            ))}
          </div>
          {S.cells.some((c: any) => c.ptr) && <p className="mt-3 font-mono text-sm text-primary">p ──▶ address 1000 (a)</p>}
        </div>
      </Frame>
      <div className="space-y-3">
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => { setStep(0); setSel(null); }} data-testid="button-mem-reset"><RotateCcw className="mr-1 h-4 w-4" />Reset</Button>
          <Button size="sm" onClick={() => setStep((s) => Math.min(MEM_STEPS.length - 1, s + 1))} disabled={step === MEM_STEPS.length - 1} data-testid="button-mem-next">Next line<ChevronRight className="ml-1 h-4 w-4" /></Button>
        </div>
        <Info title={`Step ${step + 1}: ${S.code}`} text={S.text} />
        {sel && <Info title={`${sel.name} @ ${sel.addr}`} text={`Type: ${sel.type}. Value: ${sel.val}.${sel.ptr ? " This value is an address, so the variable is a pointer." : ""}`} />}
      </div>
    </div>
  );
}

// ---------------- Neural network ----------------
export function NeuralVisual() {
  const [x1, setX1] = useState(0.8); const [x2, setX2] = useState(0.3); const [playing, setPlaying] = useState(true); const t = useClock(playing);
  const W1 = [[0.9, -0.4], [0.3, 0.8], [-0.6, 0.7]]; const W2 = [1.1, -0.7, 0.9];
  const sig = (z: number) => 1 / (1 + Math.exp(-z));
  const h = W1.map((w) => sig(w[0] * x1 + w[1] * x2)); const y = sig(W2.reduce((s, w, i) => s + w * h[i], 0) - 0.4);
  const phase = (t * 0.6) % 1;
  const L0 = [[80, 110], [80, 230]], L1 = [[250, 70], [250, 170], [250, 270]], L2 = [[420, 170]];
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <Frame>
        <svg viewBox="0 0 500 340" className="h-auto w-full">
          {L0.map((a, i) => L1.map((b, j) => <line key={`${i}${j}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={W1[j][i] > 0 ? "#2847d6" : "#e5484d"} strokeWidth={Math.abs(W1[j][i]) * 4} opacity=".55" />))}
          {L1.map((a, j) => <line key={j} x1={a[0]} y1={a[1]} x2={L2[0][0]} y2={L2[0][1]} stroke={W2[j] > 0 ? "#2847d6" : "#e5484d"} strokeWidth={Math.abs(W2[j]) * 4} opacity=".55" />)}
          {playing && L0.map((a, i) => L1.map((b, j) => phase < 0.5 && <circle key={`p${i}${j}`} cx={a[0] + (b[0] - a[0]) * phase * 2} cy={a[1] + (b[1] - a[1]) * phase * 2} r="4" fill="#f5a524" />))}
          {playing && L1.map((a, j) => phase >= 0.5 && <circle key={`q${j}`} cx={a[0] + (L2[0][0] - a[0]) * (phase - 0.5) * 2} cy={a[1] + (L2[0][1] - a[1]) * (phase - 0.5) * 2} r="4" fill="#f5a524" />)}
          {[[L0, [x1, x2], "x"], [L1, h, "h"], [L2, [y], "y"]].map(([L, vals, p]: any) => L.map((c: number[], i: number) => (
            <g key={p + i}><circle cx={c[0]} cy={c[1]} r="26" fill={`hsl(226 76% ${92 - vals[i] * 50}%)`} stroke="hsl(var(--primary))" strokeWidth="2" /><text x={c[0]} y={c[1] + 5} textAnchor="middle" fontSize="13" fontWeight="700" fill={vals[i] > 0.55 ? "white" : "#1a1a1a"}>{vals[i].toFixed(2)}</text></g>)))}
          <text x="80" y="320" textAnchor="middle" fontSize="12" fill="currentColor">Input layer</text><text x="250" y="320" textAnchor="middle" fontSize="12" fill="currentColor">Hidden layer</text><text x="420" y="320" textAnchor="middle" fontSize="12" fill="currentColor">Output</text>
        </svg>
      </Frame>
      <div className="space-y-3">
        <Button size="sm" variant="outline" onClick={() => setPlaying(!playing)} data-testid="button-neural-play">{playing ? <Pause className="mr-1 h-4 w-4" /> : <Play className="mr-1 h-4 w-4" />}{playing ? "Pause signal" : "Play signal"}</Button>
        {[["Input x₁", x1, setX1], ["Input x₂", x2, setX2]].map(([l, v, s]: any) => <div key={l} className="rounded-lg border bg-card p-3"><p className="mb-2 text-sm">{l} = <b>{v.toFixed(2)}</b></p><Slider value={[v * 100]} max={100} step={1} onValueChange={(x) => s(x[0] / 100)} data-testid={`slider-${l.slice(-2)}`} /></div>)}
        <Info title={`Output = ${y.toFixed(3)}`} text="Each neuron computes a weighted sum of its inputs and passes it through an activation function (sigmoid here). Blue lines are positive weights, red are negative; thickness = strength. Training adjusts these weights. A large language model works on the same principle with billions of weights, predicting the next token." />
      </div>
    </div>
  );
}

// ---------------- Equation balance ----------------
const EQ = [
  { l: "2x + 5", r: "17", text: "An equation is a balance: both sides are equal. Goal: get x alone on one side.", lw: ["x", "x", "1", "1", "1", "1", "1"], rw: 17 },
  { l: "2x + 5 − 5", r: "17 − 5", text: "Subtract 5 from BOTH sides. Doing the same thing to both sides keeps the balance level.", lw: ["x", "x"], rw: 12 },
  { l: "2x", r: "12", text: "Now 2x = 12. Two x-blocks balance 12 unit weights.", lw: ["x", "x"], rw: 12 },
  { l: "2x ÷ 2", r: "12 ÷ 2", text: "Divide BOTH sides by 2 to find the value of one x.", lw: ["x"], rw: 6 },
  { l: "x", r: "6", text: "x = 6. Check: 2(6) + 5 = 12 + 5 = 17, which matches.", lw: ["x"], rw: 6 },
];
export function BalanceVisual() {
  const [s, setS] = useState(0); const E = EQ[s];
  const tilt = s === 1 ? -4 : s === 3 ? 3 : 0;
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <Frame>
        <svg viewBox="0 0 500 300" className="h-auto w-full">
          <polygon points="250,160 225,270 275,270" fill="hsl(var(--muted-foreground))" opacity=".6" />
          <g style={{ transform: `rotate(${tilt}deg)`, transformOrigin: "250px 160px", transition: "transform .8s" }}>
            <rect x="60" y="155" width="380" height="10" rx="5" fill="hsl(var(--primary))" />
            <g transform="translate(70,90)">{E.lw.map((w, i) => <g key={i} transform={`translate(${(i % 4) * 34}, ${-Math.floor(i / 4) * 34 + 30})`}><rect width="30" height="30" rx="5" fill={w === "x" ? "#2847d6" : "#f5a524"} /><text x="15" y="20" textAnchor="middle" fontSize="13" fill="white" fontWeight="700">{w}</text></g>)}</g>
            <g transform="translate(300,90)"><rect width="120" height="60" rx="8" fill="#f5a524" /><text x="60" y="38" textAnchor="middle" fontSize="18" fontWeight="700" fill="#1a1a1a">{E.rw} units</text></g>
          </g>
          <text x="250" y="45" textAnchor="middle" fontSize="28" className="font-hand" fill="currentColor">{E.l} = {E.r}</text>
        </svg>
      </Frame>
      <div className="space-y-3">
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setS(0)} data-testid="button-eq-reset"><RotateCcw className="mr-1 h-4 w-4" />Reset</Button>
          <Button size="sm" onClick={() => setS((x) => Math.min(EQ.length - 1, x + 1))} disabled={s === EQ.length - 1} data-testid="button-eq-next">Next step<ChevronRight className="ml-1 h-4 w-4" /></Button>
        </div>
        <Info title={`Step ${s + 1} of ${EQ.length}`} text={E.text} />
      </div>
    </div>
  );
}
