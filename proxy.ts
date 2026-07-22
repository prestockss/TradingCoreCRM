import {NextRequest,NextResponse} from 'next/server';
export function proxy(req:NextRequest){
 const publicPaths=['/login','/api/health']; if(publicPaths.some(p=>req.nextUrl.pathname.startsWith(p))) return NextResponse.next();
 // 실제 운영에서는 Supabase 세션 검사 후, profiles/ip_allowlist 테이블을 조회해야 한다.
 // Vercel에서는 x-forwarded-for / x-real-ip 계열 헤더를 서버에서만 신뢰해 처리한다.
 const ip=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||req.headers.get('x-real-ip')||'unknown';
 const res=NextResponse.next(); res.headers.set('x-crm-observed-ip',ip); return res;
}
export const config={matcher:['/((?!_next/static|_next/image|favicon.ico).*)']};
