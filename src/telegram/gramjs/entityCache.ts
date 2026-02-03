// Which updates have the following fields?
// Removed big-integer import, using native bigint

import { isArrayLike, returnBigInt } from './Helpers';
import { Api } from './tl';
import { getInputPeer, getPeerId } from './Utils';

export class EntityCache {
  private cacheMap: Map<string, any>;

  constructor() {
    this.cacheMap = new Map();
  }

  add(entities: any) {
    const temp: any[] = [];
    if (!isArrayLike(entities)) {
      if (entities != undefined) {
        if (typeof entities == 'object') {
          if ('chats' in entities) {
            temp.push(...entities.chats);
          }
          if ('users' in entities) {
            temp.push(...entities.users);
          }
          if ('user' in entities) {
            temp.push(entities.user);
          }
        }
      }
      if (temp.length) {
        entities = temp;
      } else {
        return;
      }
    }
    for (const entity of entities) {
      try {
        const pid = getPeerId(entity);
        if (!this.cacheMap.has(pid.toString())) {
          this.cacheMap.set(pid.toString(), getInputPeer(entity));
        }
      } catch (e) {}
    }
  }

  get(item: bigint | string | undefined) {
    if (item == undefined) {
      throw new Error('No cached entity for the given key');
    }
    const bigIntItem = returnBigInt(item);
    if (bigIntItem < 0n) {
      let res;
      try {
        res = this.cacheMap.get(getPeerId(bigIntItem).toString());
        if (res) {
          return res;
        }
      } catch (e) {
        throw new Error('Invalid key will not have entity');
      }
    }
    for (const cls of [Api.PeerUser, Api.PeerChat, Api.PeerChannel]) {
      const result = this.cacheMap.get(
        getPeerId(new cls({ userId: bigIntItem, chatId: bigIntItem, channelId: bigIntItem })).toString()
      );
      if (result) {
        return result;
      }
    }
    throw new Error('No cached entity for the given key');
  }
}
