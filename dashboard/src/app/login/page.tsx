'use client';

export const dynamic = 'force-dynamic';

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
    const redirectTo = `${window.location.origin}/auth/callback`;
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
    setLoading(false);
    if (error) setError(error.message);
    else setStep('otp');
  }

  async function handleVerifyOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.verifyOtp({ email, token, type: 'email' });
    setLoading(false);
    if (error) setError(error.message);
    else router.push('/dashboard');
  }

  const containerStyle: React.CSSProperties = {
    minHeight: '100vh',
    background: 'var(--bg-base)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
  };

  const cardStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: '320px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: '12px',
    border: '1px solid var(--border)',
    background: 'var(--bg-surface)',
    color: 'var(--text-primary)',
    fontSize: '15px',
    outline: 'none',
  };

  const btnPrimaryStyle: React.CSSProperties = {
    width: '100%',
    padding: '13px',
    borderRadius: '12px',
    border: 'none',
    background: 'linear-gradient(135deg, #6e40c9, #c940a0)',
    color: '#fff',
    fontSize: '15px',
    fontWeight: 600,
    cursor: 'pointer',
    opacity: loading ? 0.6 : 1,
  };

  if (step === 'otp') {
    return (
      <main style={containerStyle}>
        <form onSubmit={handleVerifyOtp} style={cardStyle}>
          <div style={{ textAlign: 'center', marginBottom: '8px' }}>
            <span style={{ fontSize: 36 }}>🎩</span>
            <h1 style={{ fontSize: '22px', fontWeight: 700, marginTop: '4px', color: 'var(--text-primary)' }}>
              JARVIS
            </h1>
          </div>

          <p style={{ fontSize: '14px', textAlign: 'center', color: 'var(--text-secondary)' }}>
            Introduce el código enviado a<br />
            <span style={{ color: 'var(--text-primary)' }}>{email}</span>
          </p>

          <input
            type="text"
            inputMode="numeric"
            placeholder="123456"
            value={token}
            onChange={e => setToken(e.target.value)}
            required
            maxLength={6}
            autoFocus
            style={{ ...inputStyle, textAlign: 'center', fontSize: '24px', letterSpacing: '0.3em' }}
          />

          {error && (
            <p style={{ fontSize: '13px', textAlign: 'center', color: 'var(--red)' }}>{error}</p>
          )}

          <button type="submit" disabled={loading} style={btnPrimaryStyle}>
            {loading ? 'Verificando…' : 'Entrar'}
          </button>

          <button
            type="button"
            onClick={() => setStep('email')}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '14px' }}
          >
            Volver
          </button>
        </form>
      </main>
    );
  }

  return (
    <main style={containerStyle}>
      <form onSubmit={handleSendOtp} style={cardStyle}>
        <div style={{ textAlign: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: 36 }}>🎩</span>
          <h1 style={{ fontSize: '22px', fontWeight: 700, marginTop: '4px', color: 'var(--text-primary)' }}>
            JARVIS
          </h1>
          <p style={{ fontSize: '13px', marginTop: '4px', color: 'var(--text-secondary)' }}>
            Mayordomo digital de la familia García
          </p>
        </div>

        <input
          type="email"
          placeholder="tu@email.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          style={inputStyle}
        />

        {error && (
          <p style={{ fontSize: '13px', textAlign: 'center', color: 'var(--red)' }}>{error}</p>
        )}

        <button type="submit" disabled={loading} style={btnPrimaryStyle}>
          {loading ? 'Enviando…' : 'Enviar código'}
        </button>
      </form>
    </main>
  );
}
