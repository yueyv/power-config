import { defineStore } from 'pinia';

export const useLogStore = defineStore('log', {
  state: () => ({
    logs: [] as string[],
  }),
  actions: {
    addLog(log: string) {
      this.logs.push(log);
    },
  },
});
