import { MoleculeVisual, HardwareVisual, GeometryVisual } from "./Three3D";
import { HeartVisual, NetworkVisual, CircuitVisual, MemoryVisual, NeuralVisual, BalanceVisual } from "./Svg2D";

export const VISUALS: Record<string, { title: string; subject: string; mode: "3D" | "Interactive 2D"; description: string; Component: () => JSX.Element }> = {
  memory: { title: "Memory: variables, arrays and pointers", subject: "Programming", mode: "Interactive 2D", description: "Step through C code and watch memory cells, addresses and pointers change.", Component: MemoryVisual },
  hardware: { title: "Inside a computer", subject: "Computer hardware", mode: "3D", description: "Rotate an exploded computer, click parts, and watch data flow from storage to CPU.", Component: HardwareVisual },
  network: { title: "How a packet travels", subject: "Computer networks", mode: "Interactive 2D", description: "Send a packet across the internet and inspect each layer of encapsulation.", Component: NetworkVisual },
  circuit: { title: "Circuit simulator: Ohm's law", subject: "Electrical", mode: "Interactive 2D", description: "Change voltage and resistance in series or parallel and see current in real time.", Component: CircuitVisual },
  molecule: { title: "Molecules and bonds", subject: "Chemistry", mode: "3D", description: "Rotate water, methane, CO₂ and ammonia; click atoms and bonds; see VSEPR shapes.", Component: MoleculeVisual },
  geometry: { title: "3D solids: volume and area", subject: "Mathematics", mode: "3D", description: "Resize cubes, spheres, cylinders and cones and watch the formulas update.", Component: GeometryVisual },
  balance: { title: "Equation balance", subject: "Mathematics", mode: "Interactive 2D", description: "Solve 2x + 5 = 17 on a balance scale, one legal step at a time.", Component: BalanceVisual },
  heart: { title: "Human heart and blood flow", subject: "Biology", mode: "Interactive 2D", description: "Click the chambers and vessels; watch oxygenated and deoxygenated blood flow.", Component: HeartVisual },
  neural: { title: "Neural network forward pass", subject: "AI & ML", mode: "Interactive 2D", description: "Adjust inputs and watch signals flow through weighted connections.", Component: NeuralVisual },
};
