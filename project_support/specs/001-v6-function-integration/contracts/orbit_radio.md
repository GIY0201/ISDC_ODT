# 저장 궤도 radio geometry v1

POST /api/orbit/radio-geometry: client_request_id(1..128),selection_revision(int>=0),input_id(1..100),utc(UTC Z,윤초보존),frequency_hz(0< f <=300000000000). extra/bool/NaN/Inf reject. 지점/고도각은runtime selection을사용하며요청이수정하지않는다. 기존samples/visibility unchanged.
응답: requestID/revision/inputID/hash/ground_point(virtual/WGS84)/minimum_elevation_deg, utc/frequency_hz와position_m/velocity_m_s/elevation_deg/range_m/range_rate_m_s/doppler_hz/received_frequency_hz/error_code/EOP/leap/frame=ITRF/profile=WGS72_AFSPC. model=one_way_first_order_v1,status=valid|error,stale bool,communication_status=unknown,units와assumptions. error상태는위치/속도/거리/rate/Doppler/수신주파수/고도각null. 응답utc는canonicalnanosecondstring. 다른revision409/부하·계산기없음503/EOP범위422.
단위 SI, 도플러부호는이탈rate>0 →shift<0, 접근<0→shift>0. c=299792458m/s. 같은UTC의거리이며광행시간/상대론/굴절/송수신기오차제외,LOD=0/polar rate무시. 모델한계표시, horizon아래도기하값계산하되수신가능이라고표시하지않는다.
Browser는입력UTC canonicalization을공유 orbit_utc module로검증하고 Hz/MHz변환을명시. 결과는입력/revision/hash/ground/EOP/leap/frame/profile/단위/model/통신unknown/stale/metrics/formula정합을검증한사본이다. 사용자버튼한번에단일UTC,자동재생추종없음. remote같은값도결과폐기·공식출처강등,local복원은보존.
