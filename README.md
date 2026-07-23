# TradingCoreCRM v0.2 — 직원 계정 완성본

## 포함 기능
- 이메일 대신 로그인 아이디 사용
- 대표계정 `prestockss` 연결
- 관리자 화면에서 직원/관리자 계정 생성
- 직원 비밀번호 변경, 비활성화, 재활성화
- Supabase Auth 기반 비밀번호 보관
- 대표/관리자/일반담당자 권한 구분

## 최초 적용 순서
1. Supabase SQL Editor에서 `supabase/migration_v0_2_staff_accounts.sql` 실행
2. Vercel 환경 변수에 다음 3개가 있는지 확인
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
3. 프로젝트를 배포
4. 대표계정 로그인: 아이디 `prestockss` + 기존 Supabase 비밀번호

## 로컬 실행
```bash
npm install
npm run dev
```

## 보안
`SUPABASE_SERVICE_ROLE_KEY`는 서버 API에서만 사용하며 브라우저에 노출되지 않습니다.
