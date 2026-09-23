import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, RotateCcw, ZoomIn, ZoomOut } from "lucide-react";

export interface PartInfo { name: string; text: string }
type Build = (scene: THREE.Scene, api: { parts: THREE.Object3D[]; setAnim: (f: (t: number) => void) => void; params: any }) => void;

/** Generic interactive 3D stage: orbit (rotate), zoom, click parts, play animation. */
function Stage({ build, params, height = 420, onPick }: { build: Build; params: any; height?: number; onPick: (p: PartInfo | null) => void }) {
  const mount = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(true);
  const playRef = useRef(true);
  const ctl = useRef<{ zoom: (f: number) => void; reset: () => void } | null>(null);
  useEffect(() => { playRef.current = playing; }, [playing]);

  useEffect(() => {
    const el = mount.current!;
    const w = el.clientWidth, h = height;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    renderer.setSize(w, h);
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 200);
    camera.position.set(6, 5, 8);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.minDistance = 3; controls.maxDistance = 30;
    scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const dl = new THREE.DirectionalLight(0xffffff, 1.1); dl.position.set(5, 10, 7); scene.add(dl);
    const dl2 = new THREE.DirectionalLight(0x9db4ff, 0.4); dl2.position.set(-6, 3, -5); scene.add(dl2);
    const parts: THREE.Object3D[] = [];
    let anim: ((t: number) => void) | null = null;
    build(scene, { parts, setAnim: (f) => { anim = f; }, params });

    const ray = new THREE.Raycaster(); const mouse = new THREE.Vector2();
    let selected: THREE.Mesh | null = null; let savedEmissive = 0;
    const onClick = (e: MouseEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      mouse.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(mouse, camera);
      const hit = ray.intersectObjects(parts, true)[0];
      if (selected) ((selected.material as THREE.MeshStandardMaterial).emissive?.setHex(savedEmissive));
      if (hit) {
        let o: THREE.Object3D | null = hit.object; while (o && !o.userData.info) o = o.parent;
        const mesh = hit.object as THREE.Mesh; const mat = mesh.material as THREE.MeshStandardMaterial;
        if (mat.emissive) { savedEmissive = mat.emissive.getHex(); mat.emissive.setHex(0x444400); selected = mesh; }
        onPick(o?.userData.info || null);
      } else { selected = null; onPick(null); }
    };
    renderer.domElement.addEventListener("click", onClick);
    const start = camera.position.clone();
    ctl.current = { zoom: (f) => { camera.position.multiplyScalar(f); }, reset: () => { camera.position.copy(start); controls.target.set(0, 0, 0); } };
    let raf = 0; let t = 0; let last = performance.now();
    const loop = () => {
      const now = performance.now(); const dt = (now - last) / 1000; last = now;
      if (playRef.current) { t += dt; anim?.(t); }
      controls.update(); renderer.render(scene, camera); raf = requestAnimationFrame(loop);
    };
    loop();
    const ro = new ResizeObserver(() => { const nw = el.clientWidth; renderer.setSize(nw, h); camera.aspect = nw / h; camera.updateProjectionMatrix(); });
    ro.observe(el);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); renderer.domElement.removeEventListener("click", onClick); controls.dispose(); renderer.dispose(); scene.traverse((o: any) => { o.geometry?.dispose?.(); o.material?.dispose?.(); }); el.removeChild(renderer.domElement); };
  }, [build, JSON.stringify(params), height]);

  return (
    <div className="relative overflow-hidden rounded-xl border bg-gradient-to-b from-secondary/60 to-background">
      <div ref={mount} style={{ height }} className="w-full cursor-grab active:cursor-grabbing" data-testid="canvas-3d" />
      <div className="absolute right-2 top-2 flex gap-1">
        <Button size="icon" variant="secondary" onClick={() => setPlaying(!playing)} aria-label="Play or pause animation" data-testid="button-3d-play">{playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}</Button>
        <Button size="icon" variant="secondary" onClick={() => ctl.current?.zoom(0.85)} aria-label="Zoom in" data-testid="button-3d-zoom-in"><ZoomIn className="h-4 w-4" /></Button>
        <Button size="icon" variant="secondary" onClick={() => ctl.current?.zoom(1.18)} aria-label="Zoom out" data-testid="button-3d-zoom-out"><ZoomOut className="h-4 w-4" /></Button>
        <Button size="icon" variant="secondary" onClick={() => ctl.current?.reset()} aria-label="Reset view" data-testid="button-3d-reset"><RotateCcw className="h-4 w-4" /></Button>
      </div>
      <p className="pointer-events-none absolute bottom-2 left-3 text-xs text-muted-foreground">Drag to rotate · scroll or pinch to zoom · click a part</p>
    </div>
  );
}

