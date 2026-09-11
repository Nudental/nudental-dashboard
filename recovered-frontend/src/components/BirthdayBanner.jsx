import React from 'react';
import Icon from './AppIcon';

/**
 * BirthdayBanner — shown when other active staff have a birthday today.
 * staffNames: string[] — first names of staff with birthday today (no DOB/year/age/UUID)
 * onDismiss: () => void
 *
 * V723: Updated message text to Dr. G's specification.
 *   Single:   "Today is [First Name]'s birthday! Please wish them a happy birthday and help make their day special 🎉" *   Multiple:"Today is [First Name] and [First Name]'s birthday! Please wish them a happy birthday and help make their day special 🎉"
 */
const BirthdayBanner = ({ staffNames, onDismiss }) => {
  if (!staffNames?.length) return null;

  const formatNames = (names) => {
    if (names?.length === 1) return names?.[0];
    if (names?.length === 2) return `${names?.[0]} and ${names?.[1]}`;
    const last = names?.[names?.length - 1];
    const rest = names?.slice(0, -1)?.join(', ');
    return `${rest}, and ${last}`;
  };

  const formattedNames = formatNames(staffNames);
  const message = `Today is ${formattedNames}'s birthday! Please wish them a happy birthday and help make their day special 🎉`;

  return (
    <div
      className="w-full flex items-start sm:items-center justify-between gap-2 sm:gap-3 px-3 sm:px-4 py-2.5 sm:py-3"
      style={{
        background: 'linear-gradient(90deg, #6366f1 0%, #a855f7 50%, #ec4899 100%)',
      }}
      role="banner"
      aria-live="polite"
    >
      <div className="flex items-start sm:items-center gap-2 flex-1 min-w-0">
        <span className="text-base sm:text-lg flex-shrink-0 mt-0.5 sm:mt-0" aria-hidden="true">🎂</span>
        <p className="text-white text-xs sm:text-sm font-medium leading-snug">{message}</p>
      </div>
      <button
        onClick={onDismiss}
        className="flex-shrink-0 p-1.5 rounded-md text-white/80 hover:text-white hover:bg-white/20 active:bg-white/30 transition-colors focus:outline-none focus:ring-2 focus:ring-white/50 touch-manipulation min-w-[32px] min-h-[32px] flex items-center justify-center mt-0.5 sm:mt-0"
        aria-label="Dismiss birthday notification"
      >
        <Icon name="X" size={16} />
      </button>
    </div>
  );
};

export default BirthdayBanner;
