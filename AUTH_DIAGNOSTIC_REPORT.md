# 구글 로그인 및 사용자 권한 구조 진단 보고서

작성일: 2026-06-15  
진단 범위: 구글 로그인 가입 흐름, 인증, 사용자 권한 구조

---

## 1. 구글 로그인 가입 흐름

### 1.1 구현 여부
✅ **구현됨**

### 1.2 사용 방식
- **OAuth 제공자**: Manus OAuth 서버 (`https://api.manus.im`)
- **인증 방식**: 구글 계정 → Manus OAuth → 세션 쿠키 (JWT)
- **식별 기준**: `openId` (고유한 OAuth 사용자 ID)

### 1.3 신규 사용자 DB 생성 여부
✅ **자동 생성됨**

**흐름:**
```
1. 구글 로그인 클릭
   ↓
2. OAuth 콜백 (/api/oauth/callback)
   ↓
3. db.upsertUser() 호출
   - openId: 고유 식별자 (Manus OAuth에서 반환)
   - name: 사용자 이름 (또는 null)
   - email: 이메일 (또는 null)
   - loginMethod: 'google' 또는 플랫폼 정보
   - role: 기본값 'user' (소유자 계정은 'admin')
   - lastSignedIn: 현재 시간
   ↓
4. 세션 쿠키 생성 (1년 유효)
   ↓
5. 로그인 상태 유지
```

**코드 위치:**
- OAuth 콜백: `server/_core/oauth.ts` (31-37줄)
- upsertUser: `server/db.ts` (21-78줄)

### 1.4 중복 사용자 방지 여부
✅ **방지됨**

**방식:**
- `openId`는 `UNIQUE` 제약조건
- `INSERT ... ON DUPLICATE KEY UPDATE` 사용
- 동일한 `openId`로 재로그인 시 기존 레코드 업데이트 (중복 생성 안 함)

**DB 스키마:**
```sql
openId: varchar(64) UNIQUE NOT NULL
```

### 1.5 Email 저장 여부
⚠️ **조건부 저장**

- OAuth 응답에 email이 있으면 저장
- 없으면 `null`로 저장
- 현재 구글 로그인 시 email이 함께 반환되므로 일반적으로 저장됨

**코드:**
```typescript
email: userInfo.email ?? null  // oauth.ts 34줄
```

### 1.6 loginMethod 저장값
✅ **저장됨**

- Manus OAuth에서 `loginMethod` 또는 `platform` 반환
- 일반적으로 `'google'` 또는 플랫폼명
- 저장 위치: `users.loginMethod` 컬럼

**코드:**
```typescript
loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null
```

### 1.7 로그인 유지 여부
✅ **유지됨**

**방식:**
1. 세션 쿠키 생성 (JWT 형식)
2. 쿠키 유효기간: 1년 (`ONE_YEAR_MS = 31536000000ms`)
3. 모든 요청에서 쿠키 검증
4. 유효하면 `ctx.user` 설정

**코드:**
- 쿠키 생성: `oauth.ts` 39-45줄
- 쿠키 검증: `sdk.ts` `authenticateRequest()` 메서드

### 1.8 로그아웃 여부
✅ **작동함**

**방식:**
- `auth.logout` 엔드포인트 호출
- 세션 쿠키 삭제 (`maxAge: -1`)
- 프론트: `useAuth().logout()` 호출

**코드:**
```typescript
// routers.ts 59-65줄
logout: publicProcedure.mutation(({ ctx }) => {
  ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
  return { success: true };
})
```

---

## 2. 현재 사용자 조회 API

### 2.1 사용 API
**엔드포인트:** `/api/trpc/auth.me`

**특징:**
- 타입: `publicProcedure.query()`
- 로그인 여부와 관계없이 호출 가능
- 로그인 상태면 사용자 정보 반환
- 비로그인 상태면 `null` 반환

### 2.2 반환 필드

