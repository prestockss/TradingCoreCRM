import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

type DbRole = 'owner' | 'admin' | 'manager' | 'agent';

async function authorize(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const admin = createAdminClient();
  const { data: userData } = await admin.auth.getUser(token);
  const user = userData.user;
  if (!user) return null;
  const { data: profile } = await admin.from('profiles').select('role, active, login_id').eq('id', user.id).maybeSingle();
  if (!profile?.active || !['owner', 'admin', 'manager'].includes(profile.role)) return null;
  return { admin, user, role: profile.role as DbRole, isOwner: profile.role === 'owner' || profile.login_id === 'prestockss' };
}

export async function GET(request: Request) {
  const auth = await authorize(request);
  if (!auth) return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  let query = auth.admin
    .from('profiles')
    .select('id, login_id, email, display_name, role, active, created_at')
    .order('created_at', { ascending: true });
  if (!auth.isOwner) query = query.or(`role.eq.agent,id.eq.${auth.user.id}`);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ staff: (data ?? []).map((item: any) => ({ ...item, role: item.login_id === 'prestockss' ? 'owner' : item.role })) });
}

export async function POST(request: Request) {
  const auth = await authorize(request);
  if (!auth) return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  try {
    const body = await request.json();
    const loginId = String(body.loginId ?? '').trim().toLowerCase();
    const displayName = String(body.displayName ?? '').trim();
    const password = String(body.password ?? '');
    const role: DbRole = body.role === 'manager' ? 'manager' : 'agent';
    if (role === 'manager' && !auth.isOwner) throw new Error('부관리자 계정은 최고관리자만 생성할 수 있습니다.');
    if (!/^[a-z0-9._-]{4,30}$/.test(loginId)) throw new Error('아이디는 영문 소문자·숫자·._- 조합 4~30자로 입력해 주세요.');
    if (!displayName) throw new Error('이름을 입력해 주세요.');
    if (password.length < 8) throw new Error('비밀번호는 8자 이상이어야 합니다.');

    const email = `${loginId}@crm.tradingcore.local`;
    const { data: created, error: createError } = await auth.admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    });
    if (createError || !created.user) throw createError ?? new Error('계정 생성 실패');

    const { error: profileError } = await auth.admin.from('profiles').upsert({
      id: created.user.id,
      login_id: loginId,
      email,
      display_name: displayName,
      role,
      active: true,
    });
    if (profileError) {
      await auth.admin.auth.admin.deleteUser(created.user.id);
      throw profileError;
    }
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? '계정 생성 실패' }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  const auth = await authorize(request);
  if (!auth) return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  try {
    const body = await request.json();
    const id = String(body.id ?? '');
    if (!id) throw new Error('계정 ID가 없습니다.');

    const { data: target } = await auth.admin.from('profiles').select('role, login_id').eq('id', id).maybeSingle();
    if (!target) throw new Error('대상 계정을 찾을 수 없습니다.');
    const targetIsManager = ['owner', 'admin', 'manager'].includes(target.role) || target.login_id === 'prestockss';
    if (!auth.isOwner && targetIsManager) throw new Error('부관리자는 관리자 계정을 변경할 수 없습니다.');

    if (body.action === 'password') {
      const password = String(body.password ?? '');
      if (password.length < 8) throw new Error('비밀번호는 8자 이상이어야 합니다.');
      const { error } = await auth.admin.auth.admin.updateUserById(id, { password });
      if (error) throw error;
    } else if (body.action === 'active') {
      const active = Boolean(body.active);
      if (target.login_id === 'prestockss' || target.role === 'owner') throw new Error('대표계정은 비활성화할 수 없습니다.');
      const { error } = await auth.admin.from('profiles').update({ active }).eq('id', id);
      if (error) throw error;
    } else if (body.action === 'role') {
      if (!auth.isOwner) throw new Error('계정 권한은 최고관리자만 변경할 수 있습니다.');
      if (target.login_id === 'prestockss' || target.role === 'owner') throw new Error('대표계정의 권한은 변경할 수 없습니다.');
      const role: DbRole | null = body.role === 'manager' ? 'manager' : body.role === 'agent' ? 'agent' : null;
      if (!role) throw new Error('변경할 권한이 올바르지 않습니다.');
      const { error } = await auth.admin.from('profiles').update({ role }).eq('id', id);
      if (error) throw error;
    } else {
      throw new Error('지원하지 않는 작업입니다.');
    }
    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message ?? '계정 수정 실패' }, { status: 400 });
  }
}
