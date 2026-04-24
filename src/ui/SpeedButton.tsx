import { Zap } from "lucide-react";
import { useEffect, useState } from "react";

interface Props {
  initialSpeed: number;
  disabled: boolean;
  speeds: number[];
  onSpeedChange: (speed: number) => void;
}

function nextSpeed(current: number, speeds: number[]) {
  if (speeds.length === 0) return current;
  const index = speeds.indexOf(current);
  return speeds[(index + 1) % speeds.length] ?? speeds[0];
}

export function SpeedButton({ initialSpeed, disabled, speeds, onSpeedChange }: Props) {
  const [displaySpeed, setDisplaySpeed] = useState(initialSpeed);

  useEffect(() => {
    setDisplaySpeed(initialSpeed);
  }, [initialSpeed]);

  const handleClick = () => {
    const speed = nextSpeed(displaySpeed, speeds);
    setDisplaySpeed(speed);
    onSpeedChange(speed);
  };

  return (
    <button className="speed-button" onClick={handleClick} disabled={disabled} title="点击循环切换徐进速度">
      <Zap size={18} /> 速度：{displaySpeed}x
    </button>
  );
}
