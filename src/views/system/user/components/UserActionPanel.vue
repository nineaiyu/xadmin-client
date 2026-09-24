<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { RecordType } from "plus-pro-components";
import { choiceValue } from "@/utils/dict";
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
</script>

<template>
  <div class="user-action-panel">
    <!-- 资料卡：列表行快照，零额外请求 -->
    <div class="profile-card">
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
          :style="item.color ? { border: 'none', color: '#fff' } : undefined"
        >
          {{ item.name }}
        </el-tag>
      </div>
    </div>

    <!-- 基础信息 -->
    <dl class="meta-grid">
      <div v-for="item in metaItems" :key="item.key" class="meta-item">
        <dt class="meta-label">{{ item.label }}</dt>
        <dd class="meta-value">{{ item.value }}</dd>
      </div>
    </dl>

    <!-- 动作分组：整行可点，危险动作红色语义 -->
    <div v-for="group in groups" :key="group.key" class="action-group">
      <div class="group-title">{{ group.title }}</div>
      <button
        v-for="action in group.actions"
        :key="action.code"
        type="button"
        class="action-item"
        :class="`action-item--${action.type ?? 'primary'}`"
        :disabled="action.disabled ? action.disabled(row) : false"
        :data-action-code="action.code"
        @click="action.run(row)"
      >
        <span class="action-icon">
          <el-icon><component :is="action.icon" /></el-icon>
        </span>
        <span class="min-w-0 flex-1">
          <span class="action-label">{{ action.label }}</span>
          <span v-if="action.description" class="action-desc">
            {{ action.description }}
          </span>
        </span>
      </button>
    </div>
  </div>
</template>

<style scoped lang="scss">
.user-action-panel {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 2px 2px 12px;
}

.profile-card {
  padding: 16px;
  background: var(--el-fill-color-light);
  border-radius: 10px;
}

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
  font-size: 16px;
  font-weight: 600;
  line-height: 22px;
  color: var(--el-text-color-primary);
  white-space: nowrap;
}

.profile-sub {
  font-size: 12px;
  line-height: 18px;
  color: var(--el-text-color-secondary);
}

.tag-caption {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}

.meta-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 16px;
  margin: 0;
}

.meta-item {
  min-width: 0;
}

.meta-label {
  font-size: 12px;
  line-height: 16px;
  color: var(--el-text-color-secondary);
}

.meta-value {
  margin: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 13px;
  line-height: 20px;
  color: var(--el-text-color-primary);
  white-space: nowrap;
}

.action-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.group-title {
  padding-left: 2px;
  font-size: 12px;
  line-height: 16px;
  color: var(--el-text-color-secondary);
}

.action-item {
  display: flex;
  gap: 12px;
  align-items: center;
  width: 100%;
  padding: 10px 12px;
  text-align: left;
  cursor: pointer;
  background: var(--el-bg-color);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  transition:
    background-color 0.2s,
    border-color 0.2s;

  &:hover:not(:disabled) {
    background: var(--el-fill-color-light);
    border-color: var(--el-color-primary-light-5);
  }

  &:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }
}

.action-icon {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  font-size: 16px;
  color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
  border-radius: 8px;
}

.action-label {
  display: block;
  font-size: 14px;
  line-height: 20px;
  color: var(--el-text-color-primary);
}

.action-desc {
  display: block;
  font-size: 12px;
  line-height: 16px;
  color: var(--el-text-color-secondary);
}

.action-item--warning {
  .action-icon {
    color: var(--el-color-warning);
    background: var(--el-color-warning-light-9);
  }
}

.action-item--danger {
  .action-icon {
    color: var(--el-color-danger);
    background: var(--el-color-danger-light-9);
  }

  .action-label {
    color: var(--el-color-danger);
  }
}
</style>
