<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { transformI18n } from "@/plugins/i18n";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import {
  nodeKind,
  splitHighlight,
  type PermissionNodeStatus,
  type PermissionTreeNode
} from "../utils/permissionTree";

defineOptions({ name: "PermissionNodeLabel" });

interface Props {
  /** 授权树节点（真实菜单节点或字段权限合成节点） */
  node: PermissionTreeNode;
  /** 菜单节点三态标识（合成节点为空） */
  status?: PermissionNodeStatus;
  /** 搜索关键词（用于标题高亮） */
  keyword?: string;
  /** 父子联动开关：独立勾选时顶级目录提供行内全选/取消入口 */
  linked?: boolean;
  /** 字段分组节点的勾选进度 */
  fieldStats?: { checked: number; total: number };
}

const props = withDefaults(defineProps<Props>(), {
  status: undefined,
  keyword: "",
  linked: true,
  fieldStats: undefined
});

const emit = defineEmits<{
  /** 字段分组：选中该分组全部字段 */
  selectSubtree: [];
  /** 字段分组：清空该分组字段 */
  clearSubtree: [];
}>();

const { t } = useI18n();

type TagType = "primary" | "success" | "warning" | "info";

const kind = computed(() => nodeKind(props.node));

/** 菜单图标（未配置图标时渲染空组件，不占位） */
const nodeIcon = computed(() =>
  useRenderIcon(String(props.node?.meta?.icon ?? ""))
);

/** 类型标签：目录/菜单/权限点/字段权限 */
const kindMeta = computed<{ text: string; type: TagType }>(() => {
  const map: Record<string, { text: string; type: TagType }> = {
    directory: { text: t("rolePermission.typeDirectory"), type: "info" },
    menu: { text: t("rolePermission.typeMenu"), type: "primary" },
    permission: { text: t("rolePermission.typePermission"), type: "success" },
    fieldGroup: { text: t("rolePermission.typeFieldGroup"), type: "warning" },
    field: { text: t("rolePermission.typeField"), type: "info" }
  };
  return map[kind.value];
});

const titleText = computed(() => {
  const raw = props.node?.meta?.title;
  return raw ? String(transformI18n(String(raw))) : "";
});

const titleSegments = computed(() =>
  splitHighlight(titleText.value, props.keyword)
);

/** 辅助文本：路由/权限码（菜单节点）或 标签 (字段名)（字段节点） */
const detailText = computed(() => {
  if (kind.value === "directory" || kind.value === "menu") {
    return props.node?.path ? String(props.node.path) : "";
  }
  if (kind.value === "permission") {
    return props.node?.name ? String(props.node.name) : "";
  }
  const label = props.node?.label ? String(props.node.label) : "";
  const name = props.node?.name ? String(props.node.name) : "";
  if (label && name) return t("rolePermission.labelWithName", { label, name });
  return label || name;
});

const statusMeta = computed<{ text: string; type: TagType } | null>(() => {
  if (!props.status) return null;
  const map: Record<PermissionNodeStatus, { text: string; type: TagType }> = {
    checked: { text: t("rolePermission.statusChecked"), type: "success" },
    partial: { text: t("rolePermission.statusPartial"), type: "warning" },
    unchecked: { text: t("rolePermission.statusUnchecked"), type: "info" }
  };
  return map[props.status];
});

/** 独立勾选模式下，仅顶级目录提供整棵子树的全选/取消（联动模式勾选父级即全选） */
const showRootActions = computed(
  () => !props.linked && kind.value === "directory"
);
</script>

<template>
  <span class="permission-node">
    <component :is="nodeIcon" class="permission-node__icon" />
    <span class="permission-node__title" :title="titleText">
      <template v-for="(segment, index) in titleSegments" :key="index">
        <mark v-if="segment.hit" class="permission-node__hit">
          {{ segment.text }}
        </mark>
        <template v-else>{{ segment.text }}</template>
      </template>
    </span>
    <el-tag size="small" effect="plain" :type="kindMeta.type">
      {{ kindMeta.text }}
    </el-tag>
    <span v-if="detailText" class="permission-node__detail" :title="detailText">
      {{ detailText }}
    </span>
    <el-tag
      v-if="statusMeta"
      size="small"
      effect="plain"
      :type="statusMeta.type"
      class="permission-node__status"
      :class="{ 'is-unchecked': status === 'unchecked' }"
      data-testid="permission-node-status"
    >
      {{ statusMeta.text }}
    </el-tag>
    <span
      v-else-if="fieldStats"
      class="permission-node__count"
      data-testid="permission-field-count"
    >
      {{
        t("rolePermission.fieldProgress", {
          checked: fieldStats.checked,
          total: fieldStats.total
        })
      }}
    </span>
    <span
      v-if="kind === 'fieldGroup' || showRootActions"
      class="permission-node__actions"
    >
      <el-button
        link
        type="success"
        size="small"
        @click.stop="emit('selectSubtree')"
      >
        {{ t("buttons.selectAll") }}
      </el-button>
      <el-button
        link
        type="warning"
        size="small"
        @click.stop="emit('clearSubtree')"
      >
        {{ t("buttons.unSelectAll") }}
      </el-button>
    </span>
  </span>
</template>

<style lang="scss" scoped>
.permission-node {
  display: flex;
  flex: 1;
  gap: 6px;
  align-items: center;
  min-width: 0;

  &__icon {
    flex-shrink: 0;
    width: 15px;
    height: 15px;
    color: var(--el-text-color-secondary);
  }

  &__title {
    max-width: 38%;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: var(--el-font-size-base);
    white-space: nowrap;
  }

  &__hit {
    padding: 0 1px;
    color: var(--el-color-danger);
    background: var(--el-color-danger-light-9);
    border-radius: var(--el-border-radius-small);
  }

  &__detail {
    max-width: 26%;
    overflow: hidden;
    text-overflow: ellipsis;
    font-family: var(--el-font-family-mono, monospace);
    font-size: var(--el-font-size-extra-small);
    color: var(--el-text-color-secondary);
    white-space: nowrap;
  }

  &__status {
    flex-shrink: 0;

    &.is-unchecked {
      opacity: 0.65;
    }
  }

  &__count {
    flex-shrink: 0;
    font-size: var(--el-font-size-extra-small);
    color: var(--el-text-color-secondary);
  }

  &__actions {
    flex-shrink: 0;
    margin-left: auto;
  }
}
</style>
