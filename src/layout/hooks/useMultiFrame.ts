const MAP = new Map<string, unknown>();

export const useMultiFrame = () => {
  function setMap(path: string, Comp: unknown) {
    MAP.set(path, Comp);
  }

  function getMap(path?: string) {
    if (path) {
      return MAP.get(path);
    }
    return [...MAP.entries()];
  }

  function delMap(path: string) {
    MAP.delete(path);
  }

  /** 全清：登出/切换账号时调用，避免 iframe 缓存跨会话驻留 */
  function clearMap() {
    MAP.clear();
  }

  return {
    setMap,
    getMap,
    delMap,
    clearMap,
    MAP
  };
};
