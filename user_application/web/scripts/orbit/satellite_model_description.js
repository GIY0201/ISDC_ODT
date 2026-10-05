// Original source1a1e002 match descriptions; rendering readiness is separate.
function sizeSentence(match) {
  return match.sizeMeters ? ` 대표 치수 약 ${match.sizeMeters} m 기준의 실제 축척으로 표시합니다.` : '';
}

export function describeMatch(match) {
  if (!match) {
    return {
      state: '미배정', label: '3D 모델 없음',
      note: '로켓 본체, 파편 및 매핑되지 않은 객체는 3D 모델을 배정하지 않고 지구 위에 점으로만 표시합니다.',
      alt: '', credit: '', creditUrl: '',
    };
  }
  const alt = `${match.credit} 렌더링 · ${match.title}`;
  const credit = { credit: match.credit, creditUrl: match.creditUrl || '' };
  if (match.quality === 'assigned') {
    return {
      state: '사용자 지정 모델', label: match.label,
      note: `노드 탭에서 이 위성에 지정한 ${match.credit} 모델(${match.title})입니다. 표시용 형상이며 실제 기체나 촬영 이미지가 아닙니다.${sizeSentence(match)}`,
      alt, ...credit,
    };
  }
  if (match.provider === 'spacetwin') {
    return {
      state: '자체 제작 대표 형상', label: match.label,
      note: `공개 3D 자료가 없어 SpaceTwin이 만든 단순 대표 형상(${match.title})입니다. 제조사 형상이 아니며 실제 촬영 이미지가 아닙니다.${sizeSentence(match)}`,
      alt, ...credit,
    };
  }
  if (match.quality === 'exact') {
    return {
      state: '3D 모델 (해당 기체)', label: match.label,
      note: `해당 기체의 ${match.credit} 모델(${match.title})입니다. 렌더링 이미지이며 실제 촬영 이미지나 현재 자세가 아닙니다.${sizeSentence(match)}`,
      alt, ...credit,
    };
  }
  if (match.quality === 'series') {
    return {
      state: '동일 계열 모델', label: match.label,
      note: `같은 계열 기체의 ${match.credit} 모델(${match.title})로 표시합니다. 세부 형상은 실제 기체와 다를 수 있으며 실제 촬영 이미지가 아닙니다.${sizeSentence(match)}`,
      alt, ...credit,
    };
  }
  const scope = match.kind === 'station' ? '우주정거장' : match.kind === 'cubesat' ? '큐브샛' : `${match.orbit} 탑재체`;
  return {
    state: '대표 형상', label: match.label,
    note: `${scope} 대표 형상으로 ${match.credit}의 ${match.title} 모델을 사용합니다. 실제 기체 외형이 아니며 렌더링 이미지입니다.${sizeSentence(match)}`,
    alt, ...credit,
  };
}

