const BOX = "\\placeholder{}";
const BOUNDS = `\\int_{${BOX}}^{${BOX}}`;

export interface Template {
  label: string;
  symbol: string;
  latex: string;
}

/** Empty integrals to fill in. The Jacobian is pre-filled for the curvilinear systems. */
export const TEMPLATES: Template[] = [
  { label: "Single", symbol: "∫ dx", latex: `${BOUNDS}${BOX}\\,dx` },
  { label: "Double", symbol: "∬ dy dx", latex: `${BOUNDS}${BOUNDS}${BOX}\\,dy\\,dx` },
  { label: "Triple", symbol: "∭ dz dy dx", latex: `${BOUNDS}${BOUNDS}${BOUNDS}${BOX}\\,dz\\,dy\\,dx` },
  { label: "Polar", symbol: "r dr dθ", latex: `${BOUNDS}${BOUNDS}${BOX}\\cdot r\\,dr\\,d\\theta` },
  { label: "Cylindrical", symbol: "r dz dr dθ", latex: `${BOUNDS}${BOUNDS}${BOUNDS}${BOX}\\cdot r\\,dz\\,dr\\,d\\theta` },
  {
    label: "Spherical",
    symbol: "ρ² sin φ dρ dφ dθ",
    latex: `${BOUNDS}${BOUNDS}${BOUNDS}${BOX}\\cdot\\rho^2\\sin\\phi\\,d\\rho\\,d\\phi\\,d\\theta`,
  },
];

export interface Example {
  label: string;
  latex: string;
}

export const EXAMPLES: Example[] = [
  { label: "Area under sin x", latex: "\\int_{0}^{\\pi}\\sin x\\,dx" },
  { label: "Volume under a paraboloid over a disk", latex: "\\int_{-1}^{1}\\int_{-\\sqrt{1-x^2}}^{\\sqrt{1-x^2}}\\left(x^2+y^2\\right)dy\\,dx" },
  { label: "Region between y = x² and y = √x", latex: "\\int_{0}^{1}\\int_{x^2}^{\\sqrt{x}}1\\,dy\\,dx" },
  { label: "Area of a cardioid (polar)", latex: "\\int_{0}^{2\\pi}\\int_{0}^{1+\\cos\\theta}r\\,dr\\,d\\theta" },
  { label: "Gaussian over the whole plane (infinite)", latex: "\\int_{-\\infty}^{\\infty}\\int_{-\\infty}^{\\infty}e^{-x^2-y^2}dy\\,dx" },
  { label: "Tetrahedron", latex: "\\int_{0}^{1}\\int_{0}^{1-x}\\int_{0}^{1-x-y}1\\,dz\\,dy\\,dx" },
  { label: "Twisted solid with density y", latex: "\\int_{-1}^{1}\\int_{x/2-1}^{x+1}\\int_{xy-1}^{xy+1}y\\,dz\\,dy\\,dx" },
  { label: "Ice-cream cone (cylindrical)", latex: "\\int_{0}^{2\\pi}\\int_{0}^{1}\\int_{r}^{\\sqrt{2-r^2}}r\\,dz\\,dr\\,d\\theta" },
  { label: "Volume of a ball (spherical)", latex: "\\int_{0}^{2\\pi}\\int_{0}^{\\pi}\\int_{0}^{1}\\rho^2\\sin\\phi\\,d\\rho\\,d\\phi\\,d\\theta" },
  { label: "Bounds that cross (legal, not graphable)", latex: "\\int_{-1}^{1}\\int_{0}^{x}1\\,dy\\,dx" },
];
