# 기술 구현과 문제 해결 근거

현재 view 저장소에 공개된 코드에서 확인할 수 있는 구현 접근을 정리했습니다.

| 구현 과제 | 구현한 접근 | 공개 코드 근거 |
| --- | --- | --- |
| 작은 상태 변경마다 영상 화면이 다시 생성되는 문제 | 전체 화면을 다시 그리는 대신 상태 문구·준비 버튼·참가자 목록 등 필요한 요소만 갱신 | [partial-updates.js](../frontend/src/pages/partial-updates.js)의 `updateStatusText`, `updateReadyControls` |
| 프레임과 참가자 수에 따라 달라지는 사진 배치 | 레이아웃 선택과 슬롯 좌표를 함수로 계산하고, 촬영 순서와 화면 배치 순서를 분리 | [layouts.js](../frontend/src/pages/layouts.js)의 `resolveTemplate`, `buildFrameGeometry`, `slotOrder` · [서버 계산 모듈](../backend/modules/frames/layouts.cjs) |
| 화면 크기가 달라도 일관된 스티커 이동·확대·회전 | 프레임 기준 비율 좌표로 이동을 계산하고, 조작 핸들의 거리와 각도로 크기·회전을 조정 | [sticker.interactions.js](../frontend/src/pages/sticker.interactions.js)의 `bindStickerInteractions` · [room.helpers.js](../frontend/src/pages/room.helpers.js)의 `stickerStyle` |
| 결과 미리보기의 대기·완료·오류 상태 구분 | 방 상태와 결과 미리보기 상태를 나누고 `idle`, `loading`, `ready`, `error` 전환을 명시 | [room.store.js](../frontend/src/store/room.store.js)의 `setRenderPreviewLoading`, `setRenderPreviewReady`, `setRenderPreviewError` |
| 응답 처리와 데이터 가공의 책임 분리 | 컨트롤러는 응답을 만들고, 서비스는 사용 가능한 프레임·디자인을 골라 표시용 필드를 구성 | [frame.controller.cjs](../backend/modules/frames/frame.controller.cjs) → [frame.service.cjs](../backend/modules/frames/frame.service.cjs)의 `framesForClient` |
| 필터별 색 변환 정의와 목록 구성 | 필터 설정을 레지스트리에 모으고, 색 변환 행렬 계산과 화면용 목록 생성을 함수로 분리 | [filters.cjs](../backend/modules/filters/filters.cjs)의 `FILTERS`, `mix`, `saturate`, `multiply`, `filtersForClient` |
| 참가자 준비 상태와 여러 컷의 촬영 순서를 일관되게 관리 | 모두 Ready인지 확인한 뒤 참가자를 순환하며 촬영. 시작 시각 기준 카운트다운과 컷 완료 조건을 검사하고 마지막 컷에서 리뷰로 전환 | [shooting-session.cjs](../backend/modules/shooting/shooting-session.cjs)의 `start`, `tickCountdown`, `advance`, `moveToNextShotOrReview` |
| 캡처 구도와 해상도를 유지하면서 큰 사진을 전달 | 선택한 영상의 중앙을 정사각형으로 크롭하고 기기 해상도 이상으로 확대하지 않음. 같은 원본 캔버스에서 JPEG 품질을 단계적으로 낮춰 5 MiB 이내로 압축 | [capture-frame.js](../frontend/src/media/capture-frame.js)의 `captureFrame` · [shot-upload.js](../frontend/src/media/shot-upload.js)의 `encodeShotForUpload` |
| 인코딩 지연·중복 완료 이벤트·재시도로 사진이 잘못 전달되는 문제 | 촬영 시작 시 캡처하고 완료 시 인코딩. 같은 완료 이벤트는 한 작업을 공유하며, 재촬영 후 이전 세대의 결과는 전달하지 않음. 재시도 시 같은 Blob 사용 | [shot-pipeline.js](../frontend/src/media/shot-pipeline.js)의 `createShotPipeline` · [shot-upload.js](../frontend/src/media/shot-upload.js)의 `retryShotUpload` |
| 프레임·필터·스티커를 최종 이미지에 일관되게 반영 | 촬영 순서와 슬롯 배치를 분리하고 리뷰 필터를 실제 픽셀에 적용. 프레임 다음에 스티커를 얹으며 회전한 스티커의 프레임 밖 영역은 크롭. 최종 WebP는 알파 유지 | [compose.cjs](../backend/modules/render/compose.cjs)의 `composeReview`, `applyFilterRecipe`, `buildStickerLayer` |
| 원격 설명보다 먼저 도착한 ICE 후보가 유실되는 문제 | 원격 설명 설정 전에는 후보를 대기 목록에 보관하고 설정 후 순서대로 적용. 후보 하나가 실패해도 나머지는 계속 처리 | [peer-session.js](../frontend/src/rtc/peer-session.js)의 `receive`, `flushPendingCandidates` |
| 양쪽의 동시 offer 생성과 연결 종료 후 늦게 끝나는 작업 | offer 생성 역할을 한쪽에 지정하고 비동기 협상을 직렬화. 설명 생성·설정 후 연결이 여전히 유효한지 확인하고 종료 시 대기 목록과 핸들러 정리 | [peer-session.js](../frontend/src/rtc/peer-session.js)의 `connect`, `isActive`, `close` |

## 연결 예제와 검증

[촬영부터 합성까지의 예제](../examples/shooting-flow.cjs)는 가짜 참가자 2명과 생성한 색상 카드 4장으로 준비 → 촬영 → JPEG 인코딩 → 전달 → WebP 합성을 연결합니다. 마지막 상태는 기존 촬영 화면의 렌더링 함수에도 전달합니다.

관련 [테스트 26개](../tests)에서 상태 전환·시간 경계·재촬영, 크롭·압축·재시도, 실제 합성 픽셀의 배치·필터·스티커, ICE 도착 순서와 협상 종료를 검증했습니다. 기존 프런트엔드와 서버의 레이아웃 계산도 비교했습니다. Canvas는 Sharp 기반 테스트 어댑터를, peer는 가짜 객체를 사용하므로 실제 기기의 카메라·브라우저 인코더·WebRTC 연결 품질을 확인한 결과는 아닙니다.

일부 화면 코드와 서버 처리 예시는 원본에서 발췌하거나 공개용으로 단순화했습니다. 스티커 변경은 콜백으로 전달하고, 프레임 목록 예시는 메모리 레지스트리를 사용합니다. 촬영·사진 처리·WebRTC 예제는 시계, 영상 입력, 전달·peer 생성 함수를 주입하도록 재구성했습니다. 파일별 변경 범위는 [코드 안내](CODE_GUIDE.md)와 [구현 흐름 안내](SAMPLE_FLOWS.md)에 정리했습니다.

이 문서의 코드 근거는 공개된 예시에 한정하며, 전체 서비스의 통신·운영 구현은 포함하지 않습니다.
