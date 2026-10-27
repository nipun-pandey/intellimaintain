import React from 'react';
import { Loader2 } from 'lucide-react';

export const LoadingSpinner: React.FC<{ message?: string }> = ({ message = 'Loading asset data...' }) => {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <Loader2 className="w-8 h-8 text-blue-600 animate-spin mb-3" />
      <span className="text-xs font-medium text-slate-500 font-mono tracking-wide">{message}</span>
    </div>
  );
};
