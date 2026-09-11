import React, { useEffect, useRef } from 'react';

// Lightweight confetti — pure CSS/JS, no external library needed
const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#f97316', '#a855f7'];

const randomBetween = (min, max) => Math.random() * (max - min) + min;

const createParticle = (container) => {
  const el = document.createElement('div');
  const size = randomBetween(6, 12);
  const color = COLORS?.[Math.floor(Math.random() * COLORS?.length)];
  const startX = randomBetween(10, 90);
  const duration = randomBetween(2000, 3500);
  const delay = randomBetween(0, 800);

  el.style.cssText = `
    position: absolute;
    top: -${size * 2}px;
    left: ${startX}%;
    width: ${size}px;
    height: ${size}px;
    background: ${color};
    border-radius: ${Math.random() > 0.5 ? '50%' : '2px'};
    opacity: 1;
    pointer-events: none;
    animation: confettiFall ${duration}ms ${delay}ms ease-in forwards;
    transform: rotate(${randomBetween(0, 360)}deg);
  `;
  container?.appendChild(el);
  setTimeout(() => el?.remove(), duration + delay + 100);
};

const ConfettiCanvas = () => {
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef?.current;
    if (!container) return;

    // Inject keyframes once
    if (!document.getElementById('confetti-keyframes')) {
      const style = document.createElement('style');
      style.id = 'confetti-keyframes';
      style.textContent = `
        @keyframes confettiFall {
          0%   { transform: translateY(0) rotate(0deg); opacity: 1; }
          80%  { opacity: 1; }
          100% { transform: translateY(400px) rotate(720deg); opacity: 0; }
        }
      `;
      document.head?.appendChild(style);
    }

    // Burst of particles
    let count = 0;
    const interval = setInterval(() => {
      for (let i = 0; i < 5; i++) createParticle(container);
      count++;
      if (count >= 12) clearInterval(interval);
    }, 120);

    return () => clearInterval(interval);
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 overflow-hidden pointer-events-none rounded-2xl"
      aria-hidden="true"
    />
  );
};

const BirthdayModal = ({ firstName, onDismiss }) => {
  if (!firstName) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
      onClick={onDismiss}
    >
      <div
        className="relative bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-sm p-6 sm:p-8 text-center overflow-hidden"
        onClick={e => e?.stopPropagation()}
      >
        <ConfettiCanvas />

        {/* Drag handle on mobile */}
        <div className="sm:hidden w-10 h-1 bg-border rounded-full mx-auto mb-4" aria-hidden="true" />

        {/* Cake emoji */}
        <div className="text-5xl sm:text-6xl mb-3 sm:mb-4 select-none" role="img" aria-label="Birthday cake">🎂</div>

        <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-2">
          Happy Birthday, {firstName}!
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed mb-5 sm:mb-6 px-2">
          Wishing you a wonderful day from the NU Dental team 🎉
        </p>

        {/* Decorative dots */}
        <div className="flex justify-center gap-2 mb-5 sm:mb-6" aria-hidden="true">
          {['#6366f1', '#ec4899', '#f59e0b', '#10b981']?.map((c, i) => (
            <span
              key={i}
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        <button
          onClick={onDismiss}
          className="w-full py-3 sm:py-2.5 px-6 bg-primary text-primary-foreground rounded-xl font-semibold text-sm hover:bg-primary/90 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-primary/50 touch-manipulation min-h-[48px] sm:min-h-0"
        >
          Thank you! 🎈
        </button>

        {/* Safe area spacer for iOS home indicator */}
        <div className="sm:hidden h-safe-bottom" style={{ height: 'env(safe-area-inset-bottom, 0px)' }} />
      </div>
    </div>
  );
};

export default BirthdayModal;