const std = (color: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.1, ...extra });
function tag(o: THREE.Object3D, name: string, text: string) { o.userData.info = { name, text }; return o; }

function InfoPanel({ pick, fallback }: { pick: PartInfo | null; fallback: string }) {
  return (
    <div className="rounded-xl border bg-card p-4" data-testid="panel-part-info">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{pick ? "Selected part" : "Explore"}</p>
      <p className="mt-1 font-semibold">{pick?.name || "Click any part of the model"}</p>
      <p className="mt-1 text-sm text-muted-foreground">{pick?.text || fallback}</p>
    </div>
  );
}

// ---------------- Molecules ----------------
const ATOMS: Record<string, { color: number; r: number; name: string; text: string }> = {
  O: { color: 0xe5484d, r: 0.62, name: "Oxygen (O)", text: "Atomic number 8. Has 6 valence electrons, so it forms 2 covalent bonds. Highly electronegative — it pulls shared electrons towards itself." },
  H: { color: 0xf3f4f6, r: 0.36, name: "Hydrogen (H)", text: "Atomic number 1. One electron, so it forms exactly one covalent bond." },
  C: { color: 0x3a3f4b, r: 0.58, name: "Carbon (C)", text: "Atomic number 6. Four valence electrons → forms 4 bonds (tetravalent). The backbone of organic chemistry." },
  N: { color: 0x3e63dd, r: 0.56, name: "Nitrogen (N)", text: "Atomic number 7. Forms 3 bonds and keeps one lone pair of electrons." },
};
const MOLS: Record<string, { label: string; atoms: [string, number, number, number][]; bonds: [number, number, number][]; info: string }> = {
  water: { label: "Water (H₂O)", atoms: [["O", 0, 0, 0], ["H", 0.95, 0.72, 0], ["H", -0.95, 0.72, 0]], bonds: [[0, 1, 1], [0, 2, 1]], info: "Bent shape with a bond angle of about 104.5° because oxygen's two lone pairs push the hydrogens closer together. This makes water polar." },
  methane: { label: "Methane (CH₄)", atoms: [["C", 0, 0, 0], ["H", 0.9, 0.9, 0.9], ["H", -0.9, -0.9, 0.9], ["H", -0.9, 0.9, -0.9], ["H", 0.9, -0.9, -0.9]], bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 1], [0, 4, 1]], info: "Tetrahedral shape with 109.5° bond angles — four bonding pairs spread as far apart as possible (VSEPR theory)." },
  co2: { label: "Carbon dioxide (CO₂)", atoms: [["C", 0, 0, 0], ["O", 1.6, 0, 0], ["O", -1.6, 0, 0]], bonds: [[0, 1, 2], [0, 2, 2]], info: "Linear molecule (180°) with two C=O double bonds. The bond dipoles cancel, so CO₂ is non-polar." },
  ammonia: { label: "Ammonia (NH₃)", atoms: [["N", 0, 0.3, 0], ["H", 0.95, -0.25, 0], ["H", -0.48, -0.25, 0.82], ["H", -0.48, -0.25, -0.82]], bonds: [[0, 1, 1], [0, 2, 1], [0, 3, 1]], info: "Trigonal pyramidal (about 107°). The lone pair on nitrogen sits on top and pushes the three N–H bonds down." },
};
const buildMolecule: Build = (scene, { parts, setAnim, params }) => {
  const m = MOLS[params.mol]; const g = new THREE.Group(); const s = 1.6;
  const pos = m.atoms.map(([, x, y, z]) => new THREE.Vector3(x * s, y * s, z * s));
  m.atoms.forEach(([el], i) => { const a = ATOMS[el]; const mesh = new THREE.Mesh(new THREE.SphereGeometry(a.r, 40, 40), std(a.color)); mesh.position.copy(pos[i]); tag(mesh, a.name, a.text); g.add(mesh); parts.push(mesh); });
  m.bonds.forEach(([i, j, order]) => {
    for (let k = 0; k < order; k++) {
      const a = pos[i], b = pos[j]; const len = a.distanceTo(b);
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, len, 16), std(0xb8bcc8));
      const off = order === 2 ? (k === 0 ? 0.13 : -0.13) : 0;
      cyl.position.copy(a.clone().add(b).multiplyScalar(0.5)).add(new THREE.Vector3(0, off, off));
      cyl.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      tag(cyl, order === 2 ? "Double covalent bond" : "Single covalent bond", order === 2 ? "Two shared pairs of electrons (4 electrons) between the atoms." : "One shared pair of electrons between two atoms.");
      g.add(cyl); parts.push(cyl);
    }
  });
  scene.add(g);
  setAnim((t) => { g.rotation.y = t * 0.4; g.children.forEach((c, i) => { if ((c as THREE.Mesh).geometry.type === "SphereGeometry" && i > 0) c.position.multiplyScalar(1 + Math.sin(t * 6 + i) * 0.0015); }); });
};
export function MoleculeVisual() {
  const [mol, setMol] = useState("water"); const [pick, setPick] = useState<PartInfo | null>(null);
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <Stage build={buildMolecule} params={{ mol }} onPick={setPick} />
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">{Object.entries(MOLS).map(([k, v]) => <Button key={k} size="sm" variant={mol === k ? "default" : "outline"} onClick={() => { setMol(k); setPick(null); }} data-testid={`button-mol-${k}`}>{v.label}</Button>)}</div>
        <div className="rounded-xl border bg-card p-4"><p className="font-semibold">{MOLS[mol].label}</p><p className="mt-1 text-sm text-muted-foreground">{MOLS[mol].info}</p></div>
        <InfoPanel pick={pick} fallback="Click an atom or a bond to learn about it. The model slowly rotates and the bonds vibrate — press pause to stop." />
      </div>
    </div>
  );
}

