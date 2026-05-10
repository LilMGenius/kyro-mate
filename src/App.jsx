import { useEffect, useMemo, useState } from 'react';
import { calculateBuddyMatch, formatPace } from './scoring.js';

const emptyRuns = { myRuns: [], friendRuns: [] };

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
  const paceSecPerKm = parsePaceSeconds(
    run.paceSecPerKm ?? run.average_pace_sec_per_km ?? run.avg_pace_s_km ?? run.avg_pace ?? run.pace,
  ) ?? (distanceKm && run.duration_s ? Number(run.duration_s) / distanceKm : undefined);

  return {
    id: String(run.id ?? run.run_id ?? `${kind}-${index}`),
    name: run.name ?? user.name ?? run.friendName ?? run.friend_name ?? `${kind === 'friend' ? 'KYRO Runner' : 'My Run'} ${index + 1}`,
    title: run.title ?? run.name ?? run.activityName ?? run.activity_name ?? `KYRO Run ${index + 1}`,
    distanceKm,
    paceSecPerKm,
    city: run.city ?? location.city ?? run.region ?? run.place_region_label ?? 'KYRO',
    area: run.area ?? location.area ?? location.name ?? run.route_name ?? run.place_display_label ?? run.place_region_label ?? run.city ?? 'Route',
    timeSlot: parseTimeSlot(run),
    tag: run.tag ?? run.vibe ?? run.type ?? 'read-only API run',
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
  const [intent, setIntent] = useState('Run Together');
  const [lastSkipped, setLastSkipped] = useState(null);

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
  const activeFriend = runs.friendRuns.length ? runs.friendRuns[cardIndex % runs.friendRuns.length] : null;
  const nextFriend = runs.friendRuns.length ? runs.friendRuns[(cardIndex + 1) % runs.friendRuns.length] : null;
  const selectedRunWithDetail = selectedRun ? details[selectedRun.id] ?? selectedRun : null;
  const activeFriendWithDetail = activeFriend ? details[activeFriend.id] ?? activeFriend : null;

  useEffect(() => {
    const targets = [selectedRun, activeFriend].filter((run) => run && !details[run.id]);
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

  const match = useMemo(
    () => (selectedRunWithDetail && activeFriendWithDetail ? calculateBuddyMatch(selectedRunWithDetail, activeFriendWithDetail, intent) : null),
    [activeFriendWithDetail, intent, selectedRunWithDetail],
  );

  function choose(nextIntent) {
    if (!activeFriend) return;
    setIntent(nextIntent);
    if (nextIntent === 'Not My Pace') {
      setLastSkipped(activeFriend.name);
      setCardIndex((index) => index + 1);
      return;
    }
    setLastSkipped(null);
  }

  const isReady = status === 'live' && selectedRunWithDetail && activeFriendWithDetail && match;

  return (
    <main className="app-shell">
      <section className="hero panel">
        <div>
          <p className="eyebrow">KYRO Mate</p>
          <h1>Find Your KYRO Mate</h1>
          <p className="hero-copy">
            KYRO가 러닝을 영토 게임으로 만들었다면, KYRO Mate는 같이 뛸 파티원을 바로 매칭합니다.
          </p>
        </div>
        <div className={`status ${status}`}>
          {status === 'live' ? 'LIVE API' : status === 'loading' ? 'SYNCING' : 'API ERROR'}
        </div>
      </section>

      {!isReady && (
        <section className="panel api-state">
          <p className="eyebrow">Real API Only</p>
          <h2>{status === 'loading' ? 'KYRO API에서 실제 러닝 데이터를 불러오는 중' : 'KYRO API 연결이 필요합니다'}</h2>
          <p>
            {status === 'loading'
              ? 'mock 유저 없이 KYRO read-only API 응답만 기다립니다.'
              : `${errorMessage || 'API 응답 실패'} · Vercel env의 KYRO_API_KEY와 KYRO_API_BASE_URL을 확인하세요.`}
          </p>
        </section>
      )}

      <section className={isReady ? 'grid' : 'grid disabled'}>
        <aside className="panel run-picker">
          <p className="eyebrow">Step 1</p>
          <h2>내 러닝 선택</h2>
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
          {selectedRunWithDetail && <RunDetail run={selectedRunWithDetail} label="Selected detail" />}
          <div className="mini-note">
            실제 KYRO API 데이터만 사용 · 상세 {detailStatus === 'loading' ? '동기화 중' : detailStatus === 'live' ? '반영됨' : '대기'}
          </div>
        </aside>

        <section className="panel card-zone">
          <p className="eyebrow">Step 2</p>
          <h2>친구 러닝 카드</h2>
          <div className="card-stack">
            {nextFriend && <FriendCard friend={nextFriend} ghost />}
            {activeFriendWithDetail && <FriendCard friend={activeFriendWithDetail} />}
          </div>
          <div className="actions">
            <button onClick={() => choose('Not My Pace')}>Not My Pace</button>
            <button onClick={() => choose('Rival Buddy')}>Rival Buddy</button>
            <button className="primary" onClick={() => choose('Run Together')}>Run Together</button>
          </div>
          {lastSkipped && <p className="skip-copy">{lastSkipped} 카드는 넘겼고, 다음 후보를 계산 중입니다.</p>}
        </section>

        <section className="panel result-card">
          <p className="eyebrow">Step 3</p>
          <div className="score-row">
            <span>{match?.type ?? 'Waiting API'}</span>
            <strong>{match?.score ?? '--'}%</strong>
          </div>
          <h2>{match?.headline ?? '실제 러닝 데이터가 오면 바로 계산합니다.'}</h2>
          <p>추천 러닝: {match?.recommendation ?? '--'}</p>
          <p>주의: {match?.warning ?? '--'}</p>
          {activeFriendWithDetail && <RunDetail run={activeFriendWithDetail} label="Friend detail" />}
          <div className="score-bars">
            {Object.entries(match?.parts ?? {}).map(([key, value]) => (
              <div key={key}>
                <span>{key}</span>
                <meter min="0" max={key === 'pace' ? 35 : key === 'distance' ? 25 : key === 'vibe' ? 10 : 15} value={value} />
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

function RunDetail({ run, label }) {
  return (
    <div className="detail-strip" aria-label={label}>
      <span>{run.splitsCount || '--'} splits</span>
      <span>{run.trackPointCount || '--'} GPS pts</span>
      <span>{Number.isFinite(run.elevationGainM) ? `+${Math.round(run.elevationGainM)}m` : '-- elev'}</span>
      <span>{Number.isFinite(run.territoryGainM2) ? `${Math.round(run.territoryGainM2)}m²` : '-- territory'}</span>
    </div>
  );
}

function FriendCard({ friend, ghost = false }) {
  return (
    <article className={ghost ? 'friend-card ghost' : 'friend-card'}>
      <div className="card-topline">
        <span>{friend.name}</span>
        <small>{friend.tag}</small>
      </div>
      <h3>{friend.title}</h3>
      <div className="stats">
        <strong>{Number.isFinite(friend.distanceKm) ? friend.distanceKm.toFixed(1) : '--'}K</strong>
        <strong>{formatPace(friend.paceSecPerKm)}</strong>
        <strong>{friend.area}</strong>
      </div>
      <RunDetail run={friend} label={`${friend.name} detail`} />
      <p>{friend.note}</p>
    </article>
  );
}
