# KYRO Mate

KYRO Mate는 내 러닝과 친구 러닝 데이터를 비교해 같이 뛰기 좋은 러닝 메이트를 추천합니다.
친구 러닝 카드를 넘기며 `Run Together`, `Rival Buddy`, `Not My Pace` 액션을 선택할 수 있습니다.
선택한 친구와의 페이스, 거리, 시간대, 위치를 바탕으로 Buddy Match 점수와 결과 카드를 생성합니다.

## Tech Stack

- Vite + React
- CSS Modules 없이 순수 CSS 기반 네온 스포츠 UI
- Vercel Serverless Function API proxy
- KYRO read-only API: `/api/v1/runs`, `/api/v1/runs/:id`, `/api/v1/friends/runs`

## Environment Variables

Vercel과 로컬 환경에는 아래 값을 설정합니다. API key는 클라이언트 번들에 노출되지 않도록 `VITE_` prefix를 쓰지 않습니다.

```bash
KYRO_API_KEY=replace_with_your_kyro_api_key
KYRO_API_BASE_URL=https://kyro-hackathon.vercel.app
```

기존 로컬 `.env`에 `KYRO_API_TOKEN`이 있으면 fallback으로도 동작하지만, 새 배포 환경에서는 `KYRO_API_KEY`를 사용하세요.

## Development

```bash
npm install
npm run dev
```

로컬 개발 서버는 `/api/kyro/*` 요청을 실제 KYRO API의 `/api/v1/*`로 프록시하고, 서버 측에서 `Authorization: Bearer <KYRO_API_KEY>`를 붙입니다.

현재 검증된 실제 API base URL은 `https://kyro-hackathon.vercel.app`입니다. 기존 `https://kyro-hackathon-mcp.vercel.app`는 Vercel `DEPLOYMENT_NOT_FOUND`를 반환합니다.

## Build

```bash
npm run build
```

Vercel 배포에서는 `api/kyro/[...path].js`가 같은 역할을 수행합니다.

## API Notes

`/api/v1/runs/:id` 상세 응답의 `track_geojson`, `splits`, `elevation_gain_m`, `net_territory_gain_m2`를 결과 카드 보조 지표에 사용합니다. `/api/v1/aggregates`는 현재 실제 서버에서 statement timeout을 반환하므로 필수 플로우에 묶지 않았습니다.
