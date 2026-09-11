import React from 'react';
import Icon from '../../../components/AppIcon';

const SuccessMessage = ({ email }) => {
  return (
    <div className="text-center">
      <div className="flex justify-center mb-4">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
          <Icon name="MailCheck" size={32} className="text-green-600" />
        </div>
      </div>
      <h2 className="text-xl font-bold text-gray-900 mb-2">Check Your Email</h2>
      <p className="text-sm text-gray-600 mb-4">
        We've sent a password reset link to:
      </p>
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 mb-5">
        <p className="text-sm font-semibold text-blue-800 break-all">{email}</p>
      </div>
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-left mb-5">
        <p className="text-xs font-semibold text-gray-700 mb-2 flex items-center gap-1.5">
          <Icon name="Info" size={14} className="text-gray-500" />
          What to do next:
        </p>
        <ul className="text-xs text-gray-600 space-y-1.5">
          <li className="flex items-start gap-1.5">
            <Icon name="Check" size={13} className="text-green-500 mt-0.5 flex-shrink-0" />
            Click the reset link in the email within <strong>1 hour</strong>
          </li>
          <li className="flex items-start gap-1.5">
            <Icon name="Check" size={13} className="text-green-500 mt-0.5 flex-shrink-0" />
            Check your <strong>spam or junk folder</strong> if you don't see it
          </li>
          <li className="flex items-start gap-1.5">
            <Icon name="Check" size={13} className="text-green-500 mt-0.5 flex-shrink-0" />
            The link can only be used <strong>once</strong>
          </li>
        </ul>
      </div>
      <p className="text-xs text-gray-500">
        Didn't receive the email? Check your spam folder or contact your system administrator.
      </p>
    </div>
  );
};

export default SuccessMessage;
