import React from 'react';
import Icon from '../../../components/AppIcon';

const STEPS = [
  { label: 'Metadata', icon: 'Building2' },
  { label: 'Clinical', icon: 'Users' },
  { label: 'Financial A/R', icon: 'CreditCard' },
  { label: 'Operations', icon: 'Activity' },
  { label: 'Finance Add-ons', icon: 'DollarSign' },
  { label: 'Review & Submit', icon: 'CheckCircle' },
];

const StepperNav = ({ currentStep, onStepClick, completedSteps = [] }) => {
  return (
    <div className="flex items-center justify-between mb-8 overflow-x-auto pb-2">
      {STEPS?.map((step, idx) => {
        const stepNum = idx + 1;
        const isActive = currentStep === stepNum;
        const isCompleted = completedSteps?.includes(stepNum);
        const isClickable = isCompleted || stepNum <= Math.max(...completedSteps, currentStep);

        return (
          <React.Fragment key={stepNum}>
            <button
              onClick={() => isClickable && onStepClick(stepNum)}
              className={`flex flex-col items-center gap-1 min-w-[72px] transition-all ${
                isClickable ? 'cursor-pointer' : 'cursor-default'
              }`}
              disabled={!isClickable}
            >
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all ${
                  isActive
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                    : isCompleted
                    ? 'bg-emerald-500 border-emerald-500 text-white' :'bg-white border-slate-200 text-slate-400'
                }`}
              >
                {isCompleted && !isActive ? (
                  <Icon name="Check" size={16} />
                ) : (
                  <span className="text-xs font-bold">{stepNum}</span>
                )}
              </div>
              <span
                className={`text-[10px] font-medium text-center leading-tight ${
                  isActive ? 'text-indigo-600' : isCompleted ? 'text-emerald-600' : 'text-slate-400'
                }`}
              >
                {step?.label}
              </span>
            </button>
            {idx < STEPS?.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-1 mt-[-14px] transition-all ${
                  completedSteps?.includes(stepNum) ? 'bg-emerald-400' : 'bg-slate-200'
                }`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

export default StepperNav;
export { STEPS };