| 필드 | 타입 | 설명 | 반환 여부 |
|------|------|------|---------|
| `id` | `number` | 사용자 DB ID (자동증가) | ✅ |
| `openId` | `string` | OAuth 고유 식별자 | ✅ |
| `name` | `string \| null` | 사용자 이름 | ✅ |
| `email` | `string \| null` | 이메일 주소 | ✅ |
| `loginMethod` | `string \| null` | 로그인 방식 (예: 'google') | ✅ |
| `role` | `'user' \| 'admin'` | 사용자 역할 | ✅ |
| `createdAt` | `Date` | 계정 생성 시간 | ✅ |
| `updatedAt` | `Date` | 마지막 업데이트 시간 | ✅ |
| `lastSignedIn` | `Date` | 마지막 로그인 시간 | ✅ |

### 2.3 role 반환 여부
✅ **반환됨**

- 기본값: `'user'`
- 소유자 계정: `'admin'` (upsertUser에서 자동 설정)
- 프론트에서 `user.role`으로 접근 가능

### 2.4 status 반환 여부
❌ **반환 안 됨**

- DB 스키마에 `status` 필드 없음
- 반환 필드에도 없음

### 2.5 approvalStatus 반환 여부
❌ **반환 안 됨**

- DB 스키마에 `approvalStatus` 필드 없음
- 반환 필드에도 없음

---

## 3. DB 권한 필드

### 3.1 현재 존재하는 필드

| 필드 | 존재 | 기본값 | 현재 사용 | 비고 |
|------|------|--------|---------|------|
| `role` | ✅ | `'user'` | ✅ | 관리자 구분에 사용 |
| `status` | ❌ | - | - | 구현 안 됨 |
| `approvalStatus` | ❌ | - | - | 구현 안 됨 |
| `isApproved` | ❌ | - | - | 구현 안 됨 |
| `isActive` | ❌ | - | - | 구현 안 됨 |
| `membershipCode` | ❌ | - | - | 구현 안 됨 |
| `membershipLevel` | ❌ | - | - | 구현 안 됨 |
| `disabledAt` | ❌ | - | - | 구현 안 됨 |
| `suspendedAt` | ❌ | - | - | 구현 안 됨 |

### 3.2 role 필드 상세

**DB 정의:**
```typescript
role: mysqlEnum("role", ["user", "admin"]).default("user").notNull()
```

**기본값:** `'user'`

**설정 로직:**
- 신규 사용자: `'user'`
- 소유자 계정 (`ENV.ownerOpenId`와 일치): `'admin'`

**사용 위치:**
- `server/_core/trpc.ts`: `adminProcedure` 검증 (30-45줄)
- `server/routers.ts`: 관리자 기능 제한 (없음 - 현재 관리자 기능 미구현)

---

## 4. 사이트 접근 권한

### 4.1 로그인 필요 여부

| 기능 | 로그인 필요 | 권한 검사 | 비고 |
|------|-----------|---------|------|
| **홈 페이지** | ❌ | ❌ | 누구나 접근 가능 |
| **YouTube 트렌드** | ❌ (프론트) | ⚠️ (서버) | 프론트는 제한 없음, 서버는 protectedProcedure |
| **네이버 트렌드** | ❌ | ❌ | 누구나 접근 가능 |
| **통합 인사이트** | ❌ | ❌ | 누구나 접근 가능 |
| **내 보관함** | ❌ (프론트) | ✅ (서버) | 프론트는 제한 없음, 서버는 현재 사용자만 |
| **마이페이지** | ❌ (프론트) | ✅ (서버) | 프론트는 제한 없음, 서버는 현재 사용자만 |
| **API 키 설정** | ❌ (프론트) | ✅ (서버) | 프론트는 제한 없음, 서버는 protectedProcedure |
| **관리자 기능** | ❌ | ❌ | 현재 관리자 기능 미구현 |

### 4.2 가입 즉시 전체 사용 가능 여부
✅ **가능함**

