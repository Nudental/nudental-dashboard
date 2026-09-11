import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from '../../components/AppIcon';
import ForgotPasswordForm from './components/ForgotPasswordForm';
import SuccessMessage from './components/SuccessMessage';

const ForgotPassword = () => {
  const [submitted, setSubmitted] = useState(false);
  const [sentEmail, setSentEmail] = useState('');
  const navigate = useNavigate();

  const handleSuccess = (email) => {
    setSentEmail(email);
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        {/* Back to Home */}
        <div className="mb-3">
          <button
            onClick={() => navigate('/login')}
            className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
          >
            <Icon name="ChevronLeft" size={16} />
            Back to Home
          </button>
        </div>
        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-8 py-6 text-center">
            <img
              src="/assets/images/nu-dental-stacked-logo_1_-1772244427227.png"
              alt="NU Dental logo"
              className="h-12 w-auto object-contain mx-auto mb-3 brightness-0 invert"
            />
            <p className="text-blue-100 text-xs font-medium tracking-wide uppercase">Practice Management Portal</p>
          </div>

          {/* Body */}
          <div className="px-8 py-8">
            {!submitted ? (
              <>
                <div className="text-center mb-6">
                  <div className="flex justify-center mb-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                      <Icon name="KeyRound" size={24} className="text-blue-600" />
                    </div>
                  </div>
                  <h1 className="text-xl font-bold text-gray-900 mb-1">Reset Your Password</h1>
                  <p className="text-sm text-gray-500">
                    Enter your work email address and we'll send you a secure password reset link.
                  </p>
                </div>

                {/* Security note */}
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 mb-5">
                  <Icon name="ShieldCheck" size={15} className="text-amber-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-700">
                    For your security, the reset link expires in <strong>1 hour</strong> and can only be used once. If you don't know your email, contact your administrator.
                  </p>
                </div>

                <ForgotPasswordForm onSuccess={handleSuccess} />
              </>
            ) : (
              <SuccessMessage email={sentEmail} />
            )}
          </div>

          {/* Footer */}
          <div className="px-8 pb-6 text-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium transition-colors"
            >
              <Icon name="ArrowLeft" size={15} />
              Back to Login
            </Link>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          © {new Date()?.getFullYear()} NU Dental. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default ForgotPassword;
