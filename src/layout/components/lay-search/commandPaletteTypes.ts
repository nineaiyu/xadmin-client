import type { Router } from "vue-router";
import type { ComputedRef, Ref, ShallowRef } from "vue";
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
  /** 「问 AI」条目可见性（有关键字且有 ask:AiAssistant 权限时为真） */
  askAiVisible: ComputedRef<boolean>;
  scrollTo: (index: number) => void;
  goGlobalResult: (group: GlobalSearchGroup) => void;
  /** 跳 AI 控制台并以当前关键字预填提问 */
  runAskAi: () => void;
  saveHistory: () => void;
  updateHistory: () => void;
  handleClose: () => void;
}
