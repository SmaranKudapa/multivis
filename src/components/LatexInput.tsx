interface LatexInputProps {
  value: string;
  onChange: (value: string) => void;
}

export function LatexInput({ value, onChange }: LatexInputProps) {
  return (
    <textarea
      className="latex-input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      spellCheck={false}
      placeholder="\int_{0}^{1}\int_{x^2}^{\sqrt{x}} 1 \, dy\, dx"
      aria-label="Integral in LaTeX"
    />
  );
}
