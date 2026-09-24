<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import ReTreeLine from "@/components/ReTreeLine";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { MenuChoices } from "@/views/system/constants";
import { displayTitle } from "../utils/useMenuFilter";
import { menuTypeTagType, rowPathText } from "../utils/normalize";
import { buildNodeActions, type MenuActionContext } from "../utils/menuActions";
import type { MenuAuths, MenuNodeAction, MenuRow } from "../utils/types";

import DocumentAdd from "~icons/ep/document-add";
import EditPen from "~icons/ep/edit-pen";
import More2Fill from "~icons/ri/more-2-fill";

/**
 * 菜单树行：类型标签 + 名称 + 次要信息（路由/权限码）+ 后代计数 + 状态与操作区。
 *
 * - 类型用标签表达（不再整行变色），停用行整体降饱和而非红色告警色；
 * - 行内操作默认隐藏、hover/聚焦显现（键盘 Tab 可达，均带 aria-label）；
 * - 操作清单与右键菜单共用 `buildNodeActions`，两个入口不会漂移。
 */

const props = withDefaults(
  defineProps<{
    /** el-tree 节点实例（ReTreeLine 需要其 level/parent 结构） */
    node: unknown;
    data: MenuRow;
    keyword?: string;
    auth?: MenuAuths;
    busy?: boolean;
  }>(),
  { keyword: "", auth: () => ({}), busy: false }
);

/** ReTreeLine 的节点入参为 tree-v2 的 TreeNode 结构，与 el-tree 实例同构，此处按边界收窄 */
const lineNode = computed(() => props.node as never);

const emit = defineEmits<{
  "toggle-active": [row: MenuRow, value: boolean];
  action: [code: string, row: MenuRow];
  contextmenu: [event: MouseEvent, row: MenuRow];
}>();

const { t } = useI18n();

const isPermission = computed(
  () => props.data.menuType === MenuChoices.PERMISSION
);

const typeLabel = computed(() =>
  props.data.menuType === MenuChoices.DIRECTORY
    ? t("systemMenu.directory")
    : props.data.menuType === MenuChoices.MENU
      ? t("systemMenu.menu")
      : t("systemMenu.permissions")
);

const pathText = computed(() => rowPathText(props.data));
const canAddChild = computed(
  () => Boolean(props.auth?.create) && !isPermission.value
);

/** 菜单标题可能是词条 key（menus.xxx）：展示层统一走 displayTitle */
const titleText = computed(() => displayTitle(props.data));

/** 关键字高亮：按首个命中位置切分标题（大小写不敏感） */
const titleSegments = computed(() => {
  const title = titleText.value;
  const keyword = props.keyword.trim();
  if (!keyword) return [{ text: title, hit: false }];
  const index = title.toLocaleLowerCase().indexOf(keyword.toLocaleLowerCase());
  if (index < 0) return [{ text: title, hit: false }];
  return [
    { text: title.slice(0, index), hit: false },
    { text: title.slice(index, index + keyword.length), hit: true },
    { text: title.slice(index + keyword.length), hit: false }
  ].filter(segment => segment.text);
});

/** 行操作清单（computed 惰性求值：下拉展开时才构建） */
const nodeActions = computed<MenuNodeAction[]>(() => {
  const ctx: MenuActionContext = {
    t,
    auth: props.auth ?? {},
    openEdit: () => emit("action", "edit", props.data),
    openCreate: () => emit("action", "addChild", props.data),
    openPermission: () => emit("action", "permissions", props.data),
    openRename: () => emit("action", "rename", props.data),
    openClone: () => emit("action", "clone", props.data),
    remove: () => emit("action", "delete", props.data),
    move: (_row, direction) => emit("action", `move:${direction}`, props.data),
    toggleActive: () => emit("toggle-active", props.data, !props.data.isActive)
  };
  return buildNodeActions(props.data, ctx);
});

const onSwitch = (value: boolean | string | number) => {
  emit("toggle-active", props.data, Boolean(value));
};
</script>

