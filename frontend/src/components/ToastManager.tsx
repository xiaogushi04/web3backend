import React, { useState, useCallback, createContext, useContext } from 'react';
import Toast, { ToastType } from './Toast';

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastManagerProps {
  toasts: ToastMessage[];
  onRemove: (id: string) => void;
}

const ToastManager: React.FC<ToastManagerProps> = ({ toasts, onRemove }) => {
  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 min-w-[320px] max-w-[420px]">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          duration={toast.duration}
          onClose={() => onRemove(toast.id)}
        />
      ))}
    </div>
  );
};

interface ToastContextType {
  showToast: (message: string, type: ToastType, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const showToast = useCallback((message: string, type: ToastType, duration = 5000) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type, duration }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <ToastManager toasts={toasts} onRemove={removeToast} />
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export default ToastManager; 