import { useEffect, useMemo, useState } from 'react';
import { calculateBuddyMatch, formatPace } from './scoring.js';

const emptyRuns = { myRuns: [], friendRuns: [] };

const ACTIONS = {
  runTogether: 'Run Together',
  rival: 'Rival Buddy',
  pass: 'Not My Pace',
};

const matchTypeLabels = {
  'Perfect Pace Buddy': '완벽한 페이스 메이트',
  'Rival Buddy': '라이벌 메이트',
  'Long Run Material': '롱런 메이트',
  'Recovery Buddy': '회복런 메이트',
  'Chaos Buddy': '반전 케미 메이트',
};

const scorePartLabels = {
  pace: '페이스',
  distance: '거리',
  time: '시간대',
  location: '장소',
  vibe: '무드',
};

const timeSlotLabels = {
  morning: '아침 러닝',
  afternoon: '낮 러닝',
  evening: '저녁 러닝',
  night: '밤 러닝',
};

const demoNames = [
  '하린', '서윤', '민서', '지우', '나은', '유나', '채원', '다인',
  '소윤', '예린', '수아', '라희', '지민', '연우', '하율', '도아',
  '세아', '아린', '로아', '은서', '하영', '유주', '서하', '리아',
];

const demoVibes = [
  ['복숭아 페이스런', '웃으면서 5K를 채우는 산뜻한 러너예요.', 'morning', 5.2, 345],
  ['한강 수다런', '기록보다 대화와 풍경을 더 좋아해요.', 'evening', 6.1, 372],
  ['민트 템포런', '마지막 1km는 살짝 승부욕이 올라와요.', 'night', 4.8, 318],
  ['크림 조깅', '가볍게 몸 풀고 카페로 마무리하는 코스가 좋아요.', 'afternoon', 3.4, 405],
  ['리본 롱런', '페이스를 일정하게 잡아주는 든든한 타입이에요.', 'morning', 9.7, 356],
  ['핑크 업힐런', '언덕도 귀엽게 이겨내는 파워 러너예요.', 'evening', 7.3, 332],
];

function buildDemoCandidates(baseRun) {
  const city = baseRun?.city ?? '서울';
  const areas = [baseRun?.area, '한강공원', '석촌호수', '서울숲', '올림픽공원', '양재천'].filter(Boolean);

  return demoNames.map((name, index) => {
    const [title, note, timeSlot, distanceKm, paceSecPerKm] = demoVibes[index % demoVibes.length];
    return {
      id: `demo-friend-${index + 1}`,
      name,
      title,
      distanceKm: distanceKm + (index % 4) * 0.3,
      paceSecPerKm: paceSecPerKm + (index % 5) * 6,
      city,
      area: areas[index % areas.length],
      timeSlot,
      tag: '데모 후보',
      note,
      elevationGainM: 12 + (index % 6) * 4,
      territoryGainM2: 900 + index * 75,
      splitsCount: 3 + (index % 5),
      trackPointCount: 18 + index,
      synthetic: true,
    };
  });
}

function parseNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function parseDistanceKm(run) {
  const km = parseNumber(run.distanceKm ?? run.distance_km ?? run.distanceKmTotal ?? run.distance_kilometers);
  if (km) return km;
  const rawDistance = parseNumber(run.distance ?? run.total_distance ?? run.distance_m ?? run.distance_meters);
  if (!rawDistance) return undefined;
  return rawDistance > 100 ? rawDistance / 1000 : rawDistance;
}

function parsePaceSeconds(value) {
  if (typeof value === 'string' && value.includes(':')) {
    const [minutes, seconds = '0'] = value.split(':').map(Number);
    if (Number.isFinite(minutes) && Number.isFinite(seconds)) return minutes * 60 + seconds;
  }
  const number = parseNumber(value);
  if (!number) return undefined;
  return number < 30 ? number * 60 : number;
}

