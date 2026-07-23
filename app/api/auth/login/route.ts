import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const loginId = String(body?.loginId ?? '').trim().toLowerCase();
    if (!loginId) return NextResponse.json({ error: '아이디를 입력해 주세요.' }, { status: 400 });

    const admin = createAdminClient();
    const { data, error } = await admin
      .from('profiles')
      .select('email, active')
      .eq('login_id', loginId)
      .maybeSingle();

    if (error || !data || !data.active || !data.email) {
      return NextResponse.json({ error: '아이디 또는 비밀번호가 올바르지 않습니다.' }, { status: 401 });
    }
    return NextResponse.json({ email: data.email });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: '로그인 처리 중 오류가 발생했습니다.' }, { status: 500 });
  }
}
