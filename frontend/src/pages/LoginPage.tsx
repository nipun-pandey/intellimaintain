import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, ShieldCheck, Wrench, Eye, ArrowRight, Lock, Mail } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { showToast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      showToast('Please provide both email and password', 'warning');
      return;
    }

    setIsLoading(true);
    try {
      await login(email, password);
      showToast('Welcome to IntelliMaintain', 'success');
      navigate('/');
    } catch (err: any) {
      showToast(err.response?.data?.detail || 'Invalid login credentials', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans selection:bg-blue-600 selection:text-white">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="w-12 h-12 rounded-xl bg-blue-600 mx-auto flex items-center justify-center text-white shadow-lg shadow-blue-500/30 mb-4">
          <Activity className="w-7 h-7" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-white">
          Intelli<span className="text-blue-400">Maintain</span>
        </h2>
        <p className="mt-1 text-xs text-slate-400 font-mono tracking-wider uppercase">
          Predictive Maintenance & Telemetry Intelligence
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-slate-850 py-8 px-6 shadow-2xl rounded-2xl sm:px-10 border border-slate-800">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono mb-1.5">
                Work Email Address
              </label>
              <div className="relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="engineer@intellimaintain.io"
                  className="block w-full pl-9 pr-3 py-2.5 text-xs text-white bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider font-mono mb-1.5">
                Password
              </label>
              <div className="relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="block w-full pl-9 pr-3 py-2.5 text-xs text-white bg-slate-900 border border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-slate-500"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors shadow-md shadow-blue-600/30 disabled:opacity-60 mt-2"
            >
              <span>{isLoading ? 'Authenticating...' : 'Sign In to Operations Console'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Demo Logins */}
          <div className="mt-6 pt-6 border-t border-slate-800">
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider font-mono mb-3 text-center">
              One-Click Demo Credentials
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleQuickLogin('admin@intellimaintain.io', 'AdminPass123!')}
                className="flex flex-col items-center justify-center p-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 transition-colors text-center"
              >
                <ShieldCheck className="w-4 h-4 text-purple-400 mb-1" />
                <span className="text-[11px] font-medium text-slate-200">Admin</span>
                <span className="text-[9px] text-slate-400 font-mono">Full Access</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('engineer@intellimaintain.io', 'EngineerPass123!')}
                className="flex flex-col items-center justify-center p-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 transition-colors text-center"
              >
                <Wrench className="w-4 h-4 text-blue-400 mb-1" />
                <span className="text-[11px] font-medium text-slate-200">Engineer</span>
                <span className="text-[9px] text-slate-400 font-mono">Operations</span>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('viewer@intellimaintain.io', 'ViewerPass123!')}
                className="flex flex-col items-center justify-center p-2 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 transition-colors text-center"
              >
                <Eye className="w-4 h-4 text-emerald-400 mb-1" />
                <span className="text-[11px] font-medium text-slate-200">Viewer</span>
                <span className="text-[9px] text-slate-400 font-mono">Read Only</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
