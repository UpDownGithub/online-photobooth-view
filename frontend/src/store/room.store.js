function createInitialRenderPreview() {
  return {
    status: 'idle',  
    imageUrl: null,
    filter: null,
    error: null,
  };
}

const state = {
  room: null,
  socketConnected: false,
   
  renderPreview: createInitialRenderPreview(),
   
  filters: [],

  stickers: [],
};

export function getRoomState() {
  return state;
}

export function setRoom(room) {
  state.room = room;
}

export function clearRoom() {
  state.room = null;
  state.renderPreview = createInitialRenderPreview();
}

export function setFilters(filters) {
  state.filters = filters || [];
}

export function setStickers(stickers) {
  state.stickers = stickers || [];
}

export function setSocketConnected(value) {
  state.socketConnected = value;
}

export function setRenderPreviewLoading() {
  state.renderPreview = {
    status: 'loading',
    imageUrl: null,
    filter: null,
    error: null,
  };
}

export function setRenderPreviewReady(imageUrl, filter) {
  state.renderPreview = {
    status: 'ready',
    imageUrl,
    filter,
    error: null,
  };
}

export function setRenderPreviewError(error) {
  state.renderPreview = {
    status: 'error',
    imageUrl: null,
    filter: null,
    error,
  };
}

export function clearRenderPreview() {
  state.renderPreview = createInitialRenderPreview();
}