function parseTimeSlot(run) {
  const explicit = run.timeSlot ?? run.time_slot ?? run.period;
  if (explicit) return String(explicit).toLowerCase();
  const startedAt = run.startedAt ?? run.started_at ?? run.start_time ?? run.createdAt;
  const hour = startedAt ? new Date(startedAt).getHours() : NaN;
  if (!Number.isFinite(hour)) return undefined;
  if (hour < 11) return 'morning';
  if (hour < 16) return 'afternoon';
  if (hour < 21) return 'evening';
  return 'night';
}

function getTrackPointCount(trackGeojson) {
  if (!trackGeojson?.coordinates) return 0;
  if (trackGeojson.type === 'LineString') return trackGeojson.coordinates.length;
  if (trackGeojson.type === 'MultiLineString') {
    return trackGeojson.coordinates.reduce((sum, line) => sum + line.length, 0);
  }
  return 0;
}

function normalizeRun(run, index, kind) {
  const location = run.location ?? run.place ?? {};
  const user = run.user ?? run.friend ?? run.owner ?? {};
  const distanceKm = parseDistanceKm(run);
  const city = run.city ?? location.city ?? run.region ?? run.place_region_label ?? 'KYRO';
  const area = run.area ?? location.area ?? location.name ?? run.route_name ?? run.place_display_label ?? run.place_region_label ?? run.city ?? 'Route';
  const fallbackName = kind === 'friend' ? `${area === 'Route' ? city : area} 러너 ${index + 1}` : `내 러닝 ${index + 1}`;
  const paceSecPerKm = parsePaceSeconds(
    run.paceSecPerKm ?? run.average_pace_sec_per_km ?? run.avg_pace_s_km ?? run.avg_pace ?? run.pace,
  ) ?? (distanceKm && run.duration_s ? Number(run.duration_s) / distanceKm : undefined);

  return {
    id: String(run.id ?? run.run_id ?? `${kind}-${index}`),
    name: run.name ?? user.name ?? run.friendName ?? run.friend_name ?? fallbackName,
    title: run.title ?? run.name ?? run.activityName ?? run.activity_name ?? `KYRO 러닝 ${index + 1}`,
    distanceKm,
    paceSecPerKm,
    city,
    area,
    timeSlot: parseTimeSlot(run),
    tag: run.tag ?? run.vibe ?? run.type ?? '읽기 전용 API 러닝',
    note: run.note ?? run.description ?? run.memo ?? 'KYRO API에서 불러온 실제 러닝 데이터',
    calories: parseNumber(run.calories),
    elevationGainM: parseNumber(run.elevation_gain_m ?? run.elevationGainM),
    elevationLossM: parseNumber(run.elevation_loss_m ?? run.elevationLossM),
    territoryGainM2: parseNumber(run.net_territory_gain_m2 ?? run.area_m2),
    splitsCount: Array.isArray(run.splits) ? run.splits.length : 0,
    trackPointCount: getTrackPointCount(run.track_geojson),
  };
}

function extractList(payload) {
  if (Array.isArray(payload)) return payload;
  return payload.runs ?? payload.data ?? payload.items ?? payload.results ?? [];
}

async function fetchKyroData() {
  const [myResponse, friendResponse] = await Promise.all([
    fetch('/api/runs?limit=20'),
    fetch('/api/friends-runs?limit=50'),
  ]);

  if (!myResponse.ok || !friendResponse.ok) throw new Error('KYRO API 응답 실패');

  const [myJson, friendJson] = await Promise.all([myResponse.json(), friendResponse.json()]);
  const myList = extractList(myJson);
  let friendList = extractList(friendJson);

  if (!myList.length) throw new Error('KYRO API 러닝 데이터 없음');
  if (!friendList.length) {
    friendList = myList.slice(1).length ? myList.slice(1) : myList;
  }

  return {
    myRuns: myList.map((run, index) => normalizeRun(run, index, 'mine')),
    friendRuns: friendList.map((run, index) => normalizeRun(run, index, 'friend')),
  };
}

async function fetchRunDetail(run) {
  const response = await fetch(`/api/run-detail?id=${encodeURIComponent(run.id)}`);
  if (!response.ok) throw new Error('러닝 상세 API 응답 실패');
  const detail = await response.json();
  return normalizeRun({ ...run, ...detail }, 0, 'detail');
}

