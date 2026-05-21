import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, Lock, User, Target } from 'lucide-react';
import { cn } from '../lib/utils';

interface LoginProps {
  onLogin: () => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    // Standard username: Admin, Password: admin123
    setTimeout(() => {
      if (username === 'Sista' && password === 'Rahasia1*') {
        onLogin();
      } else {
        setError('Username atau password salah.');
        setIsSubmitting(false);
      }
    }, 800);
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center p-4 bg-citrus-50">
      {/* Background Decor */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-citrus-200/40 blur-[100px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-citrus-400/30 blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="glass rounded-[2rem] p-8 md:p-12 shadow-2xl">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl gradient-citrus flex items-center justify-center shadow-lg mb-4 overflow-hidden">
              <img src="/logo.png" alt="SISTA" className="w-full h-full object-cover" onError={(e) => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement?.querySelector('.fallback-icon')?.classList.remove('hidden');
              }} />
              <Target className="text-white w-8 h-8 fallback-icon hidden" />
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">SISTA</h1>
            <p className="text-citrus-700 font-medium tracking-tight">Sistem Asesmen Pintar</p>
            <p className="text-[9px] font-bold text-slate-400 uppercase mt-1 tracking-widest">GENERATOR AI</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-citrus-800 ml-1">Username</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-citrus-500" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Masukkan Username"
                  className="w-full bg-white/50 border border-citrus-200 rounded-2xl py-3 pl-12 pr-4 focus:ring-2 focus:ring-citrus-500 focus:border-transparent outline-none transition-all placeholder:text-citrus-300"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-citrus-800 ml-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-citrus-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan Password"
                  className="w-full bg-white/50 border border-citrus-200 rounded-2xl py-3 pl-12 pr-4 focus:ring-2 focus:ring-citrus-500 focus:border-transparent outline-none transition-all placeholder:text-citrus-300"
                  required
                />
              </div>
            </div>

            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="text-red-500 text-sm font-medium text-center"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={isSubmitting}
              className={cn(
                "w-full gradient-citrus text-white font-bold py-4 rounded-2xl shadow-lg shadow-citrus-500/30 hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2",
                isSubmitting && "opacity-70 cursor-not-allowed"
              )}
            >
              {isSubmitting ? (
                <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  Login
                </>
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-[10px] text-slate-400 font-bold tracking-widest uppercase italic">
            BY FIDHAL TOUNA
          </p>
        </div>
      </motion.div>
    </div>
  );
}