// ---------------- Computer hardware ----------------
const HW = [
  { id: "cpu", name: "CPU (Processor)", text: "Executes program instructions: fetch → decode → execute. When you run a compiled C program, its machine code is executed here, one instruction after another, billions per second.", pos: [0, 0.35, -0.4], size: [1.2, 0.25, 1.2], color: 0x9aa4b8 },
  { id: "ram", name: "RAM (Main memory)", text: "Fast, temporary (volatile) memory. Your program and its variables are loaded here while running. Contents are lost when power is off.", pos: [1.7, 0.55, -0.4], size: [0.18, 0.9, 2.4], color: 0x2f9e68 },
  { id: "gpu", name: "GPU (Graphics card)", text: "Thousands of small cores doing many calculations in parallel — used for graphics and for training AI models.", pos: [-0.6, 0.45, 1.6], size: [3.2, 0.45, 0.9], color: 0x3b3f4c },
  { id: "ssd", name: "SSD (Storage)", text: "Non-volatile storage. Your source files (hello.c), the compiler and the final executable are saved here permanently.", pos: [2.4, 0.2, 1.8], size: [1.0, 0.12, 0.7], color: 0x2847d6 },
  { id: "psu", name: "PSU (Power supply)", text: "Converts AC mains electricity into the low DC voltages (12 V, 5 V, 3.3 V) that the components need.", pos: [-2.6, 0.7, -1.4], size: [1.4, 1.2, 1.3], color: 0x5a5f6d },
  { id: "board", name: "Motherboard", text: "The main circuit board. Its buses (copper traces) carry data between CPU, RAM, storage and the GPU.", pos: [0, 0, 0], size: [6.4, 0.12, 5], color: 0x1f5130 },
];
const buildHardware: Build = (scene, { parts, setAnim, params }) => {
  const g = new THREE.Group(); const ex = params.explode as number; const meshes: Record<string, THREE.Mesh> = {};
  HW.forEach((p) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(p.size[0], p.size[1], p.size[2]), std(p.color, { metalness: p.id === "cpu" ? 0.6 : 0.15 }));
    mesh.position.set(p.pos[0] * (p.id === "board" ? 1 : 1 + ex * 0.25), p.pos[1] + (p.id === "board" ? 0 : ex * 1.2), p.pos[2] * (p.id === "board" ? 1 : 1 + ex * 0.25));
    tag(mesh, p.name, p.text); g.add(mesh); parts.push(mesh); meshes[p.id] = mesh;
  });
  const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.2, 24), std(0x222222)); fan.position.copy(meshes.cpu.position).add(new THREE.Vector3(0, 0.25, 0)); tag(fan, "CPU cooler", "Removes heat produced by the CPU so it can run at full speed without damage."); g.add(fan); parts.push(fan);
  const route = [meshes.ssd.position, meshes.ram.position, meshes.cpu.position, meshes.gpu.position].map((v) => v.clone().setY(0.3 + ex * 0.2));
  const pulses = [0, 1, 2].map(() => { const s = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 16), std(0xf5a524, { emissive: 0xf5a524, emissiveIntensity: 0.9 })); g.add(s); return s; });
  scene.add(g);
  setAnim((t) => {
    fan.rotation.y = t * 12;
    pulses.forEach((s, k) => { const u = ((t * 0.35 + k / 3) % 1) * (route.length - 1); const i = Math.floor(u); s.position.lerpVectors(route[i], route[i + 1], u - i); });
  });
};
export function HardwareVisual() {
  const [explode, setExplode] = useState(0.3); const [pick, setPick] = useState<PartInfo | null>(null);
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <Stage build={buildHardware} params={{ explode }} onPick={setPick} />
      <div className="space-y-3">
        <div className="rounded-xl border bg-card p-4"><p className="mb-2 text-sm font-medium">Exploded view</p><Slider value={[explode * 100]} max={100} step={1} onValueChange={(v) => setExplode(v[0] / 100)} data-testid="slider-explode" /></div>
        <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground"><p className="font-semibold text-foreground">Data flow animation</p>The glowing pulses show a program's journey: loaded from <b>SSD</b> → into <b>RAM</b> → executed by the <b>CPU</b> → results drawn by the <b>GPU</b>.</div>
        <InfoPanel pick={pick} fallback="Click the CPU, RAM, GPU, SSD, power supply or motherboard." />
      </div>
    </div>
  );
}

