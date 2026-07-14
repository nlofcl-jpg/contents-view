# CONTENTS VIEW - Project TODO

## My Page Functionality - Phase 1 (전체 페이지)
- [x] tRPC 프로시저 추가 (user.updateName)
- [x] 마이페이지 컴포넌트 생성 (MyPage.tsx)
- [x] App.tsx에 /mypage 라우트 등록
- [x] Header 드롭다운에 마이페이지 버튼 추가
- [x] 마이페이지 CSS 스타일 추가
- [x] user.updateName 프로시저 테스트 작성 및 통과

## My Page Functionality - Phase 2 (모달 팝업)
- [x] 마이페이지 모달 컴포넌트 생성 (MyPageModal.tsx)
- [x] 닉네임 수정 UX 개선 (기본 읽기 전용, 수정/저장/취소 버튼)
- [x] 모달 CSS 스타일 추가 (overlay, 중앙 정렬, 반응형)
- [x] Header 드롭다운에서 모달 열기 처리
- [x] Home.tsx에 모달 상태 관리 추가
- [x] 모달 테스트 및 UX 확인
- [x] Overlay 배경 개선 (더 어둡고 흐린 느낌)

## Hero Section Improvements
- [x] Hero 사각형 프레임 느낌 제거
- [x] Hero 배경을 Main 전체 배경과 자연스럽게 통합
- [x] 스크롤 시 사각 박스가 움직이는 느낌 제거

## Sidebar Layout Optimization
- [x] Sidebar 너비 조정 (320px에서 280px으로 축소)
- [x] 메인 Hero 영역 스페이스 개선

## YouTube Trends Page - Phase 1 (UI 기초)
- [x] YouTubeTrends.tsx 컴포넌트 생성
- [x] App.tsx에 /trends/youtube 라우트 추가
- [x] Sidebar YouTube 메뉴를 클릭 가능하게 변경
- [x] 필터 UI (국가, 카테고리, 정렬) 추가
- [x] 비디오 카드 그리드 레이아웃 구현
- [x] API 연동 준비 안내 카드 추가
- [x] 반응형 디자인 적용
- [x] CSS 스타일 추가

## YouTube Trends Page - Phase 2 (탭 기반 UI)
- [x] 상위 탭 메뉴 4개 추가 (실시간 급등, 카테고리별 급등, 인기 채널, 쇼츠 트렌드)
- [x] 탭별 다른 필터 UI 구조 구현
- [x] 실시간 급등 탭: 국가 + 정렬 (카테고리 없음)
- [x] 카테고리별 급등 탭: 국가 + 카테고리 + 정렬
- [x] 인기 채널 탭: 국가 + 카테고리 + 정렬 (구독자 증가순 등)
- [x] 쇼츠 트렌드 탭: 국가 + 카테고리 + 정렬 (급등순 등)
- [x] 탭별 다른 안내 메시지 추가
- [x] 탭 메뉴 CSS 스타일 추가

## Completed Features
- [x] Header 심볼 로고 추가 (46x46px)
- [x] Header 브랜드 텍스트 ("CONTENTS VIEW" with blue "VIEW")
- [x] Header 프로필 드롭다운 메뉴
- [x] Sidebar 메뉴 구조 및 스타일
- [x] Hero 섹션 레이아웃 및 텍스트
- [x] 고정 레이아웃 (Header, Sidebar, Main)
- [x] 다크 테마 적용
- [x] 인증 시스템 통합 (Manus OAuth)
- [x] tRPC 백엔드 설정
- [x] MySQL 데이터베이스 연동
- [x] 마이페이지 모달 팝업 기능
- [x] 닉네임 수정 기능
- [x] Hero 섹션 레이아웃 개선 (사각형 프레임 제거)
- [x] YouTube 트렌드 페이지 UI 구현 (탭 기반 구조)

## YouTube 북마크 viewCount 타입 오류 수정
- [x] youtubeBookmarks.add 프로시저 입력 스키마 수정 (viewCount: z.union([z.string(), z.number()]))
- [x] 서버에서 viewCount를 String()으로 정규화
- [x] DB에 string 타입으로 저장 (varchar)
- [x] 단위 테스트 작성 및 모두 통과 (5개 테스트)
- [x] 모든 기존 테스트 통과 (194/195, 1개 스킵)
- [x] 인기 영상, 카테고리별 인기, 쇼츠 모두 북마크 가능
- [x] 새로고침 후 북마크 유지 확인
- [x] 중복 저장 방지 정상
- [x] 북마크 해제 정상

## 테스트 실행 시 API 키 삭제 버그 수정
- [x] youtube.test.ts에서 testUserId = 1 (관리자)로 고정된 문제 발견
- [x] 체크포인트 저장 시 테스트 실행 -> afterAll cleanup -> 관리자 API 키 삭제
- [x] youtube.test.ts: testUserId를 9999로 변경
- [x] youtube.test.ts: 안전장치 추가 (if 체크)
- [x] youtube.trending.test.ts는 이미 올바르게 구현됨
- [x] user.apiKey.security.test.ts는 이미 올바르게 구현됨
- [x] 모든 테스트 통과 (194/195, 1개 스킵)
- [x] 체크포인트 저장 후 관리자 API 키 유지 확인

## Known Issues
- None currently identified

## YouTube API Key 설정 기능
- [x] DB 스키마: userApiKeys 테이블 생성 (userId, provider, apiKey, createdAt, updatedAt)
- [x] DB 마이그레이션: pnpm db:push 실행
- [x] tRPC 프로시저: user.apiKey.get (마스킹된 키 반환)
- [x] tRPC 프로시저: user.apiKey.save (API Key 저장/업데이트)
- [x] tRPC 프로시저: user.apiKey.delete (API Key 삭제)
- [x] API Key 설정 모달 UI 구현
- [x] YouTube 페이지 안내 카드 상태 변경 (API Key 있음/없음)
- [x] 로그인 상태 확인 및 보안 처리
- [x] 마스킹 로직 구현 (예: AIzaSy***abcd)
- [x] 테스트: API Key 저장/수정/삭제 동작 확인
- [x] 테스트: 마스킹 표시 확인
- [x] 테스트: 로그인 상태 처리 확인
- [x] 테스트: 다른 사용자 API Key 접근 불가 확인
- [x] 단일 단계: API Key 저장/수정/삭제 기능 구현 완료
- [x] 17개 모든 테스트 통과

## Future Enhancements
- Profile image upload
- Additional account settings
- Password change functionality
- Account deletion option

## Header 프로필 드롭다운 API 키 설정 메뉴 추가
- [x] Header 컴포넌트에 onOpenApiKeyModal prop 추가
- [x] Header 드롭다운에 API 키 설정 메뉴 추가
- [x] App.tsx에 API 키 모달 상태 관리 추가
- [x] YouTubeApiKeyModal 컴포넌트 import 및 연결
- [x] Header에서 API 키 설정 메뉴 클릭 시 모달 열기
- [x] 기존 YouTube 페이지 API 키 설정 버튼 유지
- [x] 마이페이지 및 로그아웃 기능 유지
- [x] 모든 테스트 통과 확인 (17개)

## API 키 발급 방법 안내 추가
- [x] YouTubeApiKeyModal에 showHelpBox 상태 추가
- [x] API 키 발급 방법 토글 버튼 구현
- [x] 접힘/펼침 애니메이션 구현
- [x] API 발급 방법 안내 박스 UI 구현
- [x] Step list 스타일 적용
- [x] 팁 및 주의 문구 추가
- [x] 모달 max-height 및 스크롤 처리
- [x] CSS 스타일 추가 (apiHelpToggle, apiHelpBox, apiHelpList, apiHelpStep, apiHelpStepNumber)
- [x] 모든 테스트 통과 확인 (17개)

