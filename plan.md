# KYRO Mate

## One-liner

KYRO Mate는 친구 러닝 데이터를 Tinder처럼 넘기며, 같이 뛰기 좋은 러닝 친구와 선의의 라이벌을 찾아주는 건전한 러닝 버디 매칭 앱이다.

## Repository

- GitHub: https://github.com/LilMGenius/kyro-mate
- Visibility: Public
- App name: KYRO Mate

## Why This Wins

KYRO의 핵심은 러닝을 혼자 하는 기록 앱이 아니라 영토, 크루, 경쟁이 있는 스포츠로 바꾸는 것이다. Pace Buddy는 그다음 행동을 만든다: “누구랑 뛰지?”를 데이터로 바로 추천한다.

발표 훅:

> KYRO가 러닝을 영토 게임으로 만들었다면, Pace Buddy는 같이 뛸 파티원을 매칭합니다.

## Core Experience

1. 사용자가 내 최근 러닝 하나를 선택한다.
2. 친구 러닝 카드가 Tinder 스타일로 한 장씩 나온다.
3. 카드를 넘기며 `Run Together`, `Rival Buddy`, `Not My Pace`를 선택한다.
4. 선택한 친구와 내 러닝 패턴을 비교해 Buddy Match 결과 카드를 보여준다.
5. 결과 카드는 발표/공유용 한 장 이미지처럼 보이게 만든다.

## MVP Scope

15분 안에 완성할 MVP는 저장 기능 없이 read-only 데이터만 사용한다.

필수 화면:

- Hero: “Find Your Pace Buddy”
- 내 러닝 선택 영역
- 친구 러닝 스와이프 카드
- Buddy Match 결과 카드

필수 기능:

- 내 러닝 목록 불러오기
- 친구 러닝 목록 불러오기
- 카드 넘기기
- 선택한 친구와 궁합 점수 계산
- 결과 문구 생성

하지 않을 것:

- 실제 친구 요청 저장
- 채팅/DM
- 사용자 데이터 수정
- 익명 trace 기반 매칭
- 토큰을 프론트엔드 코드에 하드코딩

## API Usage

Base URL:

```text
https://kyro-hackathon.vercel.app
```

Endpoints:

- `GET /api/v1/runs?limit=20`: 내 러닝 목록
- `GET /api/v1/runs/:id`: 선택한 내 러닝 상세, GPS trace와 splits 확인
- `GET /api/v1/friends/runs?limit=50`: 친구 러닝 카드 후보
- `GET /api/v1/aggregates`: 전체 평균과 비교하는 보조 지표

Auth:

```text
Authorization: Bearer <KYRO_PAT>
```

토큰은 `.env` 또는 서버 프록시에만 둔다. `plan.md`와 클라이언트 코드에는 실제 토큰을 쓰지 않는다.

## Buddy Match Score

총점 100점.

```text
Buddy Match = Pace Fit + Distance Fit + Time Fit + Location Fit + Vibe Bonus
```

Scoring:

- Pace Fit, 35점: 평균 페이스 차이가 작을수록 높음
- Distance Fit, 25점: 자주 뛰는 거리대가 비슷할수록 높음
- Time Fit, 15점: 러닝 시간대가 비슷할수록 높음
- Location Fit, 15점: 도시/지역 메타가 비슷할수록 높음
- Vibe Bonus, 10점: 제목/메모/최근성/고도 성향 등 재미 요소

Fallback:

- 데이터 필드가 없으면 해당 항목은 중립 점수로 처리한다.
- 상세 split을 못 가져오면 목록 데이터만으로 점수를 계산한다.

## Match Types

점수와 패턴에 따라 결과 타입을 붙인다.

- `Perfect Pace Buddy`: 페이스와 거리 모두 잘 맞는 친구
- `Rival Buddy`: 비슷하지만 상대가 살짝 빠른 선의의 라이벌
- `Long Run Material`: 거리 성향이 비슷하고 오래 뛰기 좋은 친구
- `Recovery Buddy`: 느긋하게 같이 뛰기 좋은 친구
- `Chaos Buddy`: 페이스는 안 맞지만 같이 뛰면 재밌을 친구

## Result Copy Examples

```text
Buddy Match 92%
둘은 대화보다 페이스가 먼저 맞습니다.
추천 러닝: 토요일 저녁 5K
주의: 상대는 후반에 치고 나가고, 나는 4km부터 멘탈이 흔들립니다.
```

```text
Rival Buddy 87%
같이 뛰면 친구인데, 마지막 1km부터는 적입니다.
추천 러닝: 한강 6K 템포런
주의: 상대는 오르막에서 강합니다.
```

```text
Recovery Buddy 78%
오늘은 기록 말고 수다 페이스입니다.
추천 러닝: 공원 3K 조깅
주의: 둘 다 초반에 너무 신나면 후반에 망합니다.
```

## UI Direction

Look and feel:

- 네온 스포츠 카드
- 검정 배경 + KYRO 느낌의 라임/민트 포인트
- Tinder식 카드 스택
- 큰 점수, 짧은 도발 문구, 공유 카드 같은 결과 화면

Card fields:

- 친구 이름 또는 표시 가능한 식별자
- 최근 러닝 거리
- 평균 페이스
- 지역/도시
- 러닝 시간대
- 한 줄 성향 태그

Swipe actions:

- Right: `Run Together`
- Up: `Rival Buddy`
- Left: `Not My Pace`

## 15-minute Build Plan

0-3분:

- Vite React 프로젝트 생성
- `.env`에 KYRO 토큰 설정
- API fetch helper 작성

3-6분:

- 내 러닝 목록과 친구 러닝 목록 fetch
- 로딩/에러 상태 최소 처리

6-10분:

- 카드 스택 UI 구현
- 버튼 3개로 swipe 액션 대체 가능

10-13분:

- Buddy Match scoring 함수 작성
- 결과 타입과 문구 생성

13-15분:

- 데모용 polish
- 발표용 첫 카드/결과 카드가 잘 보이게 정리

## Demo Script

1. “KYRO에는 영토와 경쟁이 있습니다. 그런데 같이 뛸 사람은 어떻게 찾을까요?”
2. 내 최근 러닝을 선택한다.
3. 친구 러닝 카드를 넘긴다.
4. `Run Together` 또는 `Rival Buddy`를 누른다.
5. Buddy Match 결과를 보여준다.
6. “이제 KYRO는 기록 앱이 아니라, 같이 뛸 파티원을 찾아주는 러닝 소셜 게임입니다.”

## Acceptance Criteria

- `plan.md`가 루트에 존재한다.
- 실제 KYRO API 토큰이 문서에 포함되지 않는다.
- 앱 컨셉이 데이팅이 아니라 건전한 러닝 버디 매칭으로 설명된다.
- MVP가 read-only API 제한 안에서 가능하다.
- 15분 안에 구현 가능한 범위로 제한된다.
