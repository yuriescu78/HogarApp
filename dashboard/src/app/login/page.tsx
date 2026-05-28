'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email,   setEmail]   = useState('');
  const [token,   setToken]   = useState('');
  const [step,    setStep]    = useState<'email' | 'otp'>('email');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const supabase = createSupabaseBrowserClient();
  const router   = useRouter();

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.signInWithOtp({ email });

    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setStep('otp');
    }
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });

    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      router.push('/dashboard');
    }
  }

  if (step === 'otp') {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <form onSubmit={handleVerifyOtp} className="flex flex-col gap-4 w-80">
          <h1 className="text-2xl font-semibold">JARVIS</h1>
          <p className="text-sm text-gray-600">Introduce el código de 6 dígitos enviado a {email}</p>
          <input
            type="text"
            placeholder="123456"
            value={token}
            onChange={e => setToken(e.target.value)}
            required
            maxLength={6}
            className="border rounded px-3 py-2 text-center text-2xl tracking-widest"
            autoFocus
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="bg-black text-white rounded px-4 py-2 disabled:opacity-50"
          >
            {loading ? 'Verificando...' : 'Entrar'}
          </button>
          <button
            type="button"
            onClick={() => setStep('email')}
            className="text-sm text-gray-500 underline"
          >
            Volver
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center">
      <form onSubmit={handleSendOtp} className="flex flex-col gap-4 w-80">
        <h1 className="text-2xl font-semibold">JARVIS</h1>
        <input
          type="email"
          placeholder="tu@email.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          className="border rounded px-3 py-2"
        />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="bg-black text-white rounded px-4 py-2 disabled:opacity-50"
        >
          {loading ? 'Enviando...' : 'Enviar código'}
        </button>
      </form>
    </main>
  );
}
