// Removed big-integer import, using native bigint

import { RequestState } from '../network/RequestState';

export class PendingState {
  _pending: Map<string, RequestState>;
  constructor() {
    this._pending = new Map();
  }

  set(msgId: bigint, state: RequestState) {
    this._pending.set(msgId.toString(), state);
  }

  get(msgId: bigint) {
    return this._pending.get(msgId.toString());
  }

  getAndDelete(msgId: bigint) {
    const state = this.get(msgId);
    this.delete(msgId);
    return state;
  }

  values() {
    return Array.from(this._pending.values());
  }

  delete(msgId: bigint) {
    this._pending.delete(msgId.toString());
  }

  clear() {
    this._pending.clear();
  }
}