// ---------------- Geometry solids ----------------
const SOLIDS: Record<string, { label: string; vol: (a: number) => string; area: (a: number) => string; formula: string }> = {
  cube: { label: "Cube", vol: (a) => (a ** 3).toFixed(2), area: (a) => (6 * a * a).toFixed(2), formula: "V = a³ · Surface area = 6a²" },
  sphere: { label: "Sphere", vol: (r) => ((4 / 3) * Math.PI * r ** 3).toFixed(2), area: (r) => (4 * Math.PI * r * r).toFixed(2), formula: "V = (4/3)πr³ · Surface area = 4πr²" },
  cylinder: { label: "Cylinder (h = 2r)", vol: (r) => (Math.PI * r * r * 2 * r).toFixed(2), area: (r) => (2 * Math.PI * r * (r + 2 * r)).toFixed(2), formula: "V = πr²h · Surface area = 2πr(r + h)" },
  cone: { label: "Cone (h = 2r)", vol: (r) => ((1 / 3) * Math.PI * r * r * 2 * r).toFixed(2), area: (r) => (Math.PI * r * (r + Math.sqrt(r * r + 4 * r * r))).toFixed(2), formula: "V = (1/3)πr²h · Surface area = πr(r + l), l = √(r² + h²)" },
};
const buildSolid: Build = (scene, { parts, setAnim, params }) => {
  const a = params.a as number; let geo: THREE.BufferGeometry;
  if (params.solid === "cube") geo = new THREE.BoxGeometry(a, a, a);
  else if (params.solid === "sphere") geo = new THREE.SphereGeometry(a, 48, 48);
  else if (params.solid === "cylinder") geo = new THREE.CylinderGeometry(a, a, 2 * a, 48);
  else geo = new THREE.ConeGeometry(a, 2 * a, 48);
  const mesh = new THREE.Mesh(geo, std(0x4f6ff0, { transparent: true, opacity: 0.85 }));
  tag(mesh, SOLIDS[params.solid].label, SOLIDS[params.solid].formula);
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 20), new THREE.LineBasicMaterial({ color: 0xf5a524 }));
  const g = new THREE.Group(); g.add(mesh, edges); scene.add(g); parts.push(mesh);
  const grid = new THREE.GridHelper(12, 12, 0x888888, 0x444444); grid.position.y = -2.2; (grid.material as THREE.Material).opacity = 0.25; (grid.material as THREE.Material).transparent = true; scene.add(grid);
  setAnim((t) => { g.rotation.y = t * 0.5; g.rotation.x = Math.sin(t * 0.3) * 0.2; });
};
export function GeometryVisual() {
  const [solid, setSolid] = useState("cube"); const [a, setA] = useState(1.5); const [pick, setPick] = useState<PartInfo | null>(null);
  const S = SOLIDS[solid];
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <Stage build={buildSolid} params={{ solid, a }} onPick={setPick} />
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">{Object.entries(SOLIDS).map(([k, v]) => <Button key={k} size="sm" variant={solid === k ? "default" : "outline"} onClick={() => setSolid(k)} data-testid={`button-solid-${k}`}>{v.label.split(" ")[0]}</Button>)}</div>
        <div className="rounded-xl border bg-card p-4">
          <p className="mb-2 text-sm font-medium">{solid === "cube" ? "Side a" : "Radius r"} = {a.toFixed(1)} units</p>
          <Slider value={[a * 10]} min={5} max={25} step={1} onValueChange={(v) => setA(v[0] / 10)} data-testid="slider-dimension" />
          <p className="mt-3 font-mono text-sm">{S.formula}</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm"><div className="rounded-lg bg-secondary p-2"><p className="text-xs text-muted-foreground">Volume</p><p className="font-semibold" data-testid="text-volume">{S.vol(a)} u³</p></div><div className="rounded-lg bg-secondary p-2"><p className="text-xs text-muted-foreground">Surface area</p><p className="font-semibold" data-testid="text-area">{S.area(a)} u²</p></div></div>
        </div>
        <InfoPanel pick={pick} fallback="Change the size and watch how volume grows with the cube of the dimension while area grows with the square." />
      </div>
    </div>
  );
}
