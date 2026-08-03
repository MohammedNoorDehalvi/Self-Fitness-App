import React, { useEffect, useRef, useState } from 'react';

const INTERACTIVE_SELECTOR = [
  'a',
  'button',
  'img',
  'input',
  'textarea',
  'select',
  '[role="button"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export default function SmoothFollower() {
  const mousePosition = useRef({ x: 0, y: 0 });
  const dotPosition = useRef({ x: 0, y: 0 });
  const borderDotPosition = useRef({ x: 0, y: 0 });
  const animationId = useRef(null);
  const isVisibleRef = useRef(false);

  const [renderPos, setRenderPos] = useState({
    dot: { x: 0, y: 0 },
    border: { x: 0, y: 0 },
  });
  const [isHovering, setIsHovering] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const canUseCustomCursor =
      window.matchMedia('(pointer: fine)').matches &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!canUseCustomCursor) return undefined;

    const initialX = window.innerWidth / 2;
    const initialY = window.innerHeight / 2;
    mousePosition.current = { x: initialX, y: initialY };
    dotPosition.current = { x: initialX, y: initialY };
    borderDotPosition.current = { x: initialX, y: initialY };

    setIsEnabled(true);
    document.body.classList.add('cursor-effects-enabled');

    const handleMouseMove = (event) => {
      mousePosition.current = { x: event.clientX, y: event.clientY };

      if (!isVisibleRef.current) {
        isVisibleRef.current = true;
        setIsVisible(true);
      }
    };

    const handleMouseOver = (event) => {
      setIsHovering(Boolean(event.target.closest(INTERACTIVE_SELECTOR)));
    };

    const handleMouseLeave = () => {
      isVisibleRef.current = false;
      setIsVisible(false);
      setIsHovering(false);
    };

    const lerp = (start, end, factor) => start + (end - start) * factor;

    const animate = () => {
      dotPosition.current.x = lerp(dotPosition.current.x, mousePosition.current.x, 0.2);
      dotPosition.current.y = lerp(dotPosition.current.y, mousePosition.current.y, 0.2);
      borderDotPosition.current.x = lerp(
        borderDotPosition.current.x,
        mousePosition.current.x,
        0.1
      );
      borderDotPosition.current.y = lerp(
        borderDotPosition.current.y,
        mousePosition.current.y,
        0.1
      );

      setRenderPos({
        dot: { x: dotPosition.current.x, y: dotPosition.current.y },
        border: {
          x: borderDotPosition.current.x,
          y: borderDotPosition.current.y,
        },
      });

      animationId.current = window.requestAnimationFrame(animate);
    };

    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseover', handleMouseOver);
    document.documentElement.addEventListener('mouseleave', handleMouseLeave);
    animationId.current = window.requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseover', handleMouseOver);
      document.documentElement.removeEventListener('mouseleave', handleMouseLeave);
      document.body.classList.remove('cursor-effects-enabled');

      if (animationId.current) {
        window.cancelAnimationFrame(animationId.current);
      }
    };
  }, []);

  if (!isEnabled || !isVisible) return null;

  return (
    <div
      aria-hidden="true"
      className="smooth-follower"
      style={{
        pointerEvents: 'none',
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
      }}
    >
      <div
        style={{
          position: 'absolute',
          width: 8,
          height: 8,
          borderRadius: '50%',
          background: 'var(--text-primary)',
          boxShadow: '0 0 14px rgba(0, 212, 255, 0.35)',
          transform: 'translate(-50%, -50%)',
          left: `${renderPos.dot.x}px`,
          top: `${renderPos.dot.y}px`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: isHovering ? 44 : 28,
          height: isHovering ? 44 : 28,
          borderRadius: '50%',
          border: '1px solid var(--accent-cyan)',
          transform: 'translate(-50%, -50%)',
          left: `${renderPos.border.x}px`,
          top: `${renderPos.border.y}px`,
          transition: 'width 0.3s, height 0.3s, border-color 0.3s',
        }}
      />
    </div>
  );
}
