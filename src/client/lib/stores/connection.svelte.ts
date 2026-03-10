import { wsClient } from "../ws";

let connected = $state(false);
let unsubStatus: (() => void) | null = null;

export const connectionStore = {
  get connected() {
    return connected;
  },

  init() {
    unsubStatus = wsClient.onStatusChange((value) => {
      connected = value;
    });

    wsClient.listen();
    wsClient.connect();
  },

  destroy() {
    unsubStatus?.();
    unsubStatus = null;
  },
};
