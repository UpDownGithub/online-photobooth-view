# Online Photobooth

사람들과 실시간으로 한 방에 모여 미리보기를 꾸미고, 촬영한 사진을 포토부스 이미지로 완성하는 웹서비스입니다.

이 저장소는 프로젝트의 구현과 구조를 살펴볼 수 있도록 선별한 코드 사본입니다.

아래 기술 스택·주요 기능·구조는 원본 서비스 기준입니다. 공개 코드에는 사용자 화면과 계산 로직, 촬영 상태 전환·사진 처리·WebRTC 협상을 따로 실행하고 검증할 수 있는 예제를 담았습니다.

## 화면 미리보기

| 시작 화면 | 촬영 화면 |
| :---: | :---: |
| <img src="docs/images/landing.png" alt="시작 화면" width="260"> | <img src="docs/images/booth-demo.png" alt="촬영 화면" width="260"> |

촬영 화면의 인물은 AI로 제작한 예시 이미지입니다.

## 기술 스택

| 영역 | 기술 |
| --- | --- |
| 프론트엔드 | HTML/CSS, Vanilla JavaScript ES Modules, Canvas/WebGL |
| 서버 | Node.js, Express, REST API |
| 실시간 통신 | Socket.io, WebRTC, STUN/TURN |
| 이미지 처리 | Sharp |
| 선택적 외부 연동 | PostgreSQL(Supabase), Cloudflare R2, Cloudflare TURN |
| 배포 환경 | Railway |

클라이언트는 Express가 정적으로 제공합니다.

## 사용자 경험
**서비스 흐름: 방 생성·초대 → 준비 → 카운트다운 → 촬영 → 결과 확인·다운로드**

- 초대받은 참가자들이 함께 준비, 촬영, 리뷰하는 흐름
	- 참가자 영상 미리보기
	- 프레임, 필터, 스티커를 이용한 사진 꾸미기
	- 촬영 후 필터 적용
	- 결과물 확인 및 이미지 다운로드

## 주요 기능

- 방 생성·초대·참가·퇴장과 최대 인원 관리
- 참가자 status 및 촬영순서·카운트다운 동기화
- WebRTC 기반 참가자 영상 미리보기
- 카메라 전환, 사진 캡처·업로드, 결과 다운로드
- 프레임·필터·스티커를 반영한 이미지 합성
- OAuth 로그인, PostgreSQL 기록, R2 앨범 및 관리자 페이지

## 구조와 설계

- **서버가 상태 관리:** 방·촬영 상태를 서버가 관리하고, 클라이언트는 전달받은 상태를 반영합니다. 일반적인 사용자 동작은 REST로 처리하고 Socket.io로 상태와 이벤트를 전달합니다.
- **영상과 사진의 경로 분리:** Socket.io가 연결을 중계한 후에, WebRTC의 P2P 또는 TURN 경로로 상대의 화면이 미리보기로 나타납니다. 촬영 이미지는 HTTP로 업로드한 뒤 서버에서 합성합니다.
- **실시간 상태와 영속 기록 분리:** 진행 중인 방은 서버 메모리에서 관리합니다. DB는 익명 집계와 로그인 정보를 위해 구현했습니다.
- **영상 요소를 유지하는 화면 갱신:** 카운트다운·Ready·장식 변경 시에는 부분 갱신을 사용해 비디오의 재생성을 줄입니다.

공개 예제의 데이터 흐름과 상태 전이는 [구현 흐름 안내](docs/SAMPLE_FLOWS.md)에 정리했습니다.

## 문제 해결

[기술 설명](docs/TECHNICAL_NOTES.md)에서 확인할 수 있습니다.

## 개발 기여, AI 활용

사용자 화면뿐 아니라 서비스 전반의 개발을 담당했습니다. 여러 참가자의 상호작용과 촬영 흐름을 맞추고, 브라우저 카메라·실시간 영상·이미지 처리를 하나의 사용자 경험으로 연결했습니다.

- **본인(UpDownGithub):** 서비스 전반의 개발을 담당했습니다.
- **AI 도구:** 설계, 코드 작성, 디버깅 전반에 활용했습니다.

자세한 역할 설명은 [기여 문서](docs/CONTRIBUTIONS.md)에 적었습니다.

## 코드 살펴보기

| 내용 | 대표 파일 |
| --- | --- |
| 시작 화면 | [landing.view.js](frontend/src/pages/landing.view.js) |
| 촬영 화면 | [room.view.js](frontend/src/pages/room.view.js) |
| 결과 화면 | [review.view.js](frontend/src/pages/review.view.js) |
| 부분 갱신 | [partial-updates.js](frontend/src/pages/partial-updates.js) |
| 스티커 조작 | [sticker.interactions.js](frontend/src/pages/sticker.interactions.js) |
| 상태·레이아웃 | [상태 관리](frontend/src/store/room.store.js), [좌표 계산](frontend/src/pages/layouts.js) |
| UI·스타일 | [UI 컴포넌트](frontend/src/ui), [CSS](frontend/styles) |
| 서버 처리 예시 | [컨트롤러](backend/modules/frames/frame.controller.cjs), [서비스](backend/modules/frames/frame.service.cjs) |
| 서버 계산 모듈 | [레이아웃](backend/modules/frames/layouts.cjs), [필터](backend/modules/filters/filters.cjs) |
| 촬영 상태·순서 | [shooting-session.cjs](backend/modules/shooting/shooting-session.cjs) |
| 카메라 캡처·압축 | [capture-frame.js](frontend/src/media/capture-frame.js), [shot-upload.js](frontend/src/media/shot-upload.js), [shot-pipeline.js](frontend/src/media/shot-pipeline.js) |
| 사진 합성 | [compose.cjs](backend/modules/render/compose.cjs) |
| WebRTC 협상 | [peer-session.js](frontend/src/rtc/peer-session.js) |
| 연결 예제·테스트 | [촬영부터 합성까지](examples/shooting-flow.cjs), [테스트](tests) |

파일별 역할과 공개용 변경 사항은 [코드 안내](docs/CODE_GUIDE.md)에 정리했습니다.

추가 예제는 Ready → 카운트다운 → 촬영 → 리뷰 흐름, 카메라 캡처·해상도를 유지하는 JPEG 압축·이미지 합성, ICE 후보 대기와 한쪽 offer 생성을 다룹니다. 실행 방법과 검증 범위는 [구현 흐름 안내](docs/SAMPLE_FLOWS.md)에서 확인할 수 있습니다.

## 공개 범위

전체 서비스를 실행하는 배포본은 아닙니다.

실제 서비스의 인증·외부 저장소·TURN 발급 연결은 제외했습니다. 예제는 가짜 참가자·생성 이미지·가짜 peer로 검증하며, 실제 카메라나 WebRTC 네트워크 연결 품질을 검증하는 테스트는 아닙니다.
