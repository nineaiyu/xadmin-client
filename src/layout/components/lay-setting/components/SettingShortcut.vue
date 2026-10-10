<script lang="ts" setup>
// 系统设置面板「快捷键」：总开关 + 每动作键位录制（键位存小写组合串，空串 = 未启用）。
// 历史存储里的布尔开关（shortcutLock 等）作为键位缺失时的兼容输入，见 utils/shortcutKeys。
import { computed } from "vue";
import { useGlobal } from "@pureadmin/utils";
import { useNav } from "@/layout/hooks/useNav";
import {
  parseShortcut,
  resolveShortcutKeys,
  sameShortcut
} from "@/utils/shortcutKeys";
import { useConfigureStorage } from "../hooks/useConfigureStorage";
import PrefBlock from "./PrefBlock.vue";
import PrefRow from "./PrefRow.vue";
import ShortcutInput from "./ShortcutInput.vue";

import KeyboardLine from "~icons/ri/keyboard-line";

const { t } = useNav();
const { $storage } = useGlobal<GlobalPropertiesApi>();
const { storageConfigureChange } = useConfigureStorage();

/** 快捷键总开关：关闭后键位自定义全部失效（顶栏按钮不受影响） */
const shortcutEnable = computed({
  get: () => $storage?.configure?.shortcutEnable ?? true,
  set: value => storageConfigureChange("shortcutEnable", value)
});

interface ShortcutAction {
  keysKey:
    | "shortcutLockKeys"
    | "shortcutSidebarKeys"
    | "shortcutSearchKeys"
    | "shortcutPreferencesKeys"
    | "shortcutLogoutKeys";
  /** 兼容用历史布尔开关：键位串缺失时以它为据（false = 不启用） */
  legacyKey: "shortcutLock" | "shortcutSidebar" | "shortcutSearch" | "";
  fallback: string;
  labelKey: string;
  tipKey: string;
}

const ACTIONS: ShortcutAction[] = [
  {
    keysKey: "shortcutLockKeys",
    legacyKey: "shortcutLock",
    fallback: "alt+l",
    labelKey: "layout.shortcutLock",
    tipKey: "layout.shortcutLockTip"
  },
  {
    keysKey: "shortcutSidebarKeys",
    legacyKey: "shortcutSidebar",
    fallback: "alt+s",
    labelKey: "layout.shortcutSidebar",
    tipKey: "layout.shortcutSidebarTip"
  },
  {
    keysKey: "shortcutSearchKeys",
    legacyKey: "shortcutSearch",
    fallback: "mod+k",
    labelKey: "layout.shortcutSearch",
    tipKey: "layout.shortcutSearchTip"
  },
  {
    keysKey: "shortcutPreferencesKeys",
    legacyKey: "",
    fallback: "mod+,",
    labelKey: "layout.shortcutPreferences",
    tipKey: "layout.shortcutPreferencesTip"
  },
  {
    keysKey: "shortcutLogoutKeys",
    legacyKey: "",
    fallback: "",
    labelKey: "layout.shortcutLogout",
    tipKey: "layout.shortcutLogoutTip"
  }
];

const valueOf = (action: ShortcutAction) =>
  resolveShortcutKeys(
    $storage?.configure?.[action.keysKey],
    action.legacyKey ? $storage?.configure?.[action.legacyKey] : undefined,
    action.fallback
  );

/** 冲突校验：键位与其它动作重复时拒绝保存（空键位 = 不启用，不参与占用） */
const validate = (keysKey: ShortcutAction["keysKey"], value: string) => {
  if (!value || !parseShortcut(value)) return null;
  const conflict = ACTIONS.some(action => {
    if (action.keysKey === keysKey) return false;
    const other = valueOf(action);
    return Boolean(other) && sameShortcut(other, value);
  });
  return conflict ? t("layout.shortcutConflict") : null;
};
</script>

<template>
  <PrefBlock :title="t('layout.shortcut')" :icon="KeyboardLine" list flush>
    <PrefRow
      :label="t('layout.shortcutEnable')"
      :tip="t('layout.shortcutEnableTip')"
    >
      <template #control>
        <el-switch
          v-model="shortcutEnable"
          :active-text="t('labels.active')"
          :inactive-text="t('labels.inactive')"
          inline-prompt
        />
      </template>
    </PrefRow>
    <PrefRow
      v-for="action in ACTIONS"
      :key="action.keysKey"
      :label="t(action.labelKey)"
      :tip="t(action.tipKey)"
      :disabled="!shortcutEnable"
    >
      <template #control>
        <ShortcutInput
          :model-value="valueOf(action)"
          :disabled="!shortcutEnable"
          :validate="value => validate(action.keysKey, value)"
          @update:model-value="
            value => storageConfigureChange(action.keysKey, value)
          "
        />
      </template>
    </PrefRow>
  </PrefBlock>
</template>