**상황:**
- 신규 사용자 가입 직후 모든 기능 사용 가능
- 별도 승인 프로세스 없음
- 모든 사용자가 `role: 'user'`로 동일한 권한

### 4.3 관리자 구분 여부
✅ **구분됨** (코드상)

**구현:**
- `role` 필드로 `'user'` vs `'admin'` 구분
- `adminProcedure`로 관리자 전용 API 보호 가능
- 현재 관리자 기능은 미구현 상태

### 4.4 승인 사용자 구분 여부
❌ **구분 안 됨**

- 승인 관련 필드 없음
- 모든 신규 사용자가 즉시 모든 기능 사용 가능

### 4.5 서버 API 권한 검사 여부
⚠️ **부분적 구현**

**보호된 API (protectedProcedure):**
- YouTube API 키 저장/수정/삭제
- YouTube 트렌드 조회 (getPopularChannels, getTrendingVideos, getTrendingShorts)
- 사용자 정보 수정 (updateName)
- API 키 조회 (getWithStatus)

**공개 API (publicProcedure):**
- 네이버 카테고리 트렌드 (categoryTrend)
- 네이버 통합 인사이트 (unifiedInsight)
- 네이버 진단 (diagnostic)
- 인증 (auth.me, auth.logout)

---

## 5. 신규 가입자 기본 권한

### 5.1 신규 가입자 DB 저장값

```
role 기본값: 'user'
status 기본값: (필드 없음)
approvalStatus 기본값: (필드 없음)
isActive 기본값: (필드 없음)
membershipCode 기본값: (필드 없음)
```

### 5.2 가입 직후 사이트 사용 가능 여부
✅ **전체 기능 사용 가능**

**상황:**
- 구글 로그인 완료 → 자동 가입
- 즉시 모든 기능 접근 가능
- 별도 승인/대기 프로세스 없음

**사용 가능 기능:**
- YouTube 트렌드 조회 (API 키 필요)
- 네이버 트렌드 조회
- 북마크 저장/조회
- 마이페이지 접근
- API 키 설정

---

## 6. 프론트엔드 접근 제한

### 6.1 현재 구현 상태

| 항목 | 구현 | 위치 | 비고 |
|------|------|------|------|
| `AuthContext` | ❌ | - | 미구현 |
| `useAuth` | ✅ | `client/src/_core/hooks/useAuth.ts` | 인증 상태 제공 |
| `ProtectedRoute` | ❌ | - | 미구현 |
| `RequireAuth` | ❌ | - | 미구현 |
| `RequireAdmin` | ❌ | - | 미구현 |
| `route guard` | ❌ | - | 미구현 |
| 메뉴 숨김 처리 | ⚠️ | `Header`, `Sidebar` | 부분적 구현 |
| 버튼 비활성화 | ⚠️ | 각 컴포넌트 | 부분적 구현 |
| 권한 부족 안내 화면 | ❌ | - | 미구현 |

### 6.2 useAuth 훅 기능

**제공 정보:**
```typescript
{
  user: User | null,           // 현재 사용자 정보
  loading: boolean,            // 로딩 상태
  error: Error | null,         // 에러 정보
  isAuthenticated: boolean,    // 로그인 여부
  logout: () => Promise<void>, // 로그아웃 함수
  refresh: () => Promise<void> // 사용자 정보 새로고침
}
```

**사용 예시:**
```typescript
const { user, isAuthenticated, logout } = useAuth();

if (!isAuthenticated) {
  // 비로그인 상태
}
```

### 6.3 라우팅 구조

**현재 라우팅 (App.tsx):**
```typescript
<Route path="/" component={Home} />
<Route path="/trends/youtube" component={YouTubeTrends} />
<Route path="/trends/naver" component={NaverTrends} />
<Route path="/saved-contents" component={SavedContents} />
```

**특징:**
- 모든 라우트가 공개 (ProtectedRoute 없음)
- 라우트 레벨에서 권한 검사 없음
- 페이지 컴포넌트에서 개별적으로 처리

---

## 7. 서버 API 권한 검증

