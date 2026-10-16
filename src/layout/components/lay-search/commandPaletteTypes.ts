import type { Router } from "vue-router";
import type { Ref, ShallowRef } from "vue";
import type { GlobalSearchGroup } from "@/api/system/search";
import type { optionsItem } from "./types";

/** 命令面板依赖的搜索弹窗上下文（自 useCommandPalette.ts 抽出） */
export interface CommandPaletteOptions {
  t: (key: string) => string;
  router: Router;
  show: Ref<boolean>;
  keyword: Ref<string>;
  resultOptions: ShallowRef<optionsItem[]>;
  historyOptions: ShallowRef<optionsItem[]>;
  globalGroups: ShallowRef<GlobalSearchGroup[]>;
  activePath: Ref<string>;
  historyPath: Ref<string>;
  scrollTo: (index: number) => void;
  goGlobalResult: (group: GlobalSearchGroup) => void;
  saveHistory: () => void;
  updateHistory: () => void;
  handleClose: () => void;
}
