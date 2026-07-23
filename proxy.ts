import {NextRequest,NextResponse} from 'next/server';

export async function proxy(req:NextRequest){
 const publicPaths=['/blocked','/api/health'];
 if(publicPaths.some(path=>req.nextUrl.pathname.startsWith(path)))return NextResponse.next();

 const ip=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||req.headers.get('x-real-ip')||'unknown';
 const supabaseUrl=process.env.NEXT_PUBLIC_SUPABASE_URL;
 const serviceRoleKey=process.env.SUPABASE_SERVICE_ROLE_KEY;

 if(ip!=='unknown'&&supabaseUrl&&serviceRoleKey){
  try{
   const query=new URL(`${supabaseUrl}/rest/v1/ip_allowlist`);
   query.searchParams.set('select','id');
   query.searchParams.set('status','eq.blocked');
   query.searchParams.set('ip_address',`eq.${ip}`);
   query.searchParams.set('limit','1');
   const response=await fetch(query,{headers:{apikey:serviceRoleKey,Authorization:`Bearer ${serviceRoleKey}`},cache:'no-store'});
   if(response.ok){
    const rules=await response.json();
    if(Array.isArray(rules)&&rules.length){
     if(req.nextUrl.pathname.startsWith('/api/'))return NextResponse.json({error:'차단된 IP입니다.'},{status:403});
     return NextResponse.rewrite(new URL('/blocked',req.url));
    }
   }
  }catch(error){
   console.error('IP blacklist check failed',error);
  }
 }

 const res=NextResponse.next();
 res.headers.set('x-crm-observed-ip',ip);
 return res;
}

export const config={matcher:['/((?!_next/static|_next/image|favicon.ico).*)']};
