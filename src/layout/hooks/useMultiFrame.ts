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

  return {
    setMap,
    getMap,
    delMap,
    MAP
  };
};
