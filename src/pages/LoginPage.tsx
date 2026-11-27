import React, { useState } from 'react';
import { Lock, Mail, Eye, EyeOff, ShieldCheck, AlertCircle, ArrowRight, Sparkles } from 'lucide-react';

interface LoginPageProps {
  onLoginSuccess: (userEmail: string) => void;
}

// Authorized credentials
const AUTHORIZED_USERNAME = 'gamifytl1315@gmail.com';
const AUTHORIZED_PASSWORD = 'Create@gamifytl1315';

export function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [email, setEmail] = useState('gamifytl1315@gmail.com');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    if (!cleanEmail) {
      setErrorMessage('Please enter your email address.');
      return;
    }
    if (!cleanPassword) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsLoading(true);

    try {
      // Direct credential verification
      const isEmailMatch = cleanEmail.toLowerCase() === AUTHORIZED_USERNAME.toLowerCase();
      const isPasswordMatch = cleanPassword === AUTHORIZED_PASSWORD;

      if (isEmailMatch && isPasswordMatch) {
        if (rememberMe && typeof window !== 'undefined' && window.localStorage) {
          window.localStorage.setItem(
            'gamifytl_portal_session',
            JSON.stringify({
              email: cleanEmail,
              authenticated: true,
              loginTime: new Date().toISOString(),
            })
          );
        }
        onLoginSuccess(cleanEmail);
      } else {
        setErrorMessage('Invalid email or password. Please verify your credentials and try again.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred during authentication.';
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="relative flex min-h-screen w-full items-center justify-center bg-white bg-cover bg-center bg-no-repeat px-4 py-12 select-none overflow-hidden"
      style={{
        backgroundImage: "url('/login-bg.jpg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }}
    >
      {/* Subtle Ambient Vignette to keep card prominent and readable */}
      <div className="pointer-events-none absolute inset-0 bg-white/20 backdrop-blur-[0.5px]" />

      <div className="relative z-10 w-full max-w-md">
        {/* Modern Bright White Glass Card */}
        <div className="relative rounded-3xl border border-gray-100 bg-white/95 p-8 sm:p-10 shadow-[0_20px_60px_-15px_rgba(239,68,68,0.14),0_10px_30px_-10px_rgba(0,0,0,0.06)] backdrop-blur-xl ring-1 ring-black/5">
          {/* Logo & Header */}
          <div className="text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-white p-2 shadow-md border border-gray-100 ring-4 ring-red-50">
              <img src="/portal-logo.webp" alt="GamifyTL Logo" className="h-16 w-16 object-contain" />
            </div>

            <div className="mt-4 flex items-center justify-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-gray-900">GamifyTL</h1>
              <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-600 border border-red-200/70">
                Portal
              </span>
            </div>

            <p className="mt-1 text-sm text-gray-500 font-medium">
              Professor Outreach &amp; Campaign Dispatch
            </p>
          </div>

          {/* Security Banner */}
          <div className="mt-5 flex items-center justify-center gap-2 rounded-xl border border-red-100/80 bg-red-50/50 px-3.5 py-2 text-xs font-medium text-gray-600">
            <ShieldCheck className="h-4 w-4 shrink-0 text-red-500" />
            <span>Authorized Access Only • Multi-Account Outreach</span>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div
              role="alert"
              className="mt-4 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50/90 p-3 text-xs text-red-700 shadow-2xs"
            >
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500 mt-0.5" />
              <div className="flex-1 font-medium leading-relaxed">{errorMessage}</div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="portal-email" className="block text-xs font-semibold text-gray-700">
                Email Address
              </label>
              <div className="relative mt-1.5">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Mail className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  id="portal-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="gamifytl1315@gmail.com"
                  autoComplete="username"
                  className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pr-4 pl-9 text-sm text-gray-900 placeholder-gray-400 shadow-2xs transition-all focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="portal-password" className="block text-xs font-semibold text-gray-700">
                Password
              </label>
              <div className="relative mt-1.5">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Lock className="h-4 w-4 text-gray-400" />
                </div>
                <input
                  id="portal-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-gray-200 bg-white py-2.5 pr-10 pl-9 text-sm text-gray-900 placeholder-gray-400 shadow-2xs transition-all focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-0.5">
              <label className="flex items-center gap-2 cursor-pointer text-gray-600 hover:text-gray-900">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
                />
                <span className="font-medium">Remember this device</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-red-600 via-rose-600 to-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-red-500/25 transition-all hover:from-red-500 hover:to-rose-500 hover:shadow-red-500/35 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Verifying Credentials...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Portal</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          {/* Portal Info Footer */}
          <div className="mt-8 border-t border-gray-100 pt-4 text-center">
            <div className="flex items-center justify-center gap-1.5 text-xs text-gray-500 font-medium">
              <Sparkles className="h-3.5 w-3.5 text-red-500" />
              <span>GamifyTL • Interactive Classroom Games</span>
            </div>
            <p className="mt-1 text-[11px] text-gray-400">
              Zero-install classroom engagement for university professors.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LoginPage;
