import React, { useCallback, useEffect, useRef } from 'react';

const DotParticleCanvas = ({
  backgroundColor = '#F5F3F0',
  particleColor = '100, 100, 100',
  animationSpeed = 0.006,
  className = '',
  style,
}) => {
  const canvasRef = useRef(null);
  const requestIdRef = useRef(null);
  const timeRef = useRef(0);
  const lastFrameRef = useRef(0);
  const particles = useRef([]);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const displayWidth = window.innerWidth;
    const displayHeight = window.innerHeight;

    canvas.width = displayWidth * dpr;
    canvas.height = displayHeight * dpr;
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }, []);

  const addClickParticles = useCallback((x, y) => {
    const burstCount = 25 + Math.floor(Math.random() * 15);

    for (let i = 0; i < burstCount; i += 1) {
      const angle = (Math.PI * 2 * i) / burstCount + (Math.random() - 0.5) * 0.5;
      const speed = 2 + Math.random() * 4;

      particles.current.push({
        x: x + (Math.random() - 0.5) * 10,
        y: y + (Math.random() - 0.5) * 10,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: 2000 + Math.random() * 3000,
        size: 1 + Math.random() * 3,
        angle,
      });
    }

    for (let i = 0; i < 8; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.5 + Math.random() * 1.5;

      particles.current.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: 4000 + Math.random() * 2000,
        size: 2 + Math.random() * 2,
        angle,
      });
    }
  }, []);

  const handlePointerDown = useCallback(
    (event) => {
      addClickParticles(event.clientX, event.clientY);
    },
    [addClickParticles]
  );

  const animate = useCallback(
    (now) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const lastFrame = lastFrameRef.current || now;
      const delta = Math.min(32, now - lastFrame || 16);
      const frameScale = delta / 16;

      lastFrameRef.current = now;
      timeRef.current += animationSpeed * frameScale;

      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      if (backgroundColor === 'transparent') {
        ctx.clearRect(0, 0, width, height);
      } else {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, width, height);
      }

      particles.current = particles.current.filter((particle) => {
        particle.life += delta;
        particle.x += particle.vx * frameScale;
        particle.y += particle.vy * frameScale;
        particle.vy += 0.02 * frameScale;
        particle.vx *= 0.995;
        particle.vy *= 0.995;

        particle.x += Math.sin(timeRef.current + particle.angle) * 0.3;
        particle.y += Math.cos(timeRef.current + particle.angle * 0.7) * 0.2;

        const lifeProgress = particle.life / particle.maxLife;
        const alpha = Math.max(0, (1 - lifeProgress) * 0.8);
        const currentSize = particle.size * (1 - lifeProgress * 0.3);

        if (alpha > 0) {
          ctx.fillStyle = `rgba(${particleColor}, ${alpha})`;
          ctx.beginPath();
          ctx.arc(particle.x, particle.y, currentSize, 0, 2 * Math.PI);
          ctx.fill();
        }

        return (
          particle.life < particle.maxLife &&
          particle.x > -50 &&
          particle.x < width + 50 &&
          particle.y > -50 &&
          particle.y < height + 50
        );
      });

      requestIdRef.current = window.requestAnimationFrame(animate);
    },
    [animationSpeed, backgroundColor, particleColor]
  );

  useEffect(() => {
    resizeCanvas();

    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('pointerdown', handlePointerDown);

    requestIdRef.current = window.requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('pointerdown', handlePointerDown);

      if (requestIdRef.current) {
        window.cancelAnimationFrame(requestIdRef.current);
      }

      requestIdRef.current = null;
      lastFrameRef.current = 0;
      timeRef.current = 0;
      particles.current = [];
    };
  }, [animate, handlePointerDown, resizeCanvas]);

  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        backgroundColor,
        pointerEvents: 'none',
        ...style,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
        }}
      />
    </div>
  );
};

export default DotParticleCanvas;
