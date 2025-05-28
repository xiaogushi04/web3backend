import React, { useState, useEffect } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastProps {
  message: string;
  type: ToastType;
  duration?: number;
  onClose: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, type, duration = 5000, onClose }) => {
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(100);
  const [startTime] = useState(Date.now());
  const [remainingTime, setRemainingTime] = useState(duration);

  const getToastStyles = (type: ToastType) => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-l-4 border-green-500 text-green-800';
      case 'error':
        return 'bg-red-50 border-l-4 border-red-500 text-red-800';
      case 'warning':
        return 'bg-yellow-50 border-l-4 border-yellow-500 text-yellow-800';
      case 'info':
        return 'bg-blue-50 border-l-4 border-blue-500 text-blue-800';
      default:
        return 'bg-gray-50 border-l-4 border-gray-500 text-gray-800';
    }
  };

  const getIconStyles = (type: ToastType) => {
    switch (type) {
      case 'success':
        return 'text-green-500';
      case 'error':
        return 'text-red-500';
      case 'warning':
        return 'text-yellow-500';
      case 'info':
        return 'text-blue-500';
      default:
        return 'text-gray-500';
    }
  };

  useEffect(() => {
    if (!isPaused) {
      const timer = setInterval(() => {
        const elapsedTime = Date.now() - startTime;
        const remaining = duration - elapsedTime;
        
        if (remaining <= 0) {
          clearInterval(timer);
          onClose();
        } else {
          setRemainingTime(remaining);
          setProgress((remaining / duration) * 100);
        }
      }, 10);

      return () => clearInterval(timer);
    }
  }, [duration, isPaused, onClose, startTime]);

  return (
    <div
      className={`group relative shadow-lg rounded-lg overflow-hidden transition-all transform ${getToastStyles(type)}`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="flex items-start p-4 space-x-3">
        <div className={`flex-shrink-0 ${getIconStyles(type)}`}>
          {type === 'success' && (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          )}
          {type === 'error' && (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          {type === 'warning' && (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          )}
          {type === 'info' && (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">{message}</p>
        </div>
        <button
          onClick={onClose}
          className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ml-4 text-gray-400 hover:text-gray-600"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div
        className="absolute bottom-0 left-0 h-1 bg-current opacity-20 transition-all"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
};

export default Toast; 