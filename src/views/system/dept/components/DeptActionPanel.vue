<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import {
  ReActionPanel,
  type PanelActionGroup
} from "@/components/ReActionPanel";
import { formatDateTime } from "@/utils";
import type { DeptActionGroup } from "../utils/deptActions";

defineOptions({ name: "DeptActionPanel" });

interface Props {
  /** 列表行数据（与表格同一份快照，不额外请求） */
  row: Record<string, unknown>;
  /** 动作分组（权限缺失的动作与空分组已在构建期剔除） */
  groups: DeptActionGroup[];
}

const props = defineProps<Props>();

const { t } = useI18n();

/** 行数据形态容错：标量/对象（{name|label|nickname}）/数组都收敛为文本 */
function toText(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) {
    const text = value.map(item => toText(item)).filter(item => item !== "—");
    return text.length ? text.join("、") : "—";
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const candidate =
      record.name ?? record.label ?? record.nickname ?? record.username;
    return candidate === undefined || candidate === null || candidate === ""
      ? "—"
      : String(candidate);
  }
  return String(value);
}

/** 对象数组字段（角色/管理员）取稳定键值，供标签行渲染 */
function toList(value: unknown): Array<{ key: string; name: string }> {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => {
    if (item && typeof item === "object") {
      const record = item as Record<string, unknown>;
      const name = record.label ?? record.name ?? record.nickname;
      return {
        key: String(record.pk ?? index),
        name:
          name === undefined || name === null
            ? String(record.pk ?? index)
            : String(name)
      };
    }
    return { key: String(index), name: String(item) };
  });
}

const displayName = computed(() =>
  toText(props.row.name) === "—" ? t("systemDept.dept") : String(props.row.name)
);

const avatarText = computed(() => String(displayName.value).slice(0, 1));

const roles = computed(() => toList(props.row.roles));
const managers = computed(() => toList(props.row.managers));

type StatusTagType = "primary" | "success" | "warning" | "danger" | "info";

/** 状态标签：启用状态 / 注册自动绑定 */
const statusTags = computed(() => {
  const result: Array<{ key: string; text: string; type: StatusTagType }> = [];
  const active = props.row.is_active;
  if (active !== undefined && active !== null) {
    result.push({
      key: "is_active",
      text: active ? t("systemUser.enabled") : t("systemUser.disabled"),
      type: active ? "success" : "danger"
    });
  }
  if (props.row.auto_bind) {
    result.push({
      key: "auto_bind",
      text: t("systemDept.auto_bind"),
      type: "primary"
    });
  }
  return result;
});

const userCount = computed(() => Number(props.row.user_count ?? 0));

const metaItems = computed(() => [
  { key: "code", label: t("systemDept.code"), value: toText(props.row.code) },
  {
    key: "parent",
    label: t("systemDept.parent"),
    value: toText(props.row.parent)
  },
  {
    key: "leader",
    label: t("permissionPreview.deptLeader"),
    value: toText(props.row.leader)
  },
  {
    key: "user_count",
    label: t("systemDept.user_count"),
    value: userCount.value ? String(userCount.value) : "—"
  },
  {
    key: "created_time",
    label: t("commonLabels.created_time"),
    value: formatDateTime(props.row.created_time) || "—"
  },
  {
    key: "description",
    label: t("commonLabels.description"),
    value: toText(props.row.description)
  }
]);

/**
 * 动作分组：本页的动作契约带行参数（`run(row)`），面板契约由调用方闭包绑定，
 * 故在此做一次收敛——行级可用性（disabled）同样绑定当前行。
 */
const panelGroups = computed<PanelActionGroup[]>(() =>
  props.groups.map(group => ({
    key: group.key,
    title: group.title,
    actions: group.actions.map(action => ({
      code: action.code,
      label: action.label,
      description: action.description,
      icon: action.icon,
      type: action.type,
      disabled: action.disabled
        ? () => Boolean(action.disabled?.(props.row))
        : undefined,
      run: () => action.run(props.row)
    }))
  }))
);
</script>

<template>
  <ReActionPanel :groups="panelGroups" :meta-items="metaItems">
    <!-- 资料卡：列表行快照，零额外请求 -->
    <template #profile>
      <div class="flex items-center gap-3">
        <div class="profile-badge">
          {{ avatarText }}
        </div>
        <div class="min-w-0 flex-1">
          <div class="profile-name">{{ displayName }}</div>
          <div class="profile-sub">{{ row.code || "—" }}</div>
        </div>
      </div>

      <div v-if="statusTags.length" class="mt-3 flex flex-wrap gap-1.5">
        <el-tag
          v-for="item in statusTags"
          :key="item.key"
          :type="item.type"
          size="small"
          effect="plain"
        >
          {{ item.text }}
        </el-tag>
      </div>

      <div
        v-if="managers.length"
        class="mt-2 flex flex-wrap items-center gap-1.5"
      >
        <span class="tag-caption">{{ t("systemDept.managers") }}</span>
        <el-tag v-for="item in managers" :key="item.key" size="small">
          {{ item.name }}
        </el-tag>
      </div>

      <div v-if="roles.length" class="mt-2 flex flex-wrap items-center gap-1.5">
        <span class="tag-caption">{{ t("systemDept.roles") }}</span>
        <el-tag v-for="item in roles" :key="item.key" size="small" type="info">
          {{ item.name }}
        </el-tag>
      </div>
    </template>
  </ReActionPanel>
</template>

<style scoped lang="scss">
/* 面板骨架（资料卡 / 基础信息 / 动作分组）由 ReActionPanel 提供，
   此处只保留部门页特有的徽标与文字层级样式。 */
.profile-badge {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  overflow: hidden;
  font-size: 20px;
  font-weight: 600;
  color: var(--el-color-primary);
  user-select: none;
  background: var(--el-color-primary-light-7);
  border-radius: 10px;
}

.profile-name {
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: var(--el-font-size-medium);
  font-weight: 600;
  line-height: 22px;
  color: var(--el-text-color-primary);
  white-space: nowrap;
}

.profile-sub {
  font-size: var(--el-font-size-extra-small);
  line-height: 18px;
  color: var(--el-text-color-secondary);
}

.tag-caption {
  font-size: var(--el-font-size-extra-small);
  color: var(--el-text-color-secondary);
}
</style>