export default function App() {
  const [runs, setRuns] = useState(emptyRuns);
  const [details, setDetails] = useState({});
  const [status, setStatus] = useState('loading');
  const [detailStatus, setDetailStatus] = useState('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedRunId, setSelectedRunId] = useState('');
  const [cardIndex, setCardIndex] = useState(0);
  const [decision, setDecision] = useState({ intent: ACTIONS.runTogether, friend: null });
  const [actionMessage, setActionMessage] = useState('오른쪽으로 밀면 같이 뛰기');
  const [drag, setDrag] = useState({ active: false, startX: 0, startY: 0, x: 0, y: 0 });

  useEffect(() => {
    let cancelled = false;
    fetchKyroData()
      .then((apiData) => {
        if (cancelled) return;
        setRuns(apiData);
        setSelectedRunId(apiData.myRuns[0].id);
        setStatus('live');
      })
      .catch((error) => {
        if (!cancelled) {
          setErrorMessage(error.message);
          setStatus('error');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedRun = runs.myRuns.find((run) => run.id === selectedRunId) ?? runs.myRuns[0];
  const candidateRuns = useMemo(() => {
    const seen = new Set();
    const candidates = [];
    const addCandidate = (run) => {
      if (!run || run.id === selectedRun?.id || seen.has(run.id)) return;
      seen.add(run.id);
      candidates.push(run);
    };

    runs.friendRuns.forEach(addCandidate);
    runs.myRuns.forEach(addCandidate);
    if (selectedRun && candidates.length < 2) {
      buildDemoCandidates(selectedRun).forEach(addCandidate);
    }
    return candidates;
  }, [runs.friendRuns, runs.myRuns, selectedRun?.id]);
  const activeFriend = candidateRuns.length ? candidateRuns[cardIndex % candidateRuns.length] : null;
  const nextFriend = candidateRuns.length > 1 ? candidateRuns[(cardIndex + 1) % candidateRuns.length] : null;
  const selectedRunWithDetail = selectedRun ? details[selectedRun.id] ?? selectedRun : null;
  const activeFriendWithDetail = activeFriend ? details[activeFriend.id] ?? activeFriend : null;
  const resultFriend = decision.friend ? details[decision.friend.id] ?? decision.friend : activeFriendWithDetail;

  useEffect(() => {
    const targets = [selectedRun, activeFriend].filter((run) => run && !run.synthetic && !details[run.id]);
    if (!targets.length) return;

    let cancelled = false;
    setDetailStatus('loading');
    Promise.allSettled(targets.map(fetchRunDetail)).then((results) => {
      if (cancelled) return;
      setDetails((current) => {
        const next = { ...current };
        results.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            next[targets[index].id] = result.value;
          }
        });
        return next;
      });
      setDetailStatus(results.some((result) => result.status === 'fulfilled') ? 'live' : 'error');
    });

    return () => {
      cancelled = true;
    };
  }, [activeFriend, details, selectedRun]);

  useEffect(() => {
    setCardIndex(0);
    setDecision({ intent: ACTIONS.runTogether, friend: null });
    setActionMessage(candidateRuns.length > 1 ? '오른쪽으로 밀면 같이 뛰기' : '후보 카드를 준비하는 중');
  }, [candidateRuns.length, selectedRunId]);

  const match = useMemo(
    () => (selectedRunWithDetail && resultFriend ? calculateBuddyMatch(selectedRunWithDetail, resultFriend, decision.intent) : null),
    [decision.intent, resultFriend, selectedRunWithDetail],
  );

  function choose(nextIntent) {
    if (!activeFriend || candidateRuns.length <= 1) return;

    const chosenFriend = activeFriendWithDetail ?? activeFriend;
    const nextIndex = (cardIndex + 1) % candidateRuns.length;
    const upcomingFriend = candidateRuns[nextIndex];
    setDrag({ active: false, startX: 0, startY: 0, x: 0, y: 0 });

    if (nextIntent === ACTIONS.pass) {
      setActionMessage(`${chosenFriend.name} 패스 완료 · 다음은 ${upcomingFriend.name}`);
    } else {
      setDecision({ intent: nextIntent, friend: chosenFriend });
      setActionMessage(nextIntent === ACTIONS.rival ? `${chosenFriend.name} 라이벌 찜 · 다음은 ${upcomingFriend.name}` : `${chosenFriend.name} 매칭 찜 · 다음은 ${upcomingFriend.name}`);
    }

    setCardIndex((index) => index + 1);
  }

  function beginSwipe(event) {
    if (!activeFriend) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ active: true, startX: event.clientX, startY: event.clientY, x: 0, y: 0 });
  }

  function moveSwipe(event) {
    if (!drag.active) return;
    setDrag((current) => ({
      ...current,
      x: event.clientX - current.startX,
      y: event.clientY - current.startY,
    }));
  }

  function endSwipe() {
    if (!drag.active) return;
    const { x, y } = drag;
    setDrag({ active: false, startX: 0, startY: 0, x: 0, y: 0 });
    if (x > 92) choose(ACTIONS.runTogether);
    else if (x < -92) choose(ACTIONS.pass);
    else if (y < -92) choose(ACTIONS.rival);
  }

  const isReady = status === 'live' && selectedRunWithDetail && activeFriendWithDetail && match;
  const canChoose = Boolean(activeFriend && candidateRuns.length > 1);

  return (
    <main className="app-shell">
      <section className="hero">
        <div>
          <p className="eyebrow">KYRO Mate</p>
          <h1>내 페이스에 반할 시간.</h1>
          <p className="hero-copy">오늘 같이 뛸 사람, 한 장의 카드로 끝.</p>
        </div>
        <Mascot />
          <div className={`status ${status}`}>
          {status === 'live' ? '연결됨' : status === 'loading' ? '동기화' : '오류'}
        </div>
      </section>

      {!isReady && (
        <section className="panel api-state">
          <p className="eyebrow">실제 API 연결</p>
          <h2>{status === 'loading' ? 'KYRO API에서 실제 러닝 데이터를 불러오는 중' : 'KYRO API 연결이 필요합니다'}</h2>
          <p>
            {status === 'loading'
              ? '샘플 유저 없이 KYRO 읽기 전용 API 응답만 기다립니다.'
              : `${errorMessage || 'API 응답 실패'} · Vercel env의 KYRO_API_KEY와 KYRO_API_BASE_URL을 확인하세요.`}
          </p>
        </section>
      )}

      <section className={isReady ? 'date-layout' : 'date-layout disabled'}>
        <aside className="run-dock glass-card">
          <p className="eyebrow">내 러닝</p>
          <div className="run-list">
            {runs.myRuns.map((run) => (
              <button
                className={run.id === selectedRunId ? 'run-option active' : 'run-option'}
                key={run.id}
                onClick={() => setSelectedRunId(run.id)}
              >
                <span>{run.title}</span>
                <strong>{Number.isFinite(run.distanceKm) ? run.distanceKm.toFixed(1) : '--'}K · {formatPace(run.paceSecPerKm)}</strong>
              </button>
            ))}
          </div>
          {selectedRunWithDetail && <RunDetail run={selectedRunWithDetail} label="선택한 러닝 상세" compact />}
        </aside>

        <section className="phone-stage">
          <div className="phone-shell">
            <div className="phone-topbar">
              <span>KYRO Mate</span>
              <small>{detailStatus === 'loading' ? '궁합 계산 중' : actionMessage}</small>
            </div>
            <div className="card-stack">
              {nextFriend && <FriendCard key={`next-${nextFriend.id}-${cardIndex}`} friend={nextFriend} ghost />}
              {activeFriendWithDetail && (
                <FriendCard
                  key={`active-${activeFriendWithDetail.id}-${cardIndex}`}
                  friend={activeFriendWithDetail}
                  drag={drag}
                  onPointerDown={beginSwipe}
                  onPointerMove={moveSwipe}
                  onPointerUp={endSwipe}
                  onPointerCancel={endSwipe}
                />
              )}
            </div>
            <div className="actions">
              <button className="pass" onClick={() => choose(ACTIONS.pass)} disabled={!canChoose}>패스</button>
              <button className="spark" onClick={() => choose(ACTIONS.rival)} disabled={!canChoose}>라이벌</button>
              <button className="primary" onClick={() => choose(ACTIONS.runTogether)} disabled={!canChoose}>같이 뛰기</button>
            </div>
            <p className="skip-copy">{actionMessage}</p>
          </div>
        </section>

        <section className="match-card glass-card">
          <p className="eyebrow">궁합</p>
          <div className="score-row">
              <span>{match ? matchTypeLabels[match.type] ?? match.type : 'API 대기 중'}</span>
            <strong>{match?.score ?? '--'}%</strong>
          </div>
          <h2>{match?.headline ?? '실제 러닝 데이터가 오면 바로 계산합니다.'}</h2>
          <p className="recommendation">{match?.recommendation ?? '--'}</p>
          <div className="score-bars">
            {Object.entries(match?.parts ?? {}).map(([key, value]) => (
              <div key={key}>
                <span>{scorePartLabels[key] ?? key}</span>
                <meter min="0" max={key === 'pace' ? 35 : key === 'distance' ? 25 : key === 'vibe' ? 10 : 15} value={value} />
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

function Mascot() {
  return (
    <div className="mascot" aria-label="KYRO Mate 마스코트">
      <div className="mascot-ear left" />
      <div className="mascot-ear right" />
      <div className="mascot-face">
        <span className="mascot-eye left" />
        <span className="mascot-eye right" />
        <span className="mascot-blush left" />
        <span className="mascot-blush right" />
        <span className="mascot-mouth" />
      </div>
      <div className="mascot-heart" />
    </div>
  );
}

function RunDetail({ run, label, compact = false }) {
  return (
    <div className={compact ? 'detail-strip compact' : 'detail-strip'} aria-label={label}>
      <span>{run.splitsCount || '--'} 구간</span>
      <span>{run.trackPointCount || '--'} GPS 포인트</span>
      <span>{Number.isFinite(run.elevationGainM) ? `+${Math.round(run.elevationGainM)}m` : '-- 고도'}</span>
      <span>{Number.isFinite(run.territoryGainM2) ? `${Math.round(run.territoryGainM2)}m²` : '-- 영역'}</span>
    </div>
  );
}

function FriendCard({ friend, ghost = false, drag, ...handlers }) {
  const swipeStyle = drag?.active
    ? { transform: `translate(${drag.x}px, ${drag.y * 0.28}px) rotate(${drag.x / 18}deg)` }
    : undefined;

  return (
    <article className={ghost ? 'friend-card ghost' : 'friend-card'} style={swipeStyle} {...handlers}>
      {!ghost && (
        <>
          <span className="swipe-stamp like" style={{ opacity: Math.min(Math.max((drag?.x ?? 0) / 90, 0), 1) }}>좋아요</span>
          <span className="swipe-stamp nope" style={{ opacity: Math.min(Math.max(-(drag?.x ?? 0) / 90, 0), 1) }}>패스</span>
          <span className="swipe-stamp rival" style={{ opacity: Math.min(Math.max(-(drag?.y ?? 0) / 90, 0), 1) }}>라이벌</span>
        </>
      )}
      <div className="card-topline">
        <span>{friend.name}</span>
        <small>{timeSlotLabels[friend.timeSlot] ?? '시간대 준비중'}</small>
      </div>
      <h3>{friend.title}</h3>
      <div className="stats">
        <strong>{Number.isFinite(friend.distanceKm) ? friend.distanceKm.toFixed(1) : '--'}K</strong>
        <strong>{formatPace(friend.paceSecPerKm)}</strong>
        <strong>{friend.area}</strong>
      </div>
      <p>{friend.note}</p>
    </article>
  );
}
