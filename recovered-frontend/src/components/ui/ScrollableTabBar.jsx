import React, { useRef, useState, useEffect, useCallback } from 'react';
import Icon from '../AppIcon';

/**
 * ScrollableTabBar
 *
 * Props:
 *   tabs         – array of { id, label, icon?, badge? }
 *   activeTab    – currently active tab id
 *   onTabChange  – (id) => void
 *   variant      – 'primary' | 'teal' | 'default'  (controls active color)
 *   className    – extra wrapper classes
 *   tabClassName – extra classes applied to every tab button
 */
const ScrollableTabBar = ({
  tabs = [],
  activeTab,
  onTabChange,
  variant = 'primary',
  className = '',
  tabClassName = '',
}) => {
  const scrollRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Determine active-state classes based on variant
  const activeClasses = {
    primary: 'border-primary text-primary',
    teal: 'border-teal-600 text-teal-700 bg-teal-50',
    default: 'border-slate-700 text-slate-800',
  }?.[variant] || 'border-primary text-primary';

  const inactiveClasses =
    'border-transparent text-muted-foreground hover:text-foreground hover:border-border';

  // Update arrow visibility
  const updateArrows = useCallback(() => {
    const el = scrollRef?.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 2);
    setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 2);
  }, []);

  useEffect(() => {
    const el = scrollRef?.current;
    if (!el) return;
    updateArrows();
    el?.addEventListener('scroll', updateArrows, { passive: true });
    const ro = new ResizeObserver(updateArrows);
    ro?.observe(el);
    return () => {
      el?.removeEventListener('scroll', updateArrows);
      ro?.disconnect();
    };
  }, [updateArrows, tabs]);

  // Scroll active tab into view whenever activeTab changes
  useEffect(() => {
    const el = scrollRef?.current;
    if (!el) return;
    const activeBtn = el?.querySelector('[data-active="true"]');
    if (activeBtn) {
      activeBtn?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    }
  }, [activeTab]);

  const scrollBy = (direction) => {
    const el = scrollRef?.current;
    if (!el) return;
    el?.scrollBy({ left: direction * 200, behavior: 'smooth' });
  };

  return (
    <div className={`relative flex items-center ${className}`}>
      {/* Left Arrow */}
      <button
        onClick={() => scrollBy(-1)}
        aria-label="Scroll tabs left"
        className={`
          flex-shrink-0 z-10 flex items-center justify-center w-8 h-full
          bg-gradient-to-r from-white via-white to-transparent
          text-slate-400 hover:text-slate-700 transition-opacity duration-150
          ${canScrollLeft ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
        `}
        tabIndex={canScrollLeft ? 0 : -1}
      >
        <Icon name="ChevronLeft" size={18} />
      </button>
      {/* Scrollable tab list */}
      <div
        ref={scrollRef}
        className="flex-1 flex items-center overflow-x-auto"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        <style>{`.scrollable-tab-inner::-webkit-scrollbar { display: none; }`}</style>
        <div className="flex items-center min-w-max">
          {tabs?.map((tab) => {
            const isActive = tab?.id === activeTab;
            return (
              <button
                key={tab?.id}
                data-active={isActive}
                onClick={() => onTabChange?.(tab?.id)}
                className={`
                  flex items-center gap-2 px-4 py-2.5 text-sm font-medium
                  whitespace-nowrap border-b-2 transition-colors -mb-px
                  ${isActive ? activeClasses : inactiveClasses}
                  ${tabClassName}
                `}
              >
                {tab?.icon && <Icon name={tab?.icon} size={16} />}
                {tab?.label}
                {tab?.badge != null && (
                  <span className="ml-1 min-w-[18px] h-[18px] px-1 bg-yellow-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {tab?.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      {/* Right Arrow */}
      <button
        onClick={() => scrollBy(1)}
        aria-label="Scroll tabs right"
        className={`
          flex-shrink-0 z-10 flex items-center justify-center w-8 h-full
          bg-gradient-to-l from-white via-white to-transparent
          text-slate-400 hover:text-slate-700 transition-opacity duration-150
          ${canScrollRight ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}
        `}
        tabIndex={canScrollRight ? 0 : -1}
      >
        <Icon name="ChevronRight" size={18} />
      </button>
    </div>
  );
};

export default ScrollableTabBar;
