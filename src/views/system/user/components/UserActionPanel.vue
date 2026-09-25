<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { RecordType } from "plus-pro-components";
import {
  ReActionPanel,
  type PanelActionGroup
} from "@/components/ReActionPanel";
import { choiceValue } from "@/utils/dict";
import { SOLID_TAG_STYLE } from "@/utils/tagTone";
import { formatDateTime } from "@/utils";
import type { UserActionGroup } from "../utils/userActions";

defineOptions({ name: "UserActionPanel" });

interface Props {
  /** 列表行数据（与表格同一份快照，不额外请求） */
  row: RecordType;
  /** 动作分组（权限缺失的动作与空分组已在构建期剔除） */
  groups: UserActionGroup[];
}

const props = defineProps<Props>();

const { t } = useI18n();

/** 行数据形态容错：标量/对象（{name|label|username}）/数组都收敛为文本 */
function toText(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) {
    const text = value.map(item => toText(item)).filter(item => item !== "—");
    return text.length ? text.join("、") : "—";
  }
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const candidate =
      record.name ?? record.label ?? record.username ?? record.nickname;
    return candidate === undefined || candidate === null || candidate === ""
      ? "—"
      : String(candidate);
  }
  return String(value);
}

/** 对象数组字段（角色/标签）取稳定键值，供标签行渲染 */
function toList(
  value: unknown
): Array<{ key: string; name: string; color?: string }> {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => {
    if (item && typeof item === "object") {
      const record = item as Record<string, unknown>;
      const name = record.name ?? record.label ?? record.username;
      return {
        key: String(record.pk ?? record.value ?? index),
        name:
          name === undefined || name === null
            ? String(record.pk ?? index)
            : String(name),
        color: typeof record.color === "string" ? record.color : undefined
      };
    }
    return { key: String(index), name: String(item) };
  });
}

const displayName = computed(
  () => props.row.nickname || props.row.username || t("systemUser.user")
);

const avatarText = computed(() => String(displayName.value).slice(0, 1));

const roles = computed(() => toList(props.row.roles));
const tags = computed(() => toList(props.row.tags));

type StatusTagType = "primary" | "success" | "warning" | "danger" | "info";

/** 状态标签：启用状态 / 锁定 / 在线会话 / 邀请状态 */
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
  if (props.row.block) {
    result.push({ key: "block", text: t("systemUser.locked"), type: "danger" });
  }
  const online = Number(props.row.online_count ?? 0);
  if (online > 0) {
    result.push({
      key: "online",
      text: t("systemUser.onlineSessions", { count: online }),
      type: "primary"
    });
  }
  const invite = choiceValue(props.row.invite_status);
  if (invite) {
    result.push({
      key: "invite",
      text:
        props.row.invite_status?.label ??
        t(
          invite === "pending"
            ? "systemUser.invitePending"
            : "systemUser.inviteAccepted"
        ),
      type: invite === "pending" ? "warning" : "success"
    });
  }
  return result;
});

const metaItems = computed(() => [
  { key: "dept", label: t("systemUser.dept"), value: toText(props.row.dept) },
  {
    key: "phone",
    label: t("systemUser.phone"),
    value: toText(props.row.phone)
  },
  {
    key: "email",
    label: t("systemUser.email"),
    value: toText(props.row.email)
  },
  {
    key: "date_joined",
    label: t("systemUser.date_joined"),
    value: formatDateTime(props.row.date_joined) || "—"
  },
  {
    key: "last_login",
    label: t("systemUser.last_login"),
    value: formatDateTime(props.row.last_login) || "—"
  },
  {
    key: "date_expired",
    label: t("systemUser.dateExpired"),
    value: formatDateTime(props.row.date_expired) || "—"
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
        <el-image
          v-if="row.avatar"
          :src="row.avatar"
          :preview-src-list="[row.avatar]"
          preview-teleported
          fit="cover"
          class="profile-avatar"
          :alt="t('systemUser.avatarAlt')"
        />
        <div v-else class="profile-avatar profile-avatar--empty">
          {{ avatarText }}
        </div>
        <div class="min-w-0 flex-1">
          <div class="profile-name">{{ displayName }}</div>
          <div class="profile-sub">@{{ row.username }}</div>
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

      <div v-if="roles.length" class="mt-2 flex flex-wrap items-center gap-1.5">
        <span class="tag-caption">{{ t("systemUser.roles") }}</span>
        <el-tag v-for="item in roles" :key="item.key" size="small">
          {{ item.name }}
        </el-tag>
      </div>

      <div v-if="tags.length" class="mt-2 flex flex-wrap items-center gap-1.5">
        <span class="tag-caption">{{ t("systemUser.tags") }}</span>
        <el-tag
          v-for="item in tags"
          :key="item.key"
          size="small"
          :color="item.color || undefined"
          :style="item.color ? SOLID_TAG_STYLE : undefined"
        >
          {{ item.name }}
        </el-tag>
      </div>
    </template>
  </ReActionPanel>
</template>

<style scoped lang="scss">
/* 面板骨架（资料卡 / 基础信息 / 动作分组）由 ReActionPanel 提供，
   此处只保留用户页特有的头像与文字层级样式。 */
.profile-avatar {
  flex-shrink: 0;
  width: 56px;
  height: 56px;
  overflow: hidden;
  border-radius: 50%;
}

.profile-avatar--empty {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  font-weight: 600;
  color: var(--el-color-primary);
  user-select: none;
  background: var(--el-color-primary-light-7);
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
