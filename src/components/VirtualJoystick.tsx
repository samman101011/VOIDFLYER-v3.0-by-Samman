import React, { useRef, useState, useEffect } from "react";

interface VirtualJoystickProps {
  onMove: (x: number, y: number) => void;
  title: string;
  size?: number;
}

export const VirtualJoystick: React.FC<VirtualJoystickProps> = ({ onMove, title, size = 96 }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const touchIdRef = useRef<number | null>(null);

  const handleStart = (clientX: number, clientY: number, touchId: number | null) => {
    setIsDragging(true);
    touchIdRef.current = touchId;
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const deltaX = clientX - centerX;
    const deltaY = clientY - centerY;

    const maxRadius = size / 2 - 8; // max drag radius proportional to size
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    let targetX = deltaX;
    let targetY = deltaY;

    if (distance > maxRadius) {
      targetX = (deltaX / distance) * maxRadius;
      targetY = (deltaY / distance) * maxRadius;
    }

    setPosition({ x: targetX, y: targetY });
    onMove(targetX / maxRadius, targetY / maxRadius);
  };

  const handleEnd = () => {
    setIsDragging(false);
    touchIdRef.current = null;
    setPosition({ x: 0, y: 0 });
    onMove(0, 0);
  };

  // Setup non-passive touch listeners to prevent default scrolling on Android
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (isDragging) return;
      const touch = e.changedTouches[0];
      handleStart(touch.clientX, touch.clientY, touch.identifier);
      e.preventDefault();
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isDragging || touchIdRef.current === null) return;
      for (let i = 0; i < e.touches.length; i++) {
        if (e.touches[i].identifier === touchIdRef.current) {
          handleMove(e.touches[i].clientX, e.touches[i].clientY);
          e.preventDefault();
          break;
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (!isDragging || touchIdRef.current === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === touchIdRef.current) {
          handleEnd();
          e.preventDefault();
          break;
        }
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: false });
    el.addEventListener("touchcancel", onTouchEnd, { passive: false });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [isDragging]);

  return (
    <div className="flex flex-col items-center gap-1.5 select-none touch-none">
      <div
        ref={containerRef}
        className="rounded-full border border-blue-500/25 bg-blue-950/20 backdrop-blur-md flex items-center justify-center relative shadow-[inset_0_0_20px_rgba(59,130,246,0.1)]"
        style={{ width: `${size}px`, height: `${size}px` }}
        id={`joystick_${title.replace(/\s+/g, "_").toLowerCase()}`}
      >
        {/* Outer concentric visual ring */}
        <div className="absolute inset-2 rounded-full border border-blue-500/10 pointer-events-none" />

        {/* Joystick Thumb */}
        <div
          className={`w-10 h-10 rounded-full transition-shadow duration-150 absolute flex items-center justify-center cursor-pointer pointer-events-none ${
            isDragging
              ? "bg-blue-400 text-neutral-950 shadow-[0_0_20px_rgba(56,189,248,0.7)] scale-105"
              : "bg-blue-500/40 text-blue-200 border border-blue-400/30"
          }`}
          style={{
            transform: `translate(${position.x}px, ${position.y}px)`,
          }}
        >
          {/* Subtle directional arrows */}
          <div className="grid grid-cols-3 gap-0.5 text-[6px] opacity-45 select-none">
            <div />
            <div className="text-center">▲</div>
            <div />
            <div>◀</div>
            <div className="w-1 h-1 bg-white rounded-full mx-auto self-center" />
            <div>▶</div>
            <div />
            <div className="text-center">▼</div>
            <div />
          </div>
        </div>
      </div>
      <span className="text-[9px] font-mono tracking-widest text-blue-400/60 uppercase select-none">{title}</span>
    </div>
  );
};
