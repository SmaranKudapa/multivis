import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";
import { MathfieldElement } from "mathlive";
import "mathlive/fonts.css";

// Fonts come from the bundled fonts.css above; sounds are off.
MathfieldElement.fontsDirectory = null;
MathfieldElement.soundsDirectory = null;

declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "math-field": React.DetailedHTMLProps<React.HTMLAttributes<MathfieldElement>, MathfieldElement>;
    }
  }
}

export interface MathEditorHandle {
  /** Replaces the content and puts the cursor in the first empty box. */
  insertTemplate(latex: string): void;
  focus(): void;
}

interface MathEditorProps {
  value: string;
  onChange: (latex: string) => void;
}

/**
 * WYSIWYG math input (MathLive): people edit the rendered integral
 * directly -- type "int" for ∫ with bound boxes, "/" for a fraction, "^"
 * for a power, "sqrt", "pi", "theta", "oo" (∞) and so on; Tab jumps
 * between empty boxes. LaTeX stays the underlying value.
 */
export const MathEditor = forwardRef<MathEditorHandle, MathEditorProps>(function MathEditor({ value, onChange }, ref) {
  const fieldRef = useRef<MathfieldElement>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const mf = fieldRef.current;
    if (!mf) return;
    mf.smartMode = false;
    mf.smartFence = true;
    mf.mathVirtualKeyboardPolicy = "auto";
    mf.inlineShortcuts = {
      ...mf.inlineShortcuts,
      inf: "\\infty",
      infty: "\\infty",
      rho: "\\rho",
      phi: "\\phi",
    };
    const handleInput = () => onChangeRef.current(mf.value);
    mf.addEventListener("input", handleInput);
    return () => mf.removeEventListener("input", handleInput);
  }, []);

  // Push external changes (templates, examples, the LaTeX box) into the field.
  useEffect(() => {
    const mf = fieldRef.current;
    if (mf && mf.value !== value) mf.setValue(value, { silenceNotifications: true });
  }, [value]);

  useImperativeHandle(ref, () => ({
    insertTemplate(latex: string) {
      const mf = fieldRef.current;
      if (!mf) return;
      mf.setValue(latex, { silenceNotifications: true });
      onChangeRef.current(mf.value);
      mf.focus();
      mf.executeCommand("moveToMathfieldStart");
      mf.executeCommand("moveToNextPlaceholder");
    },
    focus() {
      fieldRef.current?.focus();
    },
  }));

  return (
    <math-field ref={fieldRef} className="math-editor" aria-label="Integral editor" />
  );
});
