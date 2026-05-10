const timeOrder = ['morning', 'afternoon', 'evening', 'night'];

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export function formatPace(seconds) {
  if (!Number.isFinite(seconds)) return '--:--';
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${rest}/km`;
}

function paceFit(myRun, friendRun) {
  const diff = Math.abs((myRun.paceSecPerKm ?? 330) - (friendRun.paceSecPerKm ?? 330));
  return Math.round(clamp(35 - diff / 3, 10, 35));
}

function distanceFit(myRun, friendRun) {
  const diff = Math.abs((myRun.distanceKm ?? 5) - (friendRun.distanceKm ?? 5));
  return Math.round(clamp(25 - diff * 4, 8, 25));
}

function timeFit(myRun, friendRun) {
  const myIndex = timeOrder.indexOf(myRun.timeSlot);
  const friendIndex = timeOrder.indexOf(friendRun.timeSlot);
  if (myIndex < 0 || friendIndex < 0) return 8;
  return Math.round(clamp(15 - Math.abs(myIndex - friendIndex) * 5, 5, 15));
}

function locationFit(myRun, friendRun) {
  if (myRun.area && myRun.area === friendRun.area) return 15;
  if (myRun.city && myRun.city === friendRun.city) return 11;
  return 7;
}

function vibeBonus(myRun, friendRun) {
  const combined = `${myRun.note ?? ''} ${friendRun.note ?? ''} ${friendRun.tag ?? ''}`.toLowerCase();
  if (combined.includes('rival') || combined.includes('후반') || combined.includes('마지막')) return 10;
  if (combined.includes('recovery') || combined.includes('수다') || combined.includes('coffee')) return 9;
  return 7;
}

export function calculateBuddyMatch(myRun, friendRun, intent = 'Run Together') {
  const parts = {
    pace: paceFit(myRun, friendRun),
    distance: distanceFit(myRun, friendRun),
    time: timeFit(myRun, friendRun),
    location: locationFit(myRun, friendRun),
    vibe: vibeBonus(myRun, friendRun),
  };

  const score = Object.values(parts).reduce((sum, value) => sum + value, 0);
  const friendIsFaster = (friendRun.paceSecPerKm ?? 999) < (myRun.paceSecPerKm ?? 0) - 8;
  const distanceClose = Math.abs((myRun.distanceKm ?? 5) - (friendRun.distanceKm ?? 5)) <= 1.5;

  let type = 'Chaos Buddy';
  if (score >= 90) type = 'Perfect Pace Buddy';
  else if (intent === 'Rival Buddy' || (score >= 78 && friendIsFaster)) type = 'Rival Buddy';
  else if (score >= 76 && distanceClose) type = 'Long Run Material';
  else if ((friendRun.paceSecPerKm ?? 0) > (myRun.paceSecPerKm ?? 999) + 25) type = 'Recovery Buddy';

  return {
    score,
    type,
    parts,
    headline: makeHeadline(type),
    recommendation: makeRecommendation(myRun, friendRun, type),
    warning: makeWarning(type, friendRun),
  };
}

function makeHeadline(type) {
  const copy = {
    'Perfect Pace Buddy': '둘은 대화보다 페이스가 먼저 맞습니다.',
    'Rival Buddy': '같이 뛰면 친구인데, 마지막 1km부터는 적입니다.',
    'Long Run Material': '길게 뛰어도 어색하지 않은 러닝 파티원입니다.',
    'Recovery Buddy': '오늘은 기록 말고 수다 페이스입니다.',
    'Chaos Buddy': '페이스는 달라도 같이 뛰면 이야기는 확실합니다.',
  };
  return copy[type];
}

function makeRecommendation(myRun, friendRun, type) {
  const distance = Math.round(((myRun.distanceKm ?? 5) + (friendRun.distanceKm ?? 5)) / 2);
  const place = myRun.area === friendRun.area ? myRun.area : myRun.city;
  if (type === 'Rival Buddy') return `${place} ${distance}K 템포런`;
  if (type === 'Recovery Buddy') return `${place} 3K 회복 조깅`;
  return `${place} ${distance}K 페이스 메이트런`;
}

function makeWarning(type, friendRun) {
  if (type === 'Rival Buddy') return `${friendRun.name}은 후반에 치고 나갈 확률이 높습니다.`;
  if (type === 'Recovery Buddy') return '둘 다 초반에 너무 신나면 후반에 망합니다.';
  return friendRun.note ?? '첫 1km만 참으면 호흡이 맞습니다.';
}