<template>
  <div
    class="menu-row"
    :class="{ 'is-inactive': !data.isActive }"
    @contextmenu.prevent.stop="emit('contextmenu', $event, data)"
  >
    <ReTreeLine :indent="18" :node="lineNode" :showLabelLine="false">
      <template #node-label>
        <span class="menu-row__label">
          <component
            :is="useRenderIcon(data.meta.icon)"
            v-if="data.meta.icon"
            class="menu-row__icon"
          />
          <span class="menu-row__title" :title="titleText">
            <span
              v-for="(segment, index) in titleSegments"
              :key="index"
              :class="{ 'menu-row__hit': segment.hit }"
            >
              {{ segment.text }}
            </span>
          </span>
          <span
            :class="data.isActive ? 'is-on' : 'is-off'"
            :title="
              data.isActive
                ? t('systemMenu.filter.active')
                : t('systemMenu.filter.inactive')
            "
            class="menu-row__dot"
          />
          <el-tag
            :type="menuTypeTagType(data.menuType)"
            class="menu-row__tag"
            effect="light"
            size="small"
          >
            {{ typeLabel }}
          </el-tag>
        </span>
      </template>
    </ReTreeLine>

    <span class="menu-row__right">
      <span
        v-if="data.descendantCount"
        class="menu-row__count"
        :title="
          t('systemMenu.countDescendants', {
            count: data.descendantCount,
            inactive: data.inactiveDescendantCount
          })
        "
      >
        {{
          t("systemMenu.countDescendantsShort", { count: data.descendantCount })
        }}
      </span>
      <span class="menu-row__path">{{ pathText }}</span>
      <span class="menu-row__actions">
        <el-switch
          :aria-label="t('labels.status')"
          :loading="busy"
          :model-value="data.isActive"
          size="small"
          @change="onSwitch"
          @click.stop
        />
        <el-tooltip
          v-if="canAddChild"
          :content="t('systemMenu.action.addChild')"
          placement="top"
        >
          <el-button
            :aria-label="t('systemMenu.action.addChild')"
            :icon="useRenderIcon(DocumentAdd)"
            link
            size="small"
            @click.stop="emit('action', 'addChild', data)"
          />
        </el-tooltip>
        <el-tooltip
          v-if="auth.partialUpdate"
          :content="t('buttons.edit')"
          placement="top"
        >
          <el-button
            :aria-label="t('buttons.edit')"
            :icon="useRenderIcon(EditPen)"
            link
            size="small"
            @click.stop="emit('action', 'edit', data)"
          />
        </el-tooltip>
        <el-dropdown
          trigger="click"
          popper-class="menu-row-popper"
          @command="(code: string) => emit('action', code, data)"
        >
          <el-button
            :aria-label="t('layout.more')"
            :icon="useRenderIcon(More2Fill)"
            link
            size="small"
            @click.stop
          />
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item
                v-for="item in nodeActions"
                :key="item.code"
                :command="item.code"
                :disabled="item.disabled"
                :divided="item.divided"
                :class="{ 'menu-row__danger': item.danger }"
              >
                <el-icon><component :is="item.icon" /></el-icon>
                {{ item.label }}
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </span>
    </span>
  </div>
</template>

<style lang="scss" scoped>
.menu-row {
  display: flex;
  flex: 1;
  align-items: center;
  min-width: 0;

  /* 停用态：仅对非文本内容（图标）降饱和——整行透明度会把正文压到 AA 以下 */
  &.is-inactive .menu-row__icon {
    opacity: 0.45;
  }

  &__label {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    padding-right: 4px;
  }

  &__icon {
    margin-right: 2px;
  }

  &__title {
    max-width: 320px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__hit {
    color: var(--el-color-danger);
    background: var(--el-color-warning-light-9);
    border-radius: 2px;
  }

  &__right {
    display: inline-flex;
    gap: 10px;
    align-items: center;
    margin-right: 10px;
    margin-left: auto;
  }

  &__count {
    padding: 0 6px;
    font-size: 12px;
    color: var(--el-text-color-regular);
    background: var(--el-fill-color-light);
    border-radius: 9px;
  }

  /* el-tag 的 light 效果文字色取主题色（12px 下白底对比不足）：统一覆写为 regular */
  &__tag {
    --el-tag-text-color: var(--el-text-color-regular);
  }

  &__dot {
    flex-shrink: 0;
    width: 6px;
    height: 6px;
    border-radius: 50%;

    &.is-on {
      background: var(--el-color-success);
    }

    &.is-off {
      background: var(--el-text-color-placeholder);
    }
  }

  &__path {
    max-width: 320px;
    overflow: hidden;
    text-overflow: ellipsis;
    font-family: var(--el-font-family-mono, monospace);
    font-size: 12px;

    /* 小字号需 AA 对比度：secondary 在白底仅 3:1，改 regular 并靠字号/等宽维持层级 */
    color: var(--el-text-color-regular);
    white-space: nowrap;
  }

  &__actions {
    display: inline-flex;
    gap: 2px;
    align-items: center;
    opacity: 0;
    transition: opacity 0.15s ease;
  }

  &:hover &__actions,
  &:focus-within &__actions {
    opacity: 1;
  }
}

.menu-row__danger {
  color: var(--el-color-danger);
}
</style>

<!-- 下拉菜单 teleport 到 body：危险色样式必须放在非 scoped 块，否则选择器命不中 -->
<style lang="scss">
.menu-row-popper .menu-row__danger {
  color: var(--el-color-danger);
}
</style>
