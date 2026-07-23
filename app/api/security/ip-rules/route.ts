import { isIP } from 'node:net';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

async function authorize(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const admin = createAdminClient();
  const { data: userData } = await admin.auth.getUser(token);
  const user = userData.user;
  if (!user) return null;
  const { data: profile } = await admin.from('profiles').select('role, active, login_id').eq('id', user.id).maybeSingle();
  if (!profile?.active || !(profile.role === 'owner' || profile.login_id === 'prestockss')) return null;
  return { admin, user };
}

export async function GET(request: Request) {
  const auth = await authorize(request);
  if (!auth) return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  const { data, error } = await auth.admin.from('ip_allowlist').select('id, ip_address, label, status, approved_at').eq('status', 'blocked').order('approved_at', { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ rules: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await authorize(request);
  if (!auth) return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  try {
    const body = await request.json();
    const ip = String(body.ip ?? '').trim();
    const label = String(body.label ?? '').trim();
    if (!isIP(ip)) throw new Error('올바른 IPv4 또는 IPv6 주소를 입력해 주세요.');
    const { error } = await auth.admin.from('ip_allowlist').insert({ user_id: null, ip_address: ip, label: label || null, status: 'blocked', approved_by: auth.user.id, approved_at: new Date().toISOString() });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'IP 차단 등록 실패' }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const auth = await authorize(request);
  if (!auth) return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  try {
    const body = await request.json();
    const id = String(body.id ?? '');
    if (!id) throw new Error('삭제할 규칙이 없습니다.');
    const { error } = await auth.admin.from('ip_allowlist').delete().eq('id', id).eq('status', 'blocked');
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? 'IP 차단 해제 실패' }, { status: 400 });
  }
}