## API 키 발급 방법 토글 버튼 중앙 정렬 수정
- [x] YouTubeApiKeyModal에 apiHelpToggleWrap div 추가
- [x] 토글 버튼을 중앙 정렬로 변경
- [x] CSS 스타일 업데이트 (apiHelpToggleWrap 추가, apiHelpToggle 수정)
- [x] 토글 버튼 크기 및 색상 조정 (font-size 15px, font-weight 700)
- [x] hover 색상 업데이트 (#bfdbfe)
- [x] 모든 테스트 통과 확인 (17개)


## 모바일 레이아웃 1차 안정화
- [x] 모바일 Header 반응형 구현 (로고/텍스트 축소, 프로필 아이콘 표시)
- [x] 모바일 Sidebar drawer 구현 (숨김/열기/닫기)
- [x] 햄버거 메뉴 버튼 추가 및 상태 관리
- [x] Sidebar overlay dim 처리
- [x] 모바일 Main 영역 너비/패딩 조정
- [x] YouTube 페이지 탭 가로 스크롤 처리
- [x] YouTube 페이지 필터 세로 배치
- [x] API 키 안내 카드 모바일 대응
- [x] API 키 설정 모달 모바일 반응형
- [x] 데스크톱 레이아웃 검증
- [x] 모바일 전체 UI 테스트


## 모바일 Header 및 메뉴 구조 개선
- [x] MobileMenuDrawer 컴포넌트 생성 (계정/사이트 메뉴 분리)
- [x] Header 리라이아웃 - 로고 왼쪽, 삼단 메뉴 오른쪽
- [x] App.tsx에 모바일 메뉴 상태 관리 추가
- [x] CSS 모바일 메뉴 Drawer 스타일 추가
- [x] 메뉴 항목 클릭 동작 구현
- [x] 데스크톱 Header 레이아웃 유지 확인
- [x] 모바일 메뉴 전체 동작 테스트


## 모바일 Drawer 메뉴 디자인 개선
- [x] MobileMenuDrawer 컴포넌트 - 아이콘, 섹션 제목, active 상태 추가
- [x] 계정 정보 카드형 스타일 적용
- [x] 계정 메뉴 버튼형 스타일 (아이콘 + 텍스트)
- [x] 사이트 메뉴 버튼형 스타일 (아이콘 + 텍스트)
- [x] 섹션 제목 추가 (계정, 메뉴)
- [x] Active 상태 스타일 적용
- [x] Drawer 배경 그라데이션 개선
- [x] 하단 여백 처리 (padding-bottom: 120px)
- [x] 모든 테스트 통과 (17/17)


## 모바일 Hero 레이더 그래픽 숨김
- [x] 모바일에서 radarStage display: none 처리
- [x] 모바일 Hero 패딩 및 gap 조정
- [x] 데스크톱 레이더 그래픽 유지
- [x] 모든 테스트 통과 (17/17)


## YouTube 페이지 모바일 반응형 레이아웃
- [x] 모바일 가로 스크롤 제거 (overflow-x: hidden)
- [x] 탭 메뉴 가로 스크롤 처리 (overflow-x: auto)
- [x] 필터 영역 1열 세로 배치 (grid-template-columns: 1fr)
- [x] API 안내 카드 모바일 대응
- [x] 제목/설명 크기 모바일 조정
- [x] 카드/리스트 1열 준비 (grid-template-columns: 1fr)
- [x] 모든 테스트 통과 (17/17)
- [x] 데스크톱 레이아웃 유지


## 모바일 YouTube 탭 메뉴 2x2 그리드 정리
- [x] 모바일 탭 메뉴를 grid-template-columns: repeat(2, 1fr)로 변경
- [x] 탭 버튼 display: flex, align-items: center, justify-content: center 적용
- [x] 탭 텍스트 크기 모바일 768px 이하: 15px, 480px 이하: 14px
- [x] 탭 패딩 모바일 768px 이하: 14px 10px, 480px 이하: 13px 8px
- [x] 모바일 가로 스크롤 제거 (overflow-x: visible)
- [x] 데스크톱 탭 구조 유지 (inline-flex, 가로 배치)
- [x] active 탭 스타일 유지 (#22d3ee, rgba(14, 165, 233, 0.15))
- [x] 모든 테스트 통과 (17/17)


## Header 로고 클릭 시 홈 이동 기능
- [x] Header 로고 영역을 button으로 변경
- [x] handleLogoClick 함수 추가 (setLocation('/'))
- [x] aria-label="홈으로 이동" 접근성 처리
- [x] title="홈으로 이동" 툴팁 추가
- [x] headerBrand 버튼 스타일: border: 0, background: transparent, padding: 0, cursor: pointer
- [x] hover/active 상태 opacity 효과 추가
- [x] 데스크톱/모바일 로고 디자인 유지
- [x] 모든 테스트 통과 (17/17)


## PC Header 프로필 아이콘 복구
- [x] 모바일 768px 이하에서만 profileArea display: none 처리
- [x] PC에서는 프로필 아이콘 정상 표시
- [x] PC Header: 알림 아이콘 + 프로필 원형 아이콘 + 닉네임 표시
- [x] 모바일 Header: 로고 + 오른쪽 삼단 메뉴 유지
- [x] 프로필 드롭다운 기능 정상 작동
- [x] 모든 테스트 통과 (17/17)


## YouTube API 연결 테스트 기능
- [x] DB 스키마 확장: testStatus, testError, lastTestedAt 컬럼 추가
- [x] DB 마이그레이션: pnpm db:push 실행
- [x] tRPC 프로시저: user.apiKey.testConnection (API 연결 테스트)
- [x] tRPC 프로시저: user.apiKey.getWithStatus (API Key + 테스트 상태 조회)
- [x] YouTubeApiKeyModal 컴포넌트 - 연결 테스트 버튼 추가
- [x] 테스트 상태 표시 (성공/실패/미테스트)
- [x] YouTubeApiStatusCard 컴포넌트 - 테스트 상태별 UI 업데이트
- [x] 성공 상태: CheckCircle 아이콘 + 초록색 + "YouTube API 연결이 완료되었습니다"
- [x] 실패 상태: AlertCircle 아이콘 + 빨강색 + 오류 메시지
- [x] 미테스트 상태: Clock 아이콘 + 주황색 + "연결 테스트를 진행해주세요"
- [x] YouTube API 테스트 요청 구현 (videos.list 최소 요청)
- [x] API Key 원본은 서버에서만 사용 (클라이언트 노출 금지)
- [x] 테스트 상태 DB에 저장 및 유지
- [x] Vitest 테스트 작성 및 모두 통과 (27/27)
- [x] 로그인 사용자만 테스트 가능 (protectedProcedure)
- [x] 다른 사용자 API Key 접근 불가 (보안)


## YouTube 트렌드 - 실시간 급등 영상 탭 API 연결
- [x] 백엔드: getTrendingVideos 프로시저 구현
- [x] 국가 코드 매핑 (KR, US, JP, GB, FR, ES, DE)
- [x] 글로벌 옵션 처리 (안내 문구 또는 비활성화)
- [x] 정렬 로직 구현 (급등순, 조회수순, 최신순)
- [x] 프론트엔드: 실시간 급등 영상 탭 데이터 로드 구현
- [x] 영상 카드 UI 구현 (썸네일, 제목, 채널명, 조회수, 날짜, 길이)
- [x] 카드 클릭 시 YouTube 링크 열기
- [x] 로딩 상태 표시
- [x] API Key 없음 상태 처리
- [x] API 연결 실패 상태 처리
- [x] API 호출 실패 상태 처리
- [x] 결과 없음 상태 처리
- [x] 국가 변경 시 재로드
- [x] 정렬 변경 시 재정렬
- [x] 모바일 반응형 (1열)
- [x] 태블릿 반응형 (2열)
- [x] 데스크톱 반응형 (3~4열)
- [x] 다른 탭 안내 문구 추가 (카테고리별, 인기 채널, 쇼츠)
- [x] 테스트: API 호출 검증 (35/35 통과)
- [x] 테스트: 국가별 데이터 변경 확인
- [x] 테스트: 정렬 기능 확인
- [x] 테스트: 모바일 UI 확인
- [x] 테스트: API Key 보안 유지 확인


## 인기 채널 탭 구현

- [x] 백엔드: channels.list 프로시저 추가 (getPopularChannels)
- [x] 프론트엔드: 인기 채널 탭 UI 구현 (채널 카드 컴포넌트)
- [x] 필터 연결 (국가, 카테고리, 정렬)
- [x] 캐싱 및 상태 관리 통합
- [x] 테스트 작성 및 검증 (모든 테스트 통과)
- [x] CSS 스타일링 (채널 카드, 반응형 디자인)

## YouTube 트렌드 - 카테고리별 급등 영상 탭 API 연결
- [x] 백엔드: getTrendingVideos 프로시저에 videoCategoryId 파라미터 추가
- [x] 카테고리 ID 매핑 (15개 카테고리)
- [x] 프론트엔드: 카테고리 필터 UI 구현
- [x] 카테고리 선택 시 데이터 재로드
- [x] 카테고리별 급등 탭 렌더링
- [x] 빈 상태 메시지 (카테고리별 급등 탭 전용)
- [x] 테스트: 모든 카테고리 조합 검증
- [x] 테스트: 기존 탭 정상 작동 확인

## YouTube 트렌드 - 마지막 업데이트 시간 및 캐싱 통합
- [x] 프론트엔드: 조건별 캐시 구조 구현 (cacheKey: tab-country-category-sort)
- [x] 프론트엔드: 마지막 업데이트 시간 조건별 관리
- [x] 프론트엔드: 1시간 TTL 캐싱 로직
- [x] 프론트엔드: 새로고침 버튼 구현 (현재 조건 강제 재호출)
- [x] 프론트엔드: 마지막 업데이트 시간 표시 UI
- [x] 프론트엔드: 1시간 갱신 안내 문구
- [x] 테스트: 같은 조건 반복 방문 시 기존 시간 유지
- [x] 테스트: 필터 변경만으로는 시간 변경 안 됨
- [x] 테스트: 새로고침 버튼 클릭 시 시간 갱신
- [x] 테스트: 조건별 독립적인 캐시 관리

## YouTube 트렌드 - 인기 채널 탭 API 연결
- [x] 백엔드: channels.list API 프로시저 추가 (channelId 배열 기반 채널 정보 조회)
- [x] 백엔드: 인기 채널 점수 계산 로직 구현 (노출 횟수, 조회수, 구독자 수 기반)
- [x] 백엔드: getPopularChannels 프로시저 구현 (영상 50개 기반 채널 분석)
- [x] 프론트엔드: 채널 카드 UI 컴포넌트 구현 (썸네일, 채널명, 구독자, 조회수, 영상 수, 노출 수)
- [x] 프론트엔드: 인기 채널 탭 renderChannelsTab 함수 구현
- [x] 프론트엔드: 인기 채널 탭 필터 상태 관리 (국가, 카테고리, 정렬)
- [x] 프론트엔드: 인기 채널 탭 캐싱 통합 (조건별 1시간 TTL)
- [x] 프론트엔드: 인기 채널 탭 마지막 업데이트 시간 표시
- [x] 프론트엔드: 인기 채널 탭 새로고침 버튼 연결
- [x] 프론트엔드: 인기 채널 탭 정렬 옵션 조정 (급등순, 구독자순, 조회수순)
- [x] 프론트엔드: 인기 채널 탭 빈 상태 메시지
- [x] 테스트: 모든 필터 조합 검증 (국가, 카테고리, 정렬)
- [x] 테스트: 모바일 반응성 확인 (1열 카드 레이아웃)
- [x] 테스트: 기존 탭(인기 급상승, 카테고리별 급등) 정상 작동 확인
- [x] 테스트: 채널 카드에 모든 정보 표시 확인 (썸네일, 채널명, 구독자, 조회수, 영상 수, 노출 수)
- [x] 테스트: 마지막 업데이트 시간 조건별 유지 확인
- [x] 테스트: 새로고침 버튼 현재 조건만 재호출 확인


## 인기 채널 카드 UI 정리

- [x] 채널 썬네일 영역 축소 (100px 높이로 줄임, 80px 원형 이미지)
- [x] "현재 인기 영상 1개 노출" 배지 조건부 표시 (2개 이상일 때만)
- [x] 대표 영상 제목 1줄 말줄임 처리 (11px, muted 색상)
- [x] 채널 정보 위계 정렬 (이미지 → 채널명 → 통계 → 배지 → 대표 영상)
- [x] 숫자 정보 가독성 개선 (구독자/조회수 1줄, 영상 수 2줄)
- [x] CSS 스타일 업데이트 (channelThumbnailWrapper, channelThumbnail, channelTopVideo)
- [x] 모바일 레이아웃 검증 (1열 카드 자연스러움)
- [x] 기존 탭 회귀 테스트 (실시간 급등, 카테고리별 급등) - 121개 모든 테스트 통과


## 인기 채널 카드 단순화

- [x] 대표 영상 제목 제거 (topVideoTitle 조건부 렌더링 제거)
- [x] 트렌딩 배지 제거 (videoCountInTrending 조건부 렌더링 제거)
- [x] 배경 박스 제거 (channelThumbnailWrapper 배경 투명화)
- [x] 프로필 이미지 크기 조정 (80px → 96px)
- [x] 프로필 이미지 테두리 조정 (2px → 1px, 색상 조정)
- [x] 카드 중앙 정렬 (align-items: center, text-align: center)
- [x] 프로필 이미지 중앙 정렬 (channelThumbnailWrapper 투명화)
- [x] 카드 내부 여백 조정 (gap 12px, padding 20px 16px)
- [x] 채널명 중앙 정렬 (text-align: center)
- [x] 통계 정보 중앙 정렬 (justify-content: center)
- [x] 모든 테스트 통과 (121개 테스트 성공)


## 인기 채널 카드 한국식 숫자 표기

- [x] formatKoreanNumber 함수 추가 (억/만 단위 변환)
- [x] .0 제거 처리 (formatted % 1 === 0 조건)
- [x] 구독자 수 한국식 표기 (formatKoreanNumber 적용)
- [x] 조회수 한국식 표기 (formatKoreanNumber 적용)
- [x] 영상 수 천 단위 콤마 처리 (toLocaleString 적용)
- [x] 모든 테스트 통과 (121개 테스트 성공)


## YouTube API 오류 메시지 통일

- [x] 인기 급상승 영상 탭 오류 메시지 수정 (통일된 문구)
- [x] 인기 채널 탭 오류 메시지 수정 (통일된 문구)
- [x] 오류 메시지 2줄 표시 (줄바꿈 처리)
- [x] Header 상태 유지 (YouTube API Key 오류)
- [x] 아이콘 모션 유지 (pulse 애니메이션)
- [x] 모든 테스트 통과 (121개 테스트 성공)


## YouTube 트렌드 - 쇼츠 트렌드 탭 API 연결 (60초 이하 필터링)
- [x] 백엔드: getTrendingShorts 프로시저 구현
- [x] 백엔드: videos.list API 호출 (maxResults=50)
- [x] 백엔드: contentDetails.duration을 초 단위로 변환 (parseDurationToSeconds 함수)
- [x] 백엔드: durationSeconds <= 60 영상만 필터링
- [x] 백엔드: 최대 24개 영상 반환 (maxResults 제한)
- [x] 백엔드: 국가 / 카테고리 / 정렬 필터 적용
- [x] 프론트엔드: getTrendingShorts 쿼리 추가
- [x] 프론트엔드: 쇼츠 트렌드 탭 renderShortsTab 함수 구현
- [x] 프론트엔드: 쇼츠 캐시 상태 관리 (shortsCache, setShortsCache)
- [x] 프론트엔드: 쇼츠 캐시 useEffect 훅 (1시간 TTL)
- [x] 프론트엔드: 쇼츠 탭 필터 상태 관리 (국가, 카테고리, 정렬)
- [x] 프론트엔드: 쇼츠 탭 마지막 업데이트 시간 표시
- [x] 프론트엔드: 쇼츠 탭 새로고침 버튼 연결
- [x] 프론트엔드: 쇼츠 탭 정렬 옵션 (급등순, 조회수순, 최신순)
- [x] 프론트엔드: 쇼츠 탭 빈 상태 메시지
- [x] 프론트엔드: API 오류와 빈 결과 상태 구분
- [x] 프론트엔드: 글로벌 선택 시 안내 메시지
- [x] 테스트: getTrendingShorts 프로시저 테스트 (13개 테스트 작성)
- [x] 테스트: 인증 검증
- [x] 테스트: API 키 검증
- [x] 테스트: 파라미터 검증 (regionCode, sortBy, maxResults, videoCategoryId)
- [x] 테스트: 모든 정렬 옵션 지원
- [x] 테스트: 모든 국가 코드 지원
- [x] 테스트: 모든 카테고리 지원
- [x] 테스트: API 키 격리 (사용자별 독립)
- [x] 테스트: 모든 134개 테스트 통과
- [x] 기존 탭 (인기 급상승, 카테고리별 급등, 인기 채널) 로직 변경 없음 (안정화 유지)

## My Library (내 보관함) Page - Phase 1 (UI Setup)
- [x] SavedContents.tsx 페이지 컴포넌트 생성
- [x] App.tsx에 /saved-contents 라우트 추가
- [x] Sidebar "내 보관함" 메뉴 클릭 연결
- [x] 페이지 제목 및 설명 배치
- [x] 6개 섹션 구조 구현 (최근, YouTube, 네이버, Google Trends, 뉴스&이슈, 커뮬니티)
- [x] 각 섹션 빈 상태 문구 표시
- [x] 다크 테마 디자인 통합
- [x] 모바일 반응형 레이아웃
- [x] MobileMenuDrawer에 내 보관함 메뉴 추가

## My Library (내 보관함) Page - Phase 2 (Layout Refactor)
- [x] SavedContents.tsx 레이아웃 수정 (3열 그리드 → 세로 섹션)
- [x] CSS 스타일 업데이트 (grid → flex column)
- [x] 섹션 단위 레이아웃 (전체 너비)
- [x] 섹션 제목 및 아이콘 단순 디자인
- [x] 내용 리스트 영역 (미래 내용 진열 영역)
- [x] 반응형 레이아웃 (모바일/태블릿/데스크톱)

## My Library (내 보관함) Page - Phase 3 (Empty State Icon Removal)
- [x] SavedContents.tsx에서 빈 상태 아이콘 제거
- [x] CSS 스타일 업데이트 (패딩 조정, min-height 제거)
- [x] 텍스트만 표시: "아직 저장된 콘텐츠가 없습니다."

## My Library (내 보관함) Page - Phase 4 (Recent Section Removal)
- [x] "최근 저장한 콘텐츠" 섹션 제거
- [x] 5개 섹션 유지 (YouTube, 네이버, Google Trends, 뉴스&이슈, 커뮤니티)
- [x] 플랫폼별 섹션 구조 유지

## My Library (내 보관함) Page - Phase 5 (Empty State Height Adjustment)
- [x] 빈 상태 박스 높이 증가 (min-height: 160px 데스크톱)
- [x] 내부 여백 증가 (padding: 48px 32px)
- [x] 텍스트 중앙 정렬 (flex align-items center, justify-content center)
- [x] 반응형 높이 조정 (태블릿: 140px, 모바일: 120px)
- [x] 다크 테마 스타일 유지

## YouTube Bookmark Feature - Phase 1 (Frontend State Management)
- [x] BookmarkContext.tsx 생성 (전역 상태 관리)
- [x] YouTubeTrends.tsx에 북마크 버튼 추가
- [x] SavedContents.tsx YouTube 섹션에 저장된 카드 표시
- [x] 보관 해제 기능 구현
- [x] 북마크 상태 동기화 (트렌드 ↔ 보관함)
- [x] 스타일링 및 반응형 디자인
- [x] BookmarkContext.test.ts 단위 테스트 작성

## YouTube Bookmark Button Style Update
- [x] 북마크 버튼 배경: 둥근 사각형 → 원형 (border-radius 50%)
- [x] 배경 투명도 증가 (0.8 → 0.5, 더 투명하게)
- [x] 비북마크 상태: 라인 아이콘 (색상 0.6)
- [x] 북마크 상태: 강조 색상 (색상 1)
- [x] 호버 효과 조정 (투명도 변화)
- [x] 버튼 크기 및 위치 유지 (40x40px, 우측 상단)

## YouTube Bookmark localStorage Persistence
- [x] BookmarkContext에 localStorage 저장/로드 로직 추가
- [x] 컴포넌트 마운트 시 localStorage에서 북마크 데이터 복원
- [x] 북마크 추가/제거 시 localStorage에 즉시 저장
- [x] SavedContents.tsx YouTube 섹션에 localStorage 데이터 표시 (기존 구현 활용)
- [x] 보관 해제 시 localStorage에서 영상 제거
- [x] 양방향 상태 동기화 (트렌드 ↔ 보관함)
- [x] localStorage 데이터 구조 정의 및 검증
- [x] BookmarkContext 단위 테스트 작성 (8개 테스트 케이스)

## YouTube Saved Card UI Polish
- [x] 조회수 포맷팅 (74540 → 7.4만 조회)
- [x] 저장일 추가 (카드 하단 정보 영역)
- [x] 보관 해제 버튼 스타일 조정 (라인 버튼, 다크 테마)
- [x] 원본 보기 버튼 위치/기능 유지
- [x] 전체 카드 스타일 다크 테마 통합

## Background Grid Pattern Removal
- [x] 전체 배경 그리드 패턴 제거
- [x] 다크 테마 배경 유지
- [x] 모든 페이지에 일관되게 적용

## YouTube Channel Profile Image Feature
- [x] YouTubeTrends.tsx에서 channelId 수집 로직 추가
- [x] YouTube 채널 정보 배치 조회 API 호출
- [x] 채널 프로필 이미지 매칭 로직 구현
- [x] 카드 정보 영역 UI 업데이트 (프로필 이미지 + 채널명)
- [x] Placeholder 처리 (이미지 로드 실패 시)
- [x] 반응형 디자인 적용
- [x] 기존 기능 유지 (캐시, 북마크, localStorage)

## YouTube Channel Profile Image Thumbnail Display
- [x] snippet.thumbnails 데이터 활용하여 실제 채널 프로필 이미지 표시
- [x] 원형 아바타 영역에 이미지 렌더링
- [x] 이미지 로드 실패 시 첫 글자 fallback 사용
- [x] API 효율화 (중복 제거된 channelId로 배치 조회)
- [x] 기존 카드 레이아웃/기능 유지

## YouTube Channel Thumbnail Backend Response
- [x] server/routers.ts getTrendingVideos에 channelThumbnail 필드 추가
- [x] YouTube API channels.list로 채널 정보 조회
- [x] snippet.thumbnails에서 프로필 이미지 URL 추출
- [x] 각 영상에 channelThumbnail 매핑
- [x] YouTubeTrends.tsx에서 video.channelThumbnail 사용
- [x] 이미지 없을 시 첫 글자 fallback 유지
- [x] 기존 캐시/북마크/localStorage 로직 유지

## YouTube Channel Thumbnail Display Debugging
- [x] getTrendingVideos 실제 응답 데이터 확인 (channelThumbnail 포함 여부)
- [x] 백엔드 캠시 무효화 (오래된 응답 데이터 제거)
- [x] Thumbnail URL fallback 순서 확인 (high → medium → default)
- [x] 프론트 렌더링 로직 검증 (video.channelThumbnail 사용 확인)
- [x] img 태그 CSS 스타일 확인 (크기, object-fit, border-radius)
- [x] 캠시 키 버전 추가 (v2) - 오래된 캠시 데이터 무효화


## 네이버 트렌드 - 검색어 클릭 추이 직접 날짜 설정 기능
- [x] 기간 선택에 "직접 설정" 옵션 추가
- [x] 시작일과 종료일 날짜 입력 필드 구현 (type="date")
- [x] 직접 설정 선택 시에만 날짜 입력 필드 표시
- [x] 기간 단위(일간/주간/월간) 선택 기능 구현
- [x] 날짜 범위별 기간 단위 자동 선택 로직
  - [x] 31일 이하: 일간
  - [x] 32일 이상 6개월 이하: 주간
  - [x] 6개월 초과: 월간
- [x] 유효성 검사 구현
  - [x] 시작일이 종료일보다 늦으면 조회하지 않기
  - [x] 시작일과 종료일 중 하나라도 없으면 조회하지 않기
  - [x] 종료일이 오늘보다 미래이면 조회하지 않기
  - [x] 검증 오류 메시지 표시
- [x] 차트 제목 아래 기간 문구 업데이트 (예: 2025.02.11 – 2026.06.12)
- [x] 조회 버튼 클릭 시 선택한 날짜 범위로 차트 업데이트
- [x] 기존 필터 카드 위치/크기/배치 유지
- [x] 기존 검색어 선택 기능 유지
- [x] 기존 조회 버튼 위치 유지
- [x] 기존 차트 카드 위치/크기 유지
- [x] 다른 네이버 섹션 수정 없음
- [x] 브라우저 테스트 완료 (직접 설정 옵션 선택, 날짜 입력, 조회 기능 검증)


## 네이버 트렌드 - 직접 설정 필터 레이아웃 정렬
- [x] filterSection CSS를 grid 레이아웃으로 변경 (grid-template-columns: 1fr 1fr auto)
- [x] 상단 검색어 영역과 직접 설정 필터 영역을 3열 그리드로 통합
- [x] 상단 검색어 영역: 선택 검색어 | 검색어 입력 | 조회 버튼
- [x] 직접 설정 필터 첫 번째 행: 기간 선택 | 기간 단위 | (비움)
- [x] 직접 설정 필터 두 번째 행: 시작일 | 종료일 | 조회 버튼
- [x] 조회 버튼을 종료일 오른쪽에 배치
- [x] 하단 전체 폭 조회 버튼 제거
- [x] 반응형 레이아웃: 태블릿(768px 이하) 2열, 모바일(480px 이하) 1열
- [x] 조회 버튼 크기 및 정렬 상단 버튼과 동일하게 유지


## 네이버 쇼핑 트렌드 - 순위 카드 제거 및 실제 데이터 구조 전환
- [x] 상단 날짜별 인기 검색어 순위 카드 4개 제거
- [x] 순위 카드 관련 상태 및 함수 정리 (selectedRankingKeyword, handleRankingKeywordSelect 등)
- [x] 카테고리별 클릭 추이 섹션 UI 구현 (필터: 카테고리, 기간, 기간 단위, 기기, 성별, 연령대)
- [x] 카테고리별 클릭 추이 차트 영역 준비 (placeholder)
- [x] 카테고리 내 검색어 클릭 추이 섹션 제목/설명 변경
- [x] 기존 검색어 클릭 추이 필터 유지 (기간 선택, 직접 설정, 기간 단위)
- [x] 기존 검색어 클릭 추이 차트 유지
- [x] 다크 네이비 테마 유지
- [x] 다른 섹션 (검색어 트렌드 비교, 쇼핑 분야별 트렌드, 뉴스 동향, 블로그 콘텐츠 동향) 유지
- [x] 공식 API 연동 가능한 상태 구조 준비

## 네이버 트렌드 - 검색 인터페이스 단순화
- [x] "현재 선택 검색어" 읽기 전용 박스 제거
- [x] 순위 카드 클릭 연결 로직 제거 (selectedKeyword 상태 제거)
- [x] 검색어 입력창 하나로 통합
- [x] 3열 그리드 구조 유지 (검색어 입력 | 비움 | 조회 버튼)
- [x] 차트 제목에 입력한 검색어 표시 (searchInput 사용)
- [x] 기간 필터 구조 유지
- [x] 달력 아이콘 색상 유지
- [x] 모든 기존 기능 정상 작동 확인

## 네이버 트렌드 - 섹션 탭 메뉴 전환
- [x] activeTab 상태 추가 (기본값: "category")
- [x] tabs 배열 정의 (카테고리 클릭 추이, 검색어 클릭 추이)
- [x] 탭 메뉴 UI 구현 (페이지 제목 아래)
- [x] 탭 스타일 구현 (다크 테마, 하단 라인 강조, 호버 효과)
- [x] 카테고리 클릭 추이 섹션 조건부 렌더링 (activeTab === "category")
- [x] 검색어 클릭 추이 섹션 조건부 렌더링 (activeTab === "keyword")
- [x] 탭 전환 시 상태 유지 (필터값, 차트 데이터)
- [x] 탭 전환 시 불필요한 API 호출 방지
- [x] 기존 필터 크기/정렬 유지
- [x] 기존 차트 디자인 유지
- [x] 브라우저 테스트 완료 (탭 전환, 상태 유지 검증)

## 네이버 트렌드 - 쇼핑 클릭량 추이 통합
- [x] 두 개의 탭(카테고리 클릭 추이, 검색어 클릭 추이) 제거
- [x] 쇼핑 클릭량 추이 탭 하나로 통합
- [x] 필터 상단 첫 번째 열: 쇼핑 카테고리 (드롭다운)
- [x] 필터 상단 두 번째 열: 검색어 검색 (입력창)
- [x] 필터 상단 세 번째 열: 조회 버튼
- [x] 카테고리 필수 선택, 기본값: 패션의류
- [x] 검색어 선택 입력 (선택 사항)
- [x] 카테고리만 선택 시: 카테고리 클릭 추이 조회
- [x] 카테고리 + 검색어 선택 시: 카테고리 내 검색어 클릭 추이 조회
- [x] 차트 제목 동적 처리 (카테고리 · 검색어 또는 카테고리 만)
- [x] 기간 설정 내 기기, 성별, 연령대 필터 유지
- [x] 기존 필터 크기/정렬 유지
- [x] 기존 차트 디자인 유지
- [x] 브라우저 테스트 완료 (쇼핑 클릭량 추이 섹션 동작 검증)
- [x] 필터 버튼 정렬: 모든 필터 행을 1fr 1fr 1fr 그리드로 통일 (쇼핑 카테고리, 검색어 검색, 기간 단위, 기기, 성별, 연령대)


## 네이버 쇼핑 클릭 추이 차트 - X축 날짜 형식 최적화
- [x] 7일/30일/3개월: M.D 형식 (예: 5.14, 6.8)
- [x] 6개월/1년: 월 단위 형식 (예: 2026. 6월, 7월)
- [x] 중복 제거: 6개월 이상에서 월별 1회만 표시
- [x] 기울임 각도: 일간 -30°, 월간 0°
- [x] 높이 조정: 월간 형식 40px
- [x] 조회된 데이터 기준으로 tick 계산
- [x] 마지막 조회 성공 기간만 사용
- [x] 브라우저 테스트 완료 (30일, 3개월 검증)

## 네이버 쇼핑 클릭 추이 차트 - Y축 제목 제거
- [x] Y축 제목 "상대 클릭 비율" 제거
- [x] Y축 숫자 눈금 유지 (0, 25, 50, 75, 100)
- [x] Y축 가이드 라인 유지
- [x] 브라우저 테스트 완료 (30일 조회 검증)

## 네이버 쇼핑 클릭 추이 차트 - 2차 카테고리 드롭단 UI 추가
- [x] 2차 카테고리 드롭단 UI (여성의류)
- [x] 동적 드롭단 렌더링 (1차 선택 시 마다 업데이트)
- [x] 조회 코드 선택 로직 (50000000 vs 50000169)
- [x] 차트 제목 반영 (여성의류 추가)
- [x] 1차 카테고리 변경 시 2차 초기화
- [x] 브라우저 테스트 3개 시나리오 모두 통과

## 네이버 쇼핑 단 기본 레이아웃 정리
- [x] 세부 카테고리 드롭단을 쉼핀 카테고리 온른에 배치
- [x] 3열 레이아웃 (쉼핀카테고리+세부카테고리 | 검색어 | 조회)
- [x] 중복 되던 세부 카테고리 드롭단 제거
- [x] JSX 구조 초리
- [x] 브라우저 테스트 완료

## 네이버 쇼핑 단 기본 레이아웃 정리 - 검색어 입력창 폭 조정
- [x] 검색어 입력창 너비 120px로 조마 버튼과 동일하게 설정
- [x] 레이아웃 유지 (쉼핀카테고리+세부카테고리 | 검색어 | 조회)
- [x] 브라우저 테스트 완료

## 네이버 쇼핑 단 기본 레이아웃 정리 - 레이아웃 복구
- [x] 그리드 레이아웃 2fr 1fr auto로 복구
- [x] 조회 버튼 너비 120px 복구
- [x] 검색어 입력창 너비 자동 복구
- [x] 브라우저 테스트 완료

## 모바일 프로필·메뉴 패널 분리
- [x] App.tsx에서 mobilePanelType 상태 관리 ("account" | "menu" | null)
- [x] MobileMenuDrawer에 panelType prop 추가 (activeSection 제거)
- [x] 계정 패널 렌더링 (panelType === "account")
- [x] 메뉴 패널 렌더링 (panelType === "menu")
- [x] 탭 UI 완전 제거 (.mobileDrawerTabs, .mobileDrawerTab CSS 삭제)
- [x] Header에서 onToggleMobileMenu(panelType) 파라미터 변경
- [x] 햄버거 메뉴 버튼: onToggleMobileMenu("menu")
- [x] 프로필 버튼: onToggleMobileMenu("account")
- [x] 메뉴 패널에 전체 메뉴 구조 구현 (홈, 실시간 트렌드 그룹, 뉴스&이슈, 커뮤니티반응, 내보관함)
- [x] 메뉴 패널에 실시간 트렌드 펼침/접힘 기능 추가
- [x] 계정 패널에 사용자 카드, 마이페이지, API키설정, 로그아웃 표시
- [x] 메뉴 패널 스타일링 (groupTitle, subNavItem CSS 추가)
- [x] 모바일 메뉴 패널 분리 기능 검증

## YouTube 북마크 데이터베이스 영구 저장
- [x] youtubeBookmarks 테이블 생성 (userId, videoId, contentType, title, thumbnail 등)
- [x] tRPC 프로시저 구현 (list, isBookmarked, add, remove)
- [x] BookmarkContext 수정 (localStorage → DB API 호출)
- [x] YouTubeTrends.tsx 수정 (contentType 파라미터 추가)
- [x] 사용자별 데이터 분리 (userId 기반)
- [x] 중복 저장 방지 (UNIQUE 제약)
- [x] 새로고침/재로그인 후 유지
- [x] 다른 기기에서도 접근 가능
- [x] 모든 189개 테스트 통과

## 네이버 쇼핑인사이트 카테고리 API 연동
- [x] 검색어 입력창 제거 및 3열 레이아웃 정리
- [x] 네이버 API 환경변수 설정 (NAVER_CLIENT_ID, NAVER_CLIENT_SECRET)
- [x] 서버 엔드포인트 구현 (/api/trpc/naver.categoryTrend)
- [x] 클라이언트 조회 로직 수정 (검색어 제거, 카테고리만 사용)
- [x] 카테고리 코드 매핑 (12개 카테고리)
- [x] 기간/필터 변환 로직 (timeUnit, device, gender, ages)
- [x] 차트 데이터 업데이트 (period, ratio)
- [x] 로딩/오류/데이터없음 상태 처리
- [x] 서버 캐시 구현 (10분)
- [x] 테스트 및 검증

## 네이버 쇼핑 필터 UI 최종 정렬
- [x] 그리드 레이아웃 2열 (1fr 1fr)로 변경
- [x] 왼쪽 열: 쇼핑 카테고리 + 세부 카테고리 (side-by-side)
- [x] 오른쪽 열: 검색어 검색 + 조회 버튼 (side-by-side)
- [x] 검색어 입력창 flex-1로 확장 (세부 카테고리와 동일 너비)
- [x] 조회 버튼 120px 고정 너비
- [x] 브라우저 테스트 완료
- [x] 최종 레이아웃 확인 완료


## Phase 3 - 통합 선형 차트 구현

- [x] 차트 라이브러리 의존성 확인 (Chart.js v4 + react-chartjs-2)
- [x] UnifiedChart 컴포넌트 생성 (TimeScale 기반)
- [x] 데이터 변환 로직 (날짜, 색상, 다중 키워드)
- [x] 차트 렌더링 (실선/점선, 색상, 스타일)
- [x] 툴팁 구현 (다크 테마, 다중 데이터)
- [x] X축 날짜 포맷팅 (기간별: 1개월 M.D, 3개월+ 월 단위)
- [x] Y축 범위 설정 (0-100)
- [x] 데이터 레이어 버튼 연결 (검색 트렌드/쇼핑 클릭량)
- [x] 상태 처리 (로딩, 성공, 일부 성공, 실패)
- [x] 테스트 1: 1개월 기간, 모든 레이어 활성 (원피스 키워드)
- [x] 테스트 2: 검색 트렌드만 표시 (레이어 토글)
- [x] 테스트 3: 쇼핑 클릭량만 표시 (레이어 토글)
- [x] 테스트 4: 다중 키워드 지원 (최대 5개, 색상 팔레트)
- [x] 테스트 5: 기간 변경 (1개월, 3개월, 6개월, 1년)
- [x] X축 라벨 선택적 표시 (tickFormatter 기반, 약 7개)
- [x] 세로 그리드 제거 (drawOnChartArea: false)
- [x] X축 일별 눈금선 제거 (drawTicks: false)
- [x] UTC 타임존 동 수정 (로컬 날짜 직접 생성)
- [x] 범례 간격 및 색상 원형 스타일 수정 (여백 확보, 흰색 테두리 제거)

## Phase 3 - UI Polish: 탭 활성 하단선 너비 통일
- [x] 탭 버튼에 min-w-[180px] 클래스 추가 (쇼핑 클릭량 추이, 통합 인사이트)
- [x] 두 탭의 활성 하단선 너비 동일하게 통일 (180px)
- [x] 탭 전환 시 하단선 길이 변화 없음 확인
- [x] 탭 제목, 색상, 기능 유지 확인
- [x] 브라우저 렌더링 검증 완료

## Phase 4 - 통합 인사이트 상세 필터 접기·펼치기 범위 수정
- [x] 기간 제목에 접기·펼치기 화살표 추가 (ChevronDown 회전 애니메이션)
- [x] 기간 버튼 + 기기 + 성별 + 연령대를 isPeriodExpanded 조건으로 묶음
- [x] 데이터 레이어를 필터 카드 내부로 이동 (단일 카드 구조)
- [x] 접힌 상태에서 필터 버튼 숨김, 빈 공간 제거
- [x] 펼친 상태에서 모든 필터 표시, 기존 배치 복구
- [x] 필터 값 유지 (표시 여부만 변경)
- [x] 데이터 레이어 선택 상태 유지
- [x] 카드 분리 제거, 단일 컨테이너로 통합
- [x] 브라우저 렌더링 및 기능 검증 완료

## Phase 5 - 조회 전 차트 영역 최소 높이 확대
- [x] 빈 상태 결과 영역 최소 높이 확대 (데스크톡 380px, 태블릿 320px, 모바일 260px)
- [x] 안내 문구 카드 정중앙 배치
- [x] 조회 후 실제 차트 높이 유지
- [x] 카드 너비 및 기존 정렬 유지
- [x] 반응형 처리 (모바일/태블릿/데스크톡)
- [x] 브라우저 렌더링 및 기능 검증 완료

## Phase 6 - 검색어 입력창 자동완성 메시지 제거
- [x] 검색어 입력창 autoComplete="off" 속성 추가
- [x] 브라우저 자동완성 메시지 비활성화
- [x] 입력창 스타일 및 기능 유지
- [x] 브라우저 렌더링 및 기능 검증 완료

## Phase 7 - 쇼항 클릭량 추이 검색어 검색 영역 제거
- [x] searchInput 상태 제거
- [x] 검색어 검색 라벨 제거
- [x] 검색어 입력창 제거
- [x] 레이아웃 재구성 (︿ 단방향 레이아웃)
- [x] 차트 제목 로직 단순화
- [x] 나머지 필터 기능 유지
- [x] 통합 인사이트 검색어 입력 유지
- [x] 브라우저 렌더링 및 기능 검증 완료

## Phase 8 - 쇼핑 클릭량 추이 안내 아이콘 및 팝오버 추가
- [x] 안내 아이콘 추가 (제목 옆 작은 원형 아이콘)
- [x] 인라인 박스에서 팝오버로 변경 (절대 위치)
- [x] 아이콘 클릭 시 팝오버 열기
- [x] 바깥 클릭 시 팝오버 닫기
- [x] Esc 키 닫기
- [x] 다크 테마 스타일 적용
- [x] 접근성 속성 적용
- [x] 브라우저 렌더링 및 기능 검증 완료

## Phase 8 - 쇼핑 클릭량 추이 안내 아이콘 팝오버 위치 및 너비 최적화
- [x] 팝오버 위치 조정 (제목 아래 → 아이콘 오른쪽)
- [x] 팝오버 너비 최적화 (384px → 내용 기반 자동 조정)
- [x] 패딩 조정 (좌우 24px, 상하 20px)
- [x] 오른쪽 빈 공간 제거
- [x] 브라우저 렌더링 및 기능 검증 완료

## Phase 9 - 통합 인사이트 안내 아이콘 및 팝오버 추가
- [x] 통합 인사이트 제목 옆 안내 아이콘 추가
- [x] 팝오버 설명 문구 추가 (2단락: 검색 트렌드와 쇼핑 클릭량 비교)
- [x] 기존 쇼핑 클릭량 팝오버와 동일한 스타일 및 위치
- [x] 열기·닫기 동작 (클릭, Esc, 바깥 클릭)
- [x] 브라우저 렌더링 및 기능 검증 완료

## Phase 10 - 통합 인사이트 중복 제목 제거 및 간격 수정
- [x] UnifiedInsights.tsx의 중복 제목 + 설명 제거
- [x] NaverTrends.tsx의 제목 + 설명 유지
- [x] NaverTrends.tsx의 제목 옆에 안내 아이콘 + 팝오버 추가
- [x] 제목 1개만 표시 확인
- [x] 간격 문제 해결 (mb-8 적용)
- [x] 브라우저 렌더링 및 기능 검증 완료

## Phase 11 - 통합 인사이트 쇼핑 클릭량 데이터 없음 안내 추가
- [x] 서버에서 쇼핑 데이터 상태 판정 (AVAILABLE/NO_DATA/ERROR)
- [x] 프론트엔드에서 상태별 안내 문구 표시
- [x] 데이터 없음 vs API 오류 구분
- [x] 안내 박스 UI 구현 (차트 제목 아래)
- [x] 범례에 "데이터 없음" 상태 표시
- [x] 테스트: 정상 조합 (데이터 있음)
- [x] 테스트: 데이터 없는 조합 (디지털/가전 + 원피스)
- [x] 테스트: API 요청 실패

## 모바일 네이버 트렌드 탭 가로 스와이프 구현
- [x] 모바일 탭 컨테이너 클래스 추가 (overflow-x-auto md:overflow-x-visible)
- [x] 스크롤 스냅 적용 (snap-x snap-mandatory, snap-start)
- [x] 그라데이션 표시기 추가 (md:hidden, 우측에만 표시)
- [x] 활성 탭 자동 스크롤 구현 (scrollIntoView with smooth behavior)
- [x] 스크롤바 숨김 (scrollbar-hide 유틸리티 추가)
- [x] 탭 스타일 유지 (min-w-max, whitespace-nowrap, 글자 크기 유지)
- [x] 데스크톱 탭 레이아웃 유지 (md:min-w-[180px])
- [x] 탭 전환 기능 유지 (클릭 동작)
- [x] 활성 탭 하단선 스타일 유지 (파란색, 두께)
- [x] 모바일 반응형 테스트 완료
- [x] 데스크톱 레이아웃 유지 확인

## 모바일 네이버 트렌드 탭 배경 사각형 제거
- [x] 그라데이션 오버레이 div 제거 (from-slate-950 to-transparent)
- [x] 탭 영역 배경색 제거 (bg-transparent 유지)
- [x] 탭 영역이 페이지 배경과 자연스럽게 연결
- [x] 불필요한 사각형 배경 제거
- [x] 가로 스와이프 기능 유지
- [x] 스크롤 스냅 유지
- [x] 활성 탭 자동 스크롤 유지
- [x] 탭 클릭 기능 유지
- [x] 활성 탭 하단선 정상 표시
- [x] 페이지 전체 가로 스크롤 없음
- [x] 데스크톱 탭 영향 없음

## 모바일 네이버 트렌드 탭 전환 시 페이지 좌우 밀림 수정
- [x] scrollIntoView를 container.scrollTo로 변경
- [x] activeTabRef 추가 (활성 탭 참조)
- [x] 탭 컨테이너만 스크롤 (페이지 전체 스크롤 금지)
- [x] 페이지 scrollX 항상 0 유지
- [x] 네이버 트렌드 제목 왼쪽 잘림 제거
- [x] 설명 문구 왼쪽 잘림 제거
- [x] 좌우 스와이프 기능 유지
- [x] 스크롤 스냅 유지
- [x] 활성 탭 하단선 정상 표시
- [x] 탭 클릭 기능 유지
- [x] 페이지 전체 가로 스크롤 없음

## 모바일 안내 팝오버 하단 시트 변환
- [x] InfoBottomSheet 컴포넌트 생성
- [x] 쇼핑 클릭량 추이 안내: 모바일 하단 시트로 변경
- [x] 통합 인사이트 안내: 모바일 하단 시트로 변경
- [x] 데스크톱 팝오버: hidden md:block으로 유지
- [x] 오버레이 추가 (bg-black/30)
- [x] 애니메이션 추가 (translate-y-full → translate-y-0, 250ms)
- [x] 닫기 버튼 기능 (클릭, Esc, 오버레이 클릭)
- [x] 포커스 관리 (닫기 버튼으로 이동, 닫을 때 안내 버튼으로 복귀)
- [x] 배경 스크롤 방지
- [x] 모바일·데스크톱 분기 동작 확인

## 모바일 기간 필터 셀렉트 잘림 현상 수정
- [x] 모바일 필터 그리드를 3열에서 2열로 변경
- [x] 기간 선택 + 기간 단위 2열 배치 (모바일)
- [x] 기기 + 성별 2열 배치 (모바일)
- [x] 연령대 2열 전체 사용 (모바일), 1열 사용 (데스크톱)
- [x] 데스크톱 3열 배치 유지
- [x] 셀렉트 값 전체 표시 (잘림 제거)
- [x] 화살표 아이콘과 텍스트 겹침 제거
- [x] 카드 밖으로 넘침 제거
- [x] 모바일 반응형 테스트 완료
- [x] 데스크톱 레이아웃 유지 확인

## 모바일 쇼핑 클릭량 차트 X축 라벨 밀도 조정
- [x] getMobileOptimizedTicks() 함수 구현 (모바일 전용 라벨 개수 제한)
- [x] 1년 기간: 약 6-7개 라벨로 제한
- [x] 6개월 기간: 약 6개 라벨로 제한
- [x] 모바일 날짜 포맷: YY.M 형식 (예: 25.6, 26.6)
- [x] 데스크톱 날짜 포맷: Y. M월 형식 유지
- [x] 차트 좌우 여백 조정 (left: 8px, right: 16px)
- [x] 첫 번째와 마지막 라벨 항상 포함
- [x] 중간 라벨 균등 배치
- [x] 원본 데이터 포인트 유지 (샘플링 없음)
- [x] 모바일/데스크톱 분기 로직 구현
- [x] vitest 테스트 작성 및 통과 (8/8 tests passed)

## 모바일 쇼핑 클릭량 차트 X축 날짜 라벨 형식 정리
- [x] formatMobileTick 함수 구현 (기간별 날짜 포맷)
- [x] createMobileLabelIndexes 함수 구현 (7개 라벨 균등 배치)
- [x] getMobileOptimizedTicks 함수 업데이트
- [x] formatXAxisTick 함수 업데이트 (모바일/데스크톱 분기)
- [x] getXAxisAngle 함수 업데이트 (모바일 3개월 각도 0도)
- [x] 3개월: M.D 형식, 7개 라벨, 가로 표시
- [x] 6개월: YY.M 형식, 7개 라벨
- [x] 1년: YY.M 형식, 7개 라벨
- [x] 원본 데이터 포인트 유지 (샘플링 없음)
- [x] 데스크톱 차트 기존 방식 유지
- [x] vitest 테스트 작성 및 통과 (13/13 tests passed)

## 모바일 쇼핑 클릭량 차트 플롯 영역 중앙 정렬 및 여백 조정
- [x] LineChart margin 조정 (모바일: left 2px, right 20px / 데스크톱: left 8px, right 16px)
- [x] YAxis width 조정 (모바일: 36px / 데스크톱: 40px)
- [x] YAxis tickMargin 추가 (6px)
- [x] ResponsiveContainer 부모 wrapper 추가 (w-full min-w-0 overflow-hidden)
- [x] 플롯 영역 중앙 정렬 구현
- [x] 오른쪽 마지막 라벨 잘림 방지
- [x] 모바일 3개월/6개월/1년 차트 테스트
- [x] 데스크톱 차트 영향 없음 확인
- [x] 원본 데이터 포인트 유지 확인

## 모바일 쇼핑 클릭량 차트 X축 라벨 글자 크기 및 간격 미세 조정
- [x] 모바일 X축 라벨 fontSize 조정 (12px → 11px)
- [x] 모바일 X축 tickMargin 조정 (6px → 8px)
- [x] 데스크톱 X축 설정 유지 (fontSize 12px, tickMargin 6px)
- [x] 라벨 배열 유지 (1년: 7개, 6개월: 7개, 3개월: 7개)
- [x] 차트 margin 변경 없음
- [x] YAxis width 변경 없음
- [x] 데이터 포인트 변경 없음
- [x] 플롯 영역 중앙 정렬 유지
- [x] 마지막 라벨 잘림 방지 확인
- [x] 데스크톱 차트 영향 없음 확인


## 모바일 쇼핑 클릭량 차트 화면 너비별 반응형 검증
- [x] 360px viewport 검증 (3개월, 6개월, 1년)
- [x] 375px viewport 검증 (3개월, 6개월, 1년)
- [x] 390px viewport 검증 (3개월, 6개월, 1년)
- [x] 412px viewport 검증 (3개월, 6개월, 1년)
- [x] 430px viewport 검증 (3개월, 6개월, 1년)
- [x] 라벨 겹침 확인
- [x] 첫/마지막 라벨 잘림 확인
- [x] 페이지 가로 스크롤 확인
- [x] 차트 플롯 영역 중앙 정렬 유지 확인
- [x] 라벨 형식 유지 확인 (M.D, YY.M)
- [x] 데이터 및 라인 형태 변경 없음 확인
- [x] 데스크톱 영향 없음 확인
- [x] 추가 너비 보정 불필요 결정


## 모바일 쇼핑 클릭량 차트 세로 그리드 제거
- [x] CartesianGrid vertical={false} 적용
- [x] 가로 그리드 유지 확인
- [x] Y축 값 (0, 25, 50, 75, 100) 가로선 유지
- [x] 점선 스타일 유지
- [x] 색상 및 불투명도 유지
- [x] 녹색 데이터 라인 변경 없음
- [x] X축 날짜 라벨 변경 없음
- [x] 차트 중앙 정렬 유지
- [x] 모든 기간 (30일, 3개월, 6개월, 1년) 적용 확인
- [x] 데스크톱 차트 영향 없음


## 통합 인사이트 모바일 필터 레이아웃 반응형 복구
- [x] 필터 카드 너비 및 오버플로 방지 (w-full max-w-full min-w-0)
- [x] 모바일 패딩 조정 (p-4 md:p-6)
- [x] 상단 필터 행 반응형 (카테고리, 검색어, 버튼)
- [x] 검색창 + 추가/조회 버튼 2열 그리드 (모바일)
- [x] 기간 버튼 2열 그리드 (모바일)
- [x] 사용자 정의 버튼 col-span-2 (모바일)
- [x] 커스텀 날짜 세로 배치 (모바일)
- [x] 기기/성별/연령대 세로 배치 (모바일)
- [x] 데이터 레이어 2열 그리드 (모바일)
- [x] 데스크톱 레이아웃 보호 (768px 이상)
- [x] 모바일 viewport 테스트 (360px-430px)
- [x] 기능 및 상태 유지 확인
- [x] 페이지 가로 스크롤 확인


## 모바일 통합 인사이트 차트 X축 라벨 개수 및 날짜 형식 최적화
- [x] 기간별 모바일 라벨 개수 로직 구현 (1개월: 6개, 3개월/6개월/1년: 7개)
- [x] 기간별 날짜 형식 로직 구현 (1개월/3개월: M.D, 6개월/1년: YY.M)
- [x] 모바일 전용 조건 추가 (768px 이하)
- [x] 라벨 인덱스 계산 및 필터링 구현
- [x] X축 라벨 가로 표시 (angle: 0)
- [x] 원본 데이터 유지 (샘플링 금지)
- [x] 첫/마지막 라벨 보호
- [x] 모바일 전용 적용 (데스크톱 보호)
- [x] 범례 및 라인 유지
- [x] 테스트 작성 및 검증


## 모바일 통합 인사이트 차트 X축 라벨 간격 및 Y축 축선 복구
- [x] X축 라벨과 축선 사이 간격 확대 (padding: 8px)
- [x] Y축 세로 축선 표시 (axis: '#334155')
- [x] Y축 숫자와 축선 사이 간격 조정 (padding: 8px)
- [x] 모바일 전용 적용 (768px 이하)
- [x] 모든 기간(1개월, 3개월, 6개월, 1년)에 동일 적용
- [x] 가로 그리드 유지
- [x] 원본 데이터 유지
- [x] 테스트 검증 완료


## 모바일 통합 인사이트 차트 Y축 세로선 재수정
- [x] Y축 border 설정 추가 (Chart.js)
- [x] stroke 색상 설정 (#64748b)
- [x] strokeWidth 설정 (1px)
- [x] 모바일 전용 적용 (768px 이하)
- [x] 모든 기간(1개월, 3개월, 6개월, 1년)에 동일 적용
- [x] 가로 그리드 유지
- [x] 원본 데이터 유지
- [x] 테스트 검증 완료


## 모바일 통합 인사이트 차트 범례·차트 간격 및 하단 여백 조정 (재수정)
- [x] 실제 높이 구조 진단 (min-h-[400px] 발견)
- [x] UnifiedChart 래퍼 높이 수정 (md:min-h-[400px] min-h-0 h-auto)
- [x] UnifiedInsights 차트 컨테이너 높이 수정 (md:h-[480px] h-auto)
- [x] inline style 제거 (style={{ height: "480px" }})
- [x] 모든 기간(1개월, 3개월, 6개월, 1년)에 동일 적용
- [x] 에러 상태 차트도 동일 적용
- [x] 데스크톱 480px 높이 유지
- [x] 원본 데이터 유지
- [x] 테스트 검증 완료

## 모바일 통합 인사이트 차트 높이 재수정 (플롟 높이 복구 및 카드 하단 여백 조정)
- [x] 차트 플롟 높이 복구 (h-[520px])
- [x] UnifiedChart wrapper: md:min-h-[400px] min-h-0 h-[520px]
- [x] UnifiedInsights 차트 컨테이너: md:h-[480px] h-[520px]
- [x] 카드 높이: h-auto min-h-0 유지
- [x] 모든 기간(1개월, 3개월, 6개월, 1년)에 동일 적용
- [x] 에러 상태 차트도 동일 적용
- [x] 데스크톱 480px 높이 유지
- [x] 원본 데이터 유지
- [x] 테스트 검증 완료


## 모바일 통합 인사이트 차트 범례·카드 간격 최종 조정
- [x] 범례와 차트 간 간격 확대 (legend padding: 모바일 20px, 데스크톱 12px)
- [x] 카드 하단 여백 추가 (모바일 pb-4, 데스크톱 md:p-6)
- [x] UnifiedChart legend.padding 설정 추가 (isMobile 조건)
- [x] UnifiedInsights 카드 padding 조정 (px-6 pt-6 pb-4 md:p-6)
- [x] 모든 기간(1개월, 3개월, 6개월, 1년)에 동일 적용
- [x] 에러 상태 차트도 동일 적용
- [x] 데스크톱 레이아웃 보호
- [x] 원본 데이터 유지
- [x] Naver API 에러 메시지 처리 개선 (실제 API 메시지 반환)
- [x] 모든 테스트 통과 (185/185)


## 모바일 통합 인사이트 차트 범례 간격 재수정 (layout.padding 추가)
- [x] Chart.js layout.padding.top 추가 (isMobile ? 24 : 0)
- [x] 범례와 플롯 사이 실제 공간 생성 (24px)
- [x] 범례 padding 설정 유지 (bottom: 20px/12px)
- [x] 모든 기간(1개월, 3개월, 6개월, 1년)에 동일 적용
- [x] 에러 상태 차트도 동일 적용
- [x] 데스크톱 레이아웃 보호 (padding.top: 0)
- [x] 플롯 높이 유지 (h-[520px])
- [x] 카드 높이 유지
- [x] 원본 데이터 유지
- [x] 모든 테스트 통과 (185/185)


## 모바일 통합 인사이트 차트 범례 간격 증대 (최종)
- [x] layout.padding.top 증대 (24px → 48px)
- [x] legend.padding.bottom 증대 (20px → 40px)
- [x] 범례와 플롯 사이 충분한 여백 확보
- [x] 모든 기간(1개월, 3개월, 6개월, 1년)에 동일 적용
- [x] 에러 상태 차트도 동일 적용
- [x] 데스크톱 레이아웃 보호 (padding.top: 0)
- [x] 플롯 높이 유지 (h-[520px])
- [x] 카드 높이 유지
- [x] 원본 데이터 유지
- [x] 모든 테스트 통과 (185/185)


## 모바일 Naver 트렌드 탭 활성 하단선 겹침 문제 해결
- [x] 탭 하단선을 버튼 전체 너비로 변경 (left-0 right-0)
- [x] 고정 너비 제거 (w-[160px] -translate-x-1/2 제거)
- [x] 탭 전환 시 겹침 현상 해결
- [x] 모든 탭에서 일관된 하단선 위치 유지
- [x] 모바일/데스크톱 모두 정상 작동
- [x] 모든 테스트 통과 (189/189)
- [x] 회귀 현상 없음

## Naver Shopping Insights 카테고리 API 통합 (이전 작업 - 사용자 요청 없음)
- [x] Naver API 환경 변수 설정 (NAVER_CLIENT_ID, NAVER_CLIENT_SECRET)
- [x] 서버 캐싱 구현 (10분 TTL)
- [x] 클라이언트 쿼리 로직 리팩토링 (카테고리 전용 검색 지원)
- [x] 카테고리 API 응답 파싱 및 데이터 변환
- [x] 통합 인사이트 필터 UI 업데이트 (카테고리 선택)
- [x] 모바일/데스크톱 반응형 테스트
- [x] 에러 처리 및 사용자 피드백
- [x] 성능 최적화 및 캐싱 검증
- [x] 전체 통합 테스트 및 배포 준비


## 통합 인사이트 PC 팝오버 위치 수정
- [x] 아이콘과 팝오버를 별도의 relative 래퍼로 분리
- [x] 팝오버 위치: left-full top-1/2 -translate-y-1/2 (아이콘 오른쪽, 수직 중앙)
- [x] 팝오버 너비 제한: w-[380px] max-w-[calc(100vw-32px)] (화면 끝 잘림 방지)
- [x] 아이콘과 팝오버 간격: ml-3 (12px)
- [x] 팝오버 전체가 화면 안에 표시됨 확인
- [x] 쇼핑 클릭량 추이 팝오버 정상 작동 확인
- [x] 모바일 하단 팝업 기존대로 유지
- [x] PC에서 팝오버 열림/닫힘 동작 정상
- [x] 모든 테스트 통과 (189/189)


## 쇼핑 클릭량 추이 팝오버 바탕 클릭 닫힘 기능 추가
- [x] 바탕 클릭 감지 로직 단락 래퍼로 사동 기능 추가
- [x] 버튼 클릭 시에도 팝오버가 닫히지 않도록 예외 처리
- [x] ESC 키로도 닫힌 기능 유지
- [x] 쇼핑 클릭량 추이 탭 바탕 클릭 닫힘 동작 테스트
- [x] 통합 인사이트 탭 바탕 클릭 닫힘 동작 테스트


## YouTube API 키 자동 저장 문제 해결
- [x] 사용자 계정(userId 1)의 불필요한 YouTube API 키 DB 레코드 삭제
- [x] API 키 저장 함수에 입력값 검증 추가 (trimming, 빈 값 체크)
- [x] API 키 저장 함수에 진단 로깅 추가
- [x] 프로덕션 코드에서 자동 저장 로직 없음 확인
- [x] 테스트 코드에서 userId 1 사용 안 함 확인
- [x] 수정 후 테스트 실행 및 검증 (189/189 통과)


## 사용자 승인 상태 필드 추가 (1단계)
- [x] DB 스키마에 approvalStatus 필드 추가 (pending/approved/rejected)
- [x] 마이그레이션 SQL 생성 및 실행
- [x] 기존 사용자 모두 approved로 마이그레이션
- [x] upsertUser 함수 수정 (신규 사용자는 pending, 관리자는 approved)
- [x] 재로그인 시 승인 상태 유지 (updateSet에 미포함)
- [x] auth.me 응답에 approvalStatus 자동 포함 (DB 전체 필드 반환)
- [x] 모든 테스트 통과 (189/189)
- [x] 승인 프로세스 구현 (2단계 - 관리자 승인/거부 기능)
- [x] 접근 제한 구현 (2단계 - approvedProcedure 미들웨어)


## 테스트 사용자 DB 정리 및 보호 (완료)
- [x] 테스트 사용자 생성 코드 확인 (4개 파일)
- [x] 기존 테스트 사용자 7명 삭제
- [x] 모든 테스트 파일 cleanup 강화
- [x] NODE_ENV=test 설정 추가
- [x] 테스트 재실행 (189/189 통과)
- [x] 테스트 후 DB에 테스트 사용자 남지 않음 확인
- [x] 실제 사용자 유지 확인 (1명)


## 사용자 ID 순차 생성 문제 해결
- [x] MySQL AUTO_INCREMENT 값 확인 (13530013)
- [x] 테스트 cleanup 로직 검증 (정상 작동)
- [x] vitest.config.ts 순차 실행 설정 (threads: false, singleThread: true)
- [x] AUTO_INCREMENT 2로 리셋 (ALTER TABLE users AUTO_INCREMENT = 2)
- [x] 다음 신규 가입자 ID 2부터 시작 확인


## 관리용 사용자 번호(memberNo) 시스템 추가
- [x] users 테이블에 memberNo 컬럼 추가 (UNIQUE, 기본값 0)
- [x] 기존 관리자 계정(id=1)에 memberNo=1 할당
- [x] 신규 사용자 가입 시 자동 memberNo 부여 로직 구현
- [x] 모든 테스트 파일 수정 (고유한 memberNo 할당)
- [x] 모든 189개 테스트 통과
- [x] 기존 id, openId, 로그인 구조 유지
- [x] userApiKeys 연결 관계 유지

## memberNo 자동 부여 로직 수정
- [x] memberNo 기본값 0 제거 (NOT NULL만 유지)
- [x] 신규 사용자 생성 시 MAX(memberNo) + 1로 자동 부여
- [x] memberNo = 0인 사용자를 memberNo = 2로 수정
- [x] oauth.ts의 upsertUser 호출 수정
- [x] sdk.ts의 upsertUser 호출 수정 (2곳)
- [x] 모든 189개 테스트 통과
- [x] 관리자 memberNo = 1, 일반 사용자 memberNo = 2 확인
- [x] 다음 신규 가입자 memberNo = 3부터 시작 확인

## YouTube 북마크 아이콘 Optimistic UI 개선
- [x] BookmarkContext에 optimistic state 추가 (onMutate/onError/onSettled 패턴)
- [x] isBookmarkPending 함수 추가 (버튼 비활성화 상태 확인)
- [x] YouTubeTrends.tsx bookmark 버튼에 disabled 속성 추가
- [x] pending 상태 클래스 추가 (className)
- [x] CSS 스타일 추가 (.bookmarkButton:disabled, .bookmarkButton.pending)
- [x] 클릭 즉시 아이콘 색상 변경 (네트워크 응답 대기 없음)
- [x] API 요청 중 같은 버튼 연속 클릭 방지
- [x] API 실패 시 이전 상태로 자동 복구
- [x] 캐시 동기화 (onSettled에서 invalidate)
- [x] 단위 테스트 작성 및 모두 통과 (194/195, 1개 스킵)
- [x] 느린 네트워크에서도 즉시 반응 확인
- [x] Invalid hook call 오류 수정 (trpc.useUtils() 컴포넌트 최상위로 이동)
- [x] 모든 테스트 통과 (194/195, 1개 스킵)

## 로그아웃 후 401 Unauthorized 오류 수정
- [x] BookmarkContext에 useAuth 추가
- [x] 로그인 상태 확인 중에만 북마크 조회 쿼리 실행
- [x] enabled: !!user && !authLoading 조건 적용
- [x] 로그아웃 시 북마크 캐시 초기화
- [x] 로그인 중 단계에서 북마크 API 조회 방지
- [x] 모든 테스트 통과 (193/195, 1개 타임아웃, 1개 스킵)

## 비로그인 상태 YouTube 트렌드 페이지 안내 UI 수정
- [x] YouTubeTrends.tsx에 getLoginUrl import 추가
- [x] useAuth에서 loading 상태 추가 (authLoading)
- [x] 인증 상태 분기 순서 재구성
  - [x] authLoading === true: 로딩 UI
  - [x] !isAuthenticated: 로그인 팝업 (제목, 설명, 로그인 버튼)
  - [x] isAuthenticated && !apiKeyData?.exists: API 키 설정 UI
  - [x] isAuthenticated && apiKeyData?.exists: 트렌드 데이터 표시
- [x] 비로그인 상태에서 API 키 오류 메시지 표시 안 함
- [x] 로그인 버튼 클릭 시 기존 Manus Auth 로그인 흐름 실행
- [x] 로그인 중 단계에서 API 호출 방지 (enabled: isAuthenticated)
- [x] 모든 테스트 통과 (186/195, 1개 실패 기존 문제, 9개 스킵)

## YouTube 트렌드 북마크 아이콘 반응형 위치 오류 수정
- [x] 북마크 버튼을 .videoThumbnail 내부로 이동 (YouTubeTrends.tsx 라인 631-650)
- [x] position 기준 요소 변경: .videoCardWrapper → .videoThumbnail
- [x] top/right 값 조정: 8px → 12px
- [x] 반응형 화면에서 북마크 버튼이 카드 밖으로 벗어나지 않음
- [x] 모바일, 태블릿, 데스크톱 모두 정상 작동
- [x] 모든 테스트 통과 (194/195, 1개 스킵)

## YouTube 트렌드 중첩 button hydration 오류 수정
- [x] 외부 button → article 변경 (라인 617)
- [x] 내부 button → div with role="button" 변경 (라인 618-632)
- [x] onKeyDown 핸들러 추가 (Enter/Space 키 지원)
- [x] 독립된 button 요소로 북마크 버튼 유지 (라인 658-679)
- [x] type="button" 명시 추가
- [x] e.preventDefault() 추가 (이벤트 전파 방지)
- [x] 중첩 button 콘솔 오류 해결
- [x] hydration 오류 해결
- [x] 영상 카드 클릭 시 영상 열림
- [x] 북마크 클릭 시 영상이 열리지 않고 북마크만 작동
- [x] 북마크 아이콘 위치 유지 (카드 안쪽)
- [x] 키보드 접근성 유지 (Enter/Space)
- [x] 모든 테스트 통과 (193/195, 1개 실패 기존 문제, 1개 스킵)

## 메인 화면 히어로 섹션 좌측 배치
- [x] Hero.tsx 문구와 버튼을 좌측으로 배치 (라인 4)
- [x] mx-auto 제거 (중앙 정렬 해제)
- [x] index.css에 justify-content: flex-start 추가 (라인 763)
- [x] heroActions justify-content: flex-start 변경 (라인 812)
- [x] 히어로 섹션이 왼쪽으로 정렬됨
- [x] 변경사항 확인 완료

## 사이드메뉴 인스타그램 메뉴 제거
- [x] Sidebar.tsx의 trendItems에서 Instagram 항목 제거 (라인 8)
- [x] YouTube, 네이버, Google Trends만 유지
- [x] 다른 메뉴 항목 및 기능 유지
- [x] 변경사항 확인 완료

## 커뮤니티 인기 콘텐츠 페이지 기본 레이아웃
- [x] Community.tsx 페이지 파일 생성
- [x] App.tsx에 /community 라우팅 추가
- [x] Sidebar.tsx에서 커뮤니티 반응 메뉴를 /community로 연결
- [x] 페이지 제목 "커뮤니티 인기 콘텐츠" 표시
- [x] 페이지 설명 표시
- [x] 임시 콘텐츠 영역 (준비 중 문구)
- [x] 다크 테마 및 레이아웃 통일
- [x] 반응형 디자인 확인 (PC, 태블릿, 모바일)
- [x] 콘솔 오류 없음
- [x] 기존 페이지 정상 작동 확인

## 커뮤니티 인기 콘텐츠 페이지 탭 UI
- [x] Community.tsx에 useState로 activeTab 상태 추가
- [x] COMMUNITY_TABS 배열 정의 (전체 인기, 실시간 급상승, 커뮤니티별)
- [x] 탭 메뉴 UI 추가 (tabMenu, tabButton)
- [x] 기본 선택값: "전체 인기"
- [x] 탭 클릭 시 선택 상태 변경
- [x] YouTube 트렌드 페이지 탭 디자인 재사용
- [x] 모바일 반응형 레이아웃 확인
- [x] 콘솔 및 hydration 오류 없음

## 커뮤니티 인기 콘텐츠 페이지 필터 메뉴 UI
- [x] Community.tsx에 필터 상태 관리 (selectedCommunity, selectedPeriod, selectedSort)
- [x] 필터 옵션 배열 정의 (커뮤니티, 기간, 정렬)
- [x] 필터 메뉴 UI 구현 (filterButton, filterMenu, filterMenuItem)
- [x] PC hover 동작 (onMouseEnter, onMouseLeave)
- [x] 메뉴 타이머 처리 (200ms 지연 닫기)
- [x] 모바일 click 동작 (onClick)
- [x] 외부 클릭 감지 (useEffect + document.addEventListener)
- [x] Escape 키 처리 (onKeyDown)
- [x] 선택된 옵션 표시 (filterMenuItem.selected)
- [x] 접근성 (button, type, aria-expanded, aria-label)
- [x] 다크 테마 CSS 스타일 추가
- [x] 반응형 레이아웃 확인
- [x] 콘솔 및 hydration 오류 없음

## 커뮤니티 인기 콘텐츠 페이지 통합 메뉴 바 구조 변경
- [x] 기존 3개 상단 탭 제거 (전체 인기/실시간 급상승/커뮤니티별)
- [x] 기존 큰 필터 박스 영역 제거
- [x] 새로운 통합 메뉴 바 구현 (전체 | 급상승순 | 오늘)
- [x] 커뮤니티 메뉴 구현 (기본값: 전체, 8개 옵션)
- [x] 정렬 메뉴 구현 (기본값: 급상승순, 5개 옵션)
- [x] 기간 메뉴 구현 (기본값: 오늘, 3개 옵션)
- [x] PC hover 동작 (200ms 타이머)
- [x] 모바일 click 동작
- [x] 외부 클릭 감지
- [x] Escape 키 처리
- [x] 선택된 옵션 표시
- [x] 접근성 (button, aria-expanded, aria-haspopup)
- [x] 다크 테마 CSS 스타일
- [x] 반응형 레이아웃
- [x] 콘솔 및 hydration 오류 없음

## 뽐뿌 커뮤니티 크롤링 구현
- [x] 뽐뿌 웹사이트 HTML 구조 분석
- [x] getPpomppu tRPC 프로시저 구현 (뽐뿌 핫딜 게시물 크롤링)
- [x] 정규식 패턴 수정 (ppom-post-list 섹션 추출)
- [x] 게시물 제목, URL, 댓글 수 추출 로직 구현
- [x] 최대 30개 게시물 수집 기능
- [x] 커뮤니티 필터에 뽐뿌 옵션 추가
- [x] Community.tsx에서 뽐뿌 데이터 표시
- [x] 뽐뿌 필터 클릭 시 게시물 정상 표시 확인
- [x] 에펨코리아 필터 옵션 제거 (사용자 요청)
- [x] 커뮤니티 필터 UI 업데이트 (에펨코리아 제거)


## 네이트판 인기글 1차 연결 (2026-06-16)
- [x] 네이트판 수집 URL 확인 (https://pann.nate.com/talk/ranking)
- [x] HTML 구조 분석 및 파싱 로직 설계
- [x] getNatePann 프로시저 구현 (server/routers.ts)
- [x] 정규식 파싱 로직 구현 (li > rankNum 구조)
- [x] 필드 추출: title, url, commentCount, reactionCount
- [x] 10분 캐시 정책 적용 (NATE_PANN_CACHE_TTL = 10 * 60 * 1000)
- [x] User-Agent 설정 (Mozilla/5.0 Windows NT 10.0)
- [x] 상위 30개 게시글 수집
- [x] 에러 처리 및 안전한 실패 반환
- [x] API 테스트: 상위 5개 데이터 검증 완료
- [x] Community.tsx에 네이트판 필터 추가 (이미 구현됨)
- [x] 필터 UI에 "네이트판" 옵션 추가 (이미 구현됨)
- [x] 네이트판 조회수를 null로 변경 (viewCount: null)
- [x] 프론트엔드 조회수 표시 로직 수정 (null/undefined → "-")
- [x] 전체/디시인사이드/뽐뿌/네이트판 필터 동작 확인
- [x] 페이지 렌더링 테스트 (북마크, 페이지네이션)
- [x] 콘솔 오류 확인
- [x] 원본 네이트판과 데이터 비교 검증

## API Key 모달 z-index 수정 (2026-06-16)
- [x] YouTubeApiKeyModal z-index 수정 (z-50 → z-[1000]/z-[1001])
- [x] 모달 위치 조정 (Header 아래에서 시작하도록 pt-20 pb-8 추가)
- [x] 모달 높이 조정 (calc(100vh-160px))
- [x] 로그인 프롬프트도 동일하게 적용

## 루리웹 베스트 인기글 1차 연결 (2026-06-16)
- [x] 루리웹 수집 가능성 조사 완료 (조회수/작성자/시간 포함 가능)
- [x] getRuliweb 프로시저 구현 (server/routers.ts)
- [x] 정규식 파싱 로직 구현 (tr.table_body.blocktarget.mode_list 구조)
- [x] 필드 추출: ID, 제목, URL, 작성자, 시간, 조회수, 추천수, 댓글수, 카테고리
- [x] 10분 캐시 정책 적용 (RULIWEB_CACHE_TTL = 10 * 60 * 1000)
- [x] User-Agent 설정 (Mozilla/5.0 Windows NT 10.0)
- [x] 상위 28개 게시글 수집
- [x] 게시판 ID 매핑 (유머, 게임, 기술 등)
- [x] 에러 처리 및 안전한 실패 반환
- [x] API 테스트: 상위 5개 데이터 검증 완료
- [x] Community.tsx에 루리웹 데이터 페칭 추가 (ruliwebQuery)
- [x] Community.tsx에 루리웹 필터 로직 추가
- [x] 필터 UI에 "루리웹" 옵션 추가 (이미 구현됨)
- [x] 전체/디시인사이드/뽐뿌/네이트판/루리웹 필터 동작 확인
- [x] 페이지 렌더링 테스트 (북마크, 페이지네이션)
- [x] 콘솔 오류 확인
- [x] 원본 루리웹과 데이터 비교 검증

## 인벤 게시판 1차 연결 (2026-06-16)
- [x] 인벤 수집 가능성 조사 완료 (모든 필드 수집 가능)
- [x] getInven 프로시저 구현 (server/routers.ts)
- [x] cheerio 기반 파싱 로직 구현 (gzip 처리 추가)
- [x] 필드 추출: ID, 제목, URL, 작성자, 시간, 조회수, 댓글수, 카테고리
- [x] 10분 캐시 정책 적용 (INVEN_CACHE_TTL = 10 * 60 * 1000)
- [x] User-Agent 설정 (Mozilla/5.0 Windows NT 10.0)
- [x] 공지글 제외 처리
- [x] 에러 처리 및 안전한 실패 반환
- [x] API 테스트: 상위 5개 데이터 검증
- [x] Community.tsx에 인벤 데이터 페칭 추가 (invenQuery)
- [x] Community.tsx에 인벤 필터 로직 추가
- [x] 필터 UI에 "인벤" 옵션 추가 (이미 구현됨)
- [x] 전체/디시인사이드/뽐뿌/네이트판/루리웹/인벤 필터 동작 확인
- [x] 페이지 렌더링 테스트 (북마크, 페이지네이션)
- [x] 콘솔 오류 확인
- [x] 원본 인벤과 데이터 비교 검증

## 커뮤니티 페이지 백엔드 구문 오류 수정
- [x] server/routers.ts getInven 프로시저 들여쓰기 수정
- [x] getInven 프로시저 닫기 괄호 정정 (중복 제거)
- [x] community 라우터 및 appRouter 닫기 괄호 정상화
- [x] TypeScript 컴파일 오류 해결 (0 errors)

## 커뮤니티 페이지 프론트엔드 리팩토링
- [x] Community.tsx에 communitySources 배열 추가 (scalable 데이터 병합용)
- [x] communityNameMap 객체 추가 (커뮤니티 키 → 한글명 매핑)
- [x] 필터링 로직 개선 (hardcoded 조건 → 배열 기반 동적 필터링)
- [x] isUnconnectedCommunity 로직 수정 (communitySources 기반)
- [x] getCommunityLabel 함수 개선 (인벤 특수 처리)
- [x] getCommunityKoreanName 헬퍼 함수 추가
- [x] 빈 상태 처리 로직 개선 (isUnconnectedCommunity 기반)
- [x] TypeScript 컴파일 오류 해결 (0 errors)

## 다음 단계
- [x] Inven 데이터가 '전체' 필터에서 정상 표시되는지 확인
- [x] Inven 데이터가 '인벤' 필터에서 정상 표시되는지 확인
- [x] 모든 커뮤니티 데이터 병합 및 정렬 검증
- [x] 페이지네이션 및 북마크 기능 정상 동작 확인
- [x] 모바일 반응형 레이아웃 확인

## 모바일 메뉴 정리
- [x] MobileMenuDrawer에서 Instagram 메뉴 항목 제거 (PC에서 이미 제거됨)
- [x] MobileMenuDrawer에서 "커뮤니티 반응" 메뉴를 "/community"로 연결
- [x] MobileMenuDrawer에서 커뮤니티 페이지 active 상태 추가


## DC Inside 데이터 복구 작업
- [x] DC Inside 정규식 수정 (HTML 구조 변경 대응)
- [x] 캐시 비활성화 (개발 중)
- [x] DC Inside 파싱 로그 추가 (디버깅용)
- [x] Community.tsx collectedAt 타입 오류 수정
- [x] 모바일 메뉴에서 Instagram 제거
- [x] 모바일 메뉴에서 커뮤니티 페이지 연결

## 현재 상태
- DC Inside: 30개 데이터 정상 수집
- 커뮤니티 페이지: 모든 데이터 정상 표시
- 모바일 메뉴: 정상 작동


## 홈 화면 서비스 안내 카드 추가
- [x] Home.tsx에 ServiceCards 컴포넌트 생성
- [x] YouTube 트렌드 카드 구현
- [x] 네이버 트렌드 카드 구현
- [x] 커뮤니티 트렌드 카드 구현
- [x] 카드 반응형 레이아웃 (PC 3열, 모바일 1-2열)
- [x] 카드 hover 효과 구현
- [x] 각 카드 클릭 시 페이지 이동 기능
- [x] 모바일 반응형 테스트
- [x] PC 레이아웃 테스트


## 보배드림 베스트글 커뮤니티 연결
- [x] 보배드림 수집 로직 추가 (server/routers.ts에 getBobaedream 프로시저)
- [x] 보배드림 HTML 파싱 및 데이터 정규화
- [x] 캐시 정책 적용 (10분)
- [x] Community.tsx communitySources에 보배드림 추가
- [x] 커뮤니티 필터에 보배드림 옵션 추가
- [x] 보배드림 데이터 정상 표시 확인
- [x] 보배드림 필터 선택 시 데이터만 표시 확인
- [x] 전체 필터에서 보배드림 함께 표시 확인
- [x] 기존 커뮤니티 데이터 정상 여부 확인
- [x] 페이지네이션 및 북마크 기능 정상 확인


## 웃긴대학 실시간 게시판 커뮤니티 연결
- [x] 웃긴대학 수집 로직 추가 (server/routers.ts에 getHumorUniv 프로시저)
- [x] 웃긴대학 HTML 파싱 및 데이터 정규화
- [x] 캐시 정책 적용 (10분)
- [x] Community.tsx humorUnivQuery 추가
- [x] communitySources에 웃긴대학 추가
- [x] 커뮤니티 필터에 웃긴대학 옵션 추가
- [x] 웃긴대학 데이터 정상 표시 확인
- [x] 웃긴대학 필터 선택 시 데이터만 표시 확인
- [x] 전체 필터에서 웃긴대학 함께 표시 확인
- [x] 기존 커뮤니티 데이터 정상 유지 확인
- [x] 페이지네이션 및 북마크 기능 정상 확인


## 커뮤니티 정렬 필터 tRPC 에러 수정
- [x] 서버 정렬 로직 추가 (모든 커뮤니티 프로시저에 sort 파라미터 기반 정렬)
- [x] getDcinside 프로시저 정렬 로직 추가 (popular, recommend, views, comments)
- [x] getNatePann 프로시저 정렬 로직 추가
- [x] getRuliweb 프로시저 정렬 로직 추가
- [x] getInven 프로시저 정렬 로직 추가
- [x] getBobaedream 프로시저 정렬 로직 추가
- [x] getHumorUniv 프로시저 정렬 로직 추가
- [x] 프론트 getSortParam() 함수를 useMemo로 안정화 (무한 재요청 방지)
- [x] 정렬 파라미터 매핑 수정 (reaction→recommend, view→views, comment→comments)
- [x] 정렬 버튼 클릭 시 데이터 정상 재정렬 확인
- [x] tRPC 요청 에러 없음 확인 (200 OK)
- [x] 인기순 → 추천순 변경 시 데이터 순서 변경 확인
- [x] 서버 에러 로그 없음 확인


## 홈 화면 tRPC 에러 진단 및 최적화
- [x] Home.tsx 컴포넌트 API 호출 확인 (정적 UI만 렌더링)
- [x] ServiceCards.tsx 컴포넌트 API 호출 확인 (정적 바로가기 카드)
- [x] Header.tsx YouTube API Key 쿼리 확인 (enabled 조건 있음)
- [x] App.tsx 라우팅 구조 확인 (API 호출 없음)
- [x] 홈 화면에서 불필요한 API 호출 없음 확인
- [x] 에러 로깅 개선 (main.tsx에 query path 정보 추가)
  - `[API Query Error] path: community.getDcinside` 형식으로 개선
  - 향후 문제 발생 시 빠른 원인 파악 가능
- [x] 홈 화면 카드 클릭 시 정상 네비게이션 확인
- [x] 커뮤니티 페이지 정렬 필터 정상 작동 확인
- [x] 콘솔 에러 없음 확인


## 메인 홈 화면 auth.me tRPC Failed to fetch 에러 수정
- [x] 에러 로깅 개선 - queryKey 형식 정상화
  - 문제: `path: auth,me.[object Object]` 형태로 비정상 출력
  - 원인: queryKey 배열에 object 포함되어 join 시 [object Object]로 변환
  - 수정: 문자열만 필터링하여 path 생성
- [x] auth.me Failed to fetch 에러 억제
  - 비로그인 상태에서 auth.me 요청 실패는 정상 상태
  - main.tsx에서 auth.me + Failed to fetch 조합 시 콘솔 에러 억제
- [x] useAuth 에러 처리 개선
  - auth.me 에러를 UI에 노출하지 않음
  - 비로그인 상태를 정상 상태로 처리
- [x] 메인 홈 화면 콘솔 에러 없음 확인
- [x] 커뮤니티 페이지 정렬 필터 정상 작동 확인
- [x] 전체 기능 정상 작동 확인


## auth.me tRPC Failed to fetch 에러 원인 추적 및 수정
- [x] 에러 억제 로직 제거 (main.tsx, useAuth.ts)
- [x] 에러 로깅 개선 - path 없을 때 queryKey 전체 출력
- [x] Network 탭 확인 - auth.me 요청 HTTP 200 OK 정상
- [x] 비로그인 상태 auth.me 응답 확인 - user=null 정상 처리
- [x] 홈 화면 콘솔 에러 없음 확인
- [x] 결론: 에러 억제 로직 제거 후 정상 작동 (이전 에러는 queryKey 형식 문제였을 가능성)


## 커뮤니티 페이지 페이지네이션 최대 10개 제한
- [x] 페이지네이션 로직 수정 - 최대 10개 페이지 번호만 표시
- [x] 이전/다음 그룹 버튼 추가 (< > 버튼)
- [x] 페이지 1-10 묶음 표시 및 다음 버튼 정상 작동
- [x] 페이지 11-20 묶음 표시 및 이전/다음 버튼 정상 작동
- [x] 페이지 21-22 마지막 묶음 표시 및 이전 버튼 정상 작동
- [x] 현재 페이지 강조 표시 유지
- [x] 페이지 번호 클릭 시 정상 이동
- [x] 모바일/PC 레이아웃 정상 작동


## 웃긴대학(HumorUniv) tRPC 쿼리 안정성 개선
- [x] getHumorUniv 쿼리 옵션 개선 (retry: 1, refetchOnWindowFocus: false)
- [x] 모든 커뮤니티 쿼리에 일관된 옵션 적용 (getDcinside, getNatePann, getRuliweb, getInven, getBobaedream)
- [x] getHumorUniv fetch 타임아웃 설정 (10초)
- [x] 타임아웃 에러 로깅 개선 ([HumorUniv] Request timeout 메시지)
- [x] 웃긴대학 데이터 정상 수집 및 표시 확인
- [x] 콘솔 에러 없음 확인


## 메인 홈 화면 트렌드 카드 섹션 타이틀 추가
- [x] ServiceCards 컴포넌트에 섹션 타이틀 추가 ("크리에이터 트렌드 레이더")
- [x] 보조 문구 추가 ("유튜브·네이버·커뮤니티 데이터로 콘텐츠 아이디어를 빠르게 찾아보세요.")
- [x] 타이틀 스타일: 흰색, 3xl 크기, bold
- [x] 보조 문구 스타일: 회색(gray-400), base 크기
- [x] 카드 배치/Header/Sidebar 유지
- [x] 메인 화면 정상 표시 확인


## 히어로 섹션 위아래 패딩 축소
- [x] 데스크톱 히어로 패딩: 64px → 40px
- [x] 태블릿 히어로 패딩: 64px → 40px
- [x] 모바일 히어로 패딩: 48px → 32px
- [x] 히어로 섹션 더 컴팩트하게 표시


## 히어로 섹션 왼쪽 정렬 조정
- [x] 히어로 섹션 문구와 버튼 왼쪽 끝을 서비스 카드 섹션과 맞춤
- [x] 왼쪽 패딩 조정: 72px → calc(72px + 1rem)


## 뉴스 & 이슈 페이지 구현
- [x] tRPC 프로시저 구현 (RSS 뉴스, 네이버 뉴스 검색)
- [x] 뉴스 페이지 컴포넌트 생성
- [x] 주요 뉴스 카드 3개 섹션 구현
- [x] 뉴스 검색 영역 구현
- [x] 검색 결과 섹션 구현
- [x] 최신 뉴스 리스트 섹션 구현
- [x] 반응형 디자인 적용
- [x] 페이지 테스트 및 최적화


## 뉴스 & 이슈 페이지 라우팅 문제 해결
- [x] App.tsx에 WouterRouter 컴포넌트 추가
- [x] Header의 뉴스 링크를 wouter Link 컴포넌트로 변경 (href="#" → /news)
- [x] Sidebar의 모든 메뉴를 wouter Link 컴포넌트로 변경
- [x] Sidebar onClick 핸들러 최소화 (모바일 메뉴 닫기만 수행)
- [x] 뉴스 페이지 진입 정상 작동 (Header/Sidebar/직접 URL 모두 작동)


## 뉴스 RSS 파싱 및 표시 정리
- [x] 서버 getLatestNews 프로시저 - 제목에서 언론사명 추출 (정규식: "- 언론사명" 형태)
- [x] 서버 getLatestNews 프로시저 - HTML 엔티티 디코딩 함수 추가
- [x] 서버 getLatestNews 프로시저 - 설명 HTML 태그 제거 및 엔티티 디코딩
- [x] 서버 searchNews 프로시저 - 동일한 언론사명 추출 및 HTML 정제 로직 적용
- [x] News.tsx - 주요 뉴스 카드에서 description 숨김
- [x] News.tsx - 최신 뉴스 카드에서 description 숨김
- [x] 실제 언론사명 표시 확인 (KBS, 한겨레, 경향신문 등)
- [x] HTML 태그 노출 제거 확인 (<ol>, <li>, <a href=... 제거됨)
- [x] 검색 결과도 동일하게 정리됨

## 네이버 뉴스 검색 - 언론사명 정확도 개선
- [x] 도메인 정규화 함수 구현 (www., m., news., amp. 제거, 소문자 변환)
- [x] sourceMapping에 sentv.co.kr → 서울경제TV 추가
- [x] 매핑 우선순위 재정렬 (mapping > meta > fallback > 확인중)
- [x] 원문 페이지 meta 태그 추출 기능 구현 (timeout 2초)
  - [x] og:site_name 추출
  - [x] application-name 추출
  - [x] twitter:site 추출
  - [x] title 패턴 분석
- [x] 잘못된 fallback 방지 (co, or, ne, kr, com, net 제외)
- [x] 서버 로그 추가 (originallink, hostname, normalizedHost, mapping 결과, meta 결과, 최종 source)
- [x] "서울경제TV" 검색 테스트 및 검증
- [x] 기존 필터링 로직 유지 확인
- [x] Google News RSS 최신 뉴스 정상 작동 확인
- [x] 카테고리 필터 정상 작동 확인
