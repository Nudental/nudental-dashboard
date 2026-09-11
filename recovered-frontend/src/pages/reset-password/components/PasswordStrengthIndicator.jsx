import React from 'react';
import Icon from '../../../components/AppIcon';

const requirements = [
  { id: 'length', label: 'At least 10 characters', test: (p) => p?.length >= 10 },
  { id: 'uppercase', label: 'One uppercase letter (A-Z)', test: (p) => /[A-Z]/?.test(p) },
  { id: 'lowercase', label: 'One lowercase letter (a-z)', test: (p) => /[a-z]/?.test(p) },
  { id: 'number', label: 'One number (0-9)', test: (p) => /[0-9]/?.test(p) },
  { id: 'special', label: 'One special character (!@#$...)', test: (p) => /[^A-Za-z0-9]/?.test(p) },
];

const getStrength = (password) => {
  if (!password) return { score: 0, label: '', color: '' };
  const passed = requirements?.filter((r) => r?.test(password))?.length;
  if (passed <= 1) return { score: 1, label: 'Very Weak', color: 'bg-red-500' };
  if (passed === 2) return { score: 2, label: 'Weak', color: 'bg-orange-400' };
  if (passed === 3) return { score: 3, label: 'Fair', color: 'bg-yellow-400' };
  if (passed === 4) return { score: 4, label: 'Strong', color: 'bg-blue-500' };
  return { score: 5, label: 'Very Strong', color: 'bg-green-500' };
};

const PasswordStrengthIndicator = ({ password }) => {
  const strength = getStrength(password);
  const progressWidth = `${(strength?.score / 5) * 100}%`;

  return (
    <div className="mt-3">
      {/* Progress bar */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-gray-500 font-medium">Password Strength</span>
        {password && (
          <span className={`text-xs font-semibold ${
            strength?.score <= 2 ? 'text-red-500' :
            strength?.score === 3 ? 'text-yellow-600' :
            strength?.score === 4 ? 'text-blue-600' : 'text-green-600'
          }`}>{strength?.label}</span>
        )}
      </div>
      <div className="w-full bg-gray-200 rounded-full h-1.5 mb-3">
        <div
          className={`h-1.5 rounded-full transition-all duration-300 ${strength?.color}`}
          style={{ width: password ? progressWidth : '0%' }}
        />
      </div>
      {/* Requirements checklist */}
      <div className="space-y-1.5">
        {requirements?.map((req) => {
          const passed = password ? req?.test(password) : false;
          return (
            <div key={req?.id} className="flex items-center gap-2">
              <div className={`flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center transition-colors ${
                passed ? 'bg-green-500' : 'bg-gray-200'
              }`}>
                <Icon name={passed ? 'Check' : 'Minus'} size={10} className={passed ? 'text-white' : 'text-gray-400'} />
              </div>
              <span className={`text-xs transition-colors ${passed ? 'text-green-700 font-medium' : 'text-gray-500'}`}>
                {req?.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export { requirements };
export default PasswordStrengthIndicator;
