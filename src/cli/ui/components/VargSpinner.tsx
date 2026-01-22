import { useEffect, useState } from "react";
import { theme } from "../theme.ts";

interface VargSpinnerProps {
  label?: string;
}

export function VargSpinner({ label }: VargSpinnerProps) {
  const [frame, setFrame] = useState(0);
  const frames = theme.animation.spinnerFrames;

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame((f) => (f + 1) % frames.length);
    }, theme.animation.spinnerInterval);

    return () => clearInterval(timer);
  }, [frames.length]);

  return (
    <text>
      <span fg={theme.colors.accent}>{frames[frame]}</span>
      {label && ` ${label}`}
    </text>
  );
}

export default VargSpinner;
