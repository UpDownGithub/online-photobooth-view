// 공개 샘플용 표시 상태 어댑터. 카메라나 네트워크에 접근하지 않습니다.
let mirrored = true;
let error = null;
export function setMediaPresentation({ mirror = true, cameraError = null } = {}) {
  mirrored = Boolean(mirror);
  error = cameraError;
}
export function isMirrored() { return mirrored; }
export function getLocalStreamError() { return error; }
