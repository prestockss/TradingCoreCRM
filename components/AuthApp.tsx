'use client';

import { useEffect, useState } from 'react';
import Dashboard from '@/components/Dashboard';
import { createClient } from '@/lib/supabase';
import type { Customer } from '@/lib/types';

export default function AuthApp({ initial }: { initial: Customer[] }) {
  const supabase = createClient();

  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUserId(data.session?.user.id ?? null);
      setReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user.id ?? null);
      setReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function login() {
    setError('');

    const { error: loginError } =
      await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

    if (loginError) {
      setError('이메일 또는 비밀번호가 올바르지 않습니다.');
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    setUserId(null);
    setEmail('');
    setPassword('');
  }

  if (!ready) {
    return (
      <main className="loginShell">
        <div className="loginCard">
          <h1>CRM</h1>
          <p>불러오는 중입니다.</p>
        </div>
      </main>
    );
  }

  if (userId) {
    return (
      <Dashboard
        initial={initial}
        authenticatedUserId={userId}
        onLogout={logout}
      />
    );
  }

  return (
    <main className="loginShell">
      <div className="loginCard">
        <div className="loginBrand">
          CRM <span>온라인 버전</span>
        </div>

        <h1>로그인</h1>

        <p className="muted">
          등록된 대표계정으로 로그인해 주세요.
        </p>

        <label>
          이메일
          <input
            autoFocus
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="이메일 입력"
          />
        </label>

        <label>
          비밀번호
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') login();
            }}
            placeholder="비밀번호 입력"
          />
        </label>

        {error && <div className="loginError">{error}</div>}

        <button
          className="primary loginButton"
          onClick={login}
        >
          로그인
        </button>
      </div>
    </main>
  );
}