### 7.1 API별 권한 검사

| API | 인증 검사 | 현재 사용자 ID 사용 | role 검사 | 승인 상태 검사 | 다른 사용자 데이터 접근 |
|-----|---------|------------------|---------|-------------|-------------------|
| **YouTube API 키 저장** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **YouTube API 키 수정** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **YouTube API 키 삭제** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **YouTube 트렌드 조회** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **북마크 저장** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **북마크 삭제** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **닉네임 수정** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **마이페이지 조회** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **네이버 트렌드 조회** | ❌ | ❌ | ❌ | ❌ | ❌ |
| **관리자 기능** | ❌ | - | - | - | - |

### 7.2 보호 메커니즘

**protectedProcedure:**
```typescript
// server/_core/trpc.ts
protectedProcedure = baseProcedure.use(({ ctx, next }) => {
  if (!ctx.user) throw new TRPCError({ code: 'UNAUTHORIZED' });
  return next({ ctx });
})
```

**특징:**
- 로그인 사용자만 호출 가능
- `ctx.user.id`로 현재 사용자 식별
- 모든 데이터 접근이 현재 사용자로 제한됨

**예시 (YouTube 키 저장):**
```typescript
save: protectedProcedure
  .input(z.object({ provider: z.string(), apiKey: z.string() }))
  .mutation(async ({ ctx, input }) => {
    // ctx.user.id는 항상 현재 사용자
    // 다른 사용자의 키는 접근 불가
    await db.saveUserApiKey(ctx.user.id, input.provider, input.apiKey);
  })
```

### 7.3 adminProcedure

**정의:**
```typescript
// server/_core/trpc.ts
adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== 'admin') 
    throw new TRPCError({ code: 'FORBIDDEN' });
  return next({ ctx });
})
```

**현재 사용 여부:**
- 정의됨: ✅
- 실제 사용: ❌ (관리자 기능 미구현)

---

## 8. 인증과 권한 분석

### 8.1 인증 (Authentication)

**현재 구현 상태:** ✅ **완전히 구현됨**

| 항목 | 상태 | 설명 |
|------|------|------|
| 구글 로그인 | ✅ | Manus OAuth 통합 |
| 사용자 식별 | ✅ | `openId` 기반 고유 식별 |
| 세션 유지 | ✅ | JWT 쿠키 (1년 유효) |
| 현재 사용자 조회 | ✅ | `/api/trpc/auth.me` |
| 로그아웃 | ✅ | 쿠키 삭제 |
| 신규 사용자 자동 생성 | ✅ | OAuth 콜백에서 자동 생성 |
| 중복 사용자 방지 | ✅ | `openId` UNIQUE 제약 |

### 8.2 권한 (Authorization)

**현재 구현 상태:** ⚠️ **부분적 구현**

| 항목 | 상태 | 설명 |
|------|------|------|
| 관리자 구분 | ✅ | `role` 필드 (user/admin) |
| 승인 여부 | ❌ | 필드 없음 |
| 회원 상태 | ❌ | 필드 없음 |
| 메뉴 접근 제한 | ⚠️ | 부분적 (프론트에서만) |
| API 접근 제한 | ✅ | protectedProcedure 사용 |
| 역할 기반 접근 제어 | ⚠️ | adminProcedure 정의됨, 미사용 |
| 사용자 데이터 격리 | ✅ | 모든 API에서 `ctx.user.id` 사용 |

---

## 9. 최종 판단

### 9.1 구글 가입 구현 상태
✅ **완전히 구현됨**

- 구글 로그인 → Manus OAuth → 자동 사용자 생성
- 신규 사용자 DB 레코드 자동 생성
- 중복 사용자 방지 (openId UNIQUE)
- 모든 필수 필드 저장 (name, email, loginMethod, role)

### 9.2 인증 구현 상태
✅ **완전히 구현됨**

