'use client';

import { useEffect, useMemo, useState } from 'react';
import Dashboard from '@/components/Dashboard';
import { createClient } from '@/lib/supabase';
import type { Customer } from '@/lib/types';

export default function AuthApp({ initial }: { initial: Customer[] }) {
  const supabase = useMemo(() => createClient(), []);
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user.id ?? null);
      setReady(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
      setReady(true);
    });
    return () => subscription.unsubscribe();
  }, [supabase]);

  async function login() {
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ loginId: loginId.trim() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || '로그인에 실패했습니다.');

      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: result.email,
        password,
      });
      if (loginError) throw new Error('아이디 또는 비밀번호가 올바르지 않습니다.');
    } catch (e: any) {
      setError(e?.message || '로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    setUserId(null);
    setLoginId('');
    setPassword('');
  }

  if (!ready) return <main className="loginShell"><div className="loginCard"><h1>CRM</h1><p>불러오는 중입니다.</p></div></main>;

  if (userId) return <Dashboard initial={initial} authenticatedUserId={userId} onLogout={logout} />;

  return (
    <main className="loginShell">
      <div className="loginCard">
        <div className="loginBrand">CRM <span>온라인 버전</span></div>
        <h1>로그인</h1>
        <p className="muted">등록된 아이디와 비밀번호를 입력해 주세요.</p>
        <label>아이디<input autoFocus autoComplete="username" value={loginId} onChange={(e) => setLoginId(e.target.value)} placeholder="아이디 입력" /></label>
        <label>비밀번호<input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void login(); }} placeholder="비밀번호 입력" /></label>
        {error && <div className="loginError">{error}</div>}
        <button className="primary loginButton" onClick={() => void login()} disabled={loading}>{loading ? '로그인 중...' : '로그인'}</button>
      </div>
    </main>
  );
}