- OAuth 기반 인증
- 세션 쿠키 (JWT) 기반 로그인 유지
- 사용자 정보 조회 API (`auth.me`)
- 로그아웃 기능
- 매 요청마다 사용자 인증 검증

### 9.3 사용 권한 구현 상태
⚠️ **부분적 구현**

**구현된 부분:**
- 관리자 역할 구분 (`role: 'user' | 'admin'`)
- 인증된 사용자만 특정 API 접근 (protectedProcedure)
- 사용자 데이터 격리 (각 사용자는 자신의 데이터만 접근)

**미구현된 부분:**
- 승인 프로세스 (모든 신규 사용자가 즉시 모든 기능 사용 가능)
- 회원 상태 관리 (active/suspended/disabled 등)
- 회원 등급제 또는 멤버십 (membershipCode, membershipLevel 등)
- 라우트 레벨 권한 검사 (ProtectedRoute, RequireAuth 등)
- 관리자 기능 (adminProcedure 정의됨, 실제 기능 미구현)

### 9.4 현재 부족한 기능

1. **승인 프로세스**
   - 신규 사용자 가입 후 관리자 승인 필요 여부 결정 불가
   - 가입 대기 상태 없음

2. **회원 상태 관리**
   - 사용자 활성화/비활성화 불가
   - 계정 정지/일시중단 기능 없음

3. **회원 등급제**
   - 무료/유료 회원 구분 불가
   - 기능별 접근 제한 불가

4. **라우트 레벨 접근 제한**
   - 프론트에서 라우트 보호 없음
   - 권한 없는 사용자도 페이지 접근 후 서버에서 거부됨

5. **관리자 기능**
   - 관리자 전용 페이지/API 미구현
   - 사용자 관리, 통계, 설정 등 없음

### 9.5 다음 단계에서 추가해야 할 최소 기능

**우선순위 1 (필수):**
1. 신규 사용자 승인 프로세스
   - `approvalStatus` 필드 추가 (pending/approved/rejected)
   - 승인 대기 중인 사용자는 기능 제한
   - 관리자 승인 API

2. 회원 상태 필드
   - `status` 필드 추가 (active/suspended/deleted)
   - 상태에 따른 접근 제어

**우선순위 2 (권장):**
3. 라우트 레벨 권한 검사
   - `ProtectedRoute` 컴포넌트 추가
   - 권한 없는 사용자 자동 리다이렉트

4. 관리자 페이지
   - 사용자 관리
   - 승인 관리
   - 통계/대시보드

**우선순위 3 (선택):**
5. 회원 등급제 (필요시)
6. 기능별 접근 제한 (필요시)

---

## 10. 코드 위치 참고

| 항목 | 파일 | 줄 수 |
|------|------|------|
| OAuth 콜백 | `server/_core/oauth.ts` | 13-52 |
| 사용자 생성/업데이트 | `server/db.ts` | 21-78 |
| 인증 검증 | `server/_core/sdk.ts` | 259-310 |
| 인증 미들웨어 | `server/_core/trpc.ts` | 13-45 |
| 라우팅 | `client/src/App.tsx` | 20-33 |
| 인증 훅 | `client/src/_core/hooks/useAuth.ts` | 1-85 |
| DB 스키마 | `drizzle/schema.ts` | 8-23 |

---

## 11. 검증 방법

### 신규 사용자 가입 테스트
```
1. 브라우저에서 로그아웃
2. 구글 로그인 클릭
3. 새 구글 계정으로 로그인
4. DB에서 users 테이블 확인
   - 새 레코드 생성됨
   - role = 'user'
   - email 저장됨
5. /api/trpc/auth.me 호출
   - 사용자 정보 반환됨
```

### 권한 검사 테스트
```
1. 로그인 후 YouTube 트렌드 조회
   - 성공 (protectedProcedure)
2. 로그아웃 후 YouTube 트렌드 조회
   - 실패 (UNAUTHORIZED)
3. 네이버 트렌드 조회
   - 로그인 여부 관계없이 성공 (publicProcedure)
```

---

**보고 완료**
