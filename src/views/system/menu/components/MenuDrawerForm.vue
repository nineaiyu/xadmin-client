<script lang="ts" setup>
import { computed, nextTick, provide, reactive, ref, watch } from "vue";
import { cloneDeep } from "@pureadmin/utils";
import { useI18n } from "vue-i18n";
import { MenuChoices } from "@/views/system/constants";
import {
  MENU_FORM_KEY,
  dirFormRules,
  menuFormRules,
  permissionFormRules,
  type MenuFormContext
} from "../utils/formContext";
import { menuTypeTagType } from "../utils/normalize";
import { displayTitle, translateTitle } from "../utils/useMenuFilter";
import Segmented, { type OptionsType } from "@/components/ReSegmented";
import MenuFormBasic from "./MenuFormBasic.vue";
import MenuFormNav from "./MenuFormNav.vue";
import MenuFormExtra from "./MenuFormExtra.vue";
import MenuFormPermission from "./MenuFormPermission.vue";
import type {
  MenuAuths,
  MenuChoiceItem,
  MenuFormModel,
  MenuRow,
  MenuUrlItem,
  ModelTreeItem
} from "../utils/types";

/**
 * 菜单新增/编辑抽屉内容：头部（类型/标题/面包屑/状态）+ 分组表单。
 *
 * 分组用 el-collapse：字段按语义分四组（基本信息 / 权限点 / 侧栏与标签 / 外链与高级），
 * 冷门配置不再与高频字段同级平铺。新增与编辑共用本组件（旧实现两套壳）。
 */

const props = withDefaults(
  defineProps<{
    model: MenuFormModel;
    isAdd?: boolean;
    auth?: MenuAuths;
    treeData?: MenuRow[];
    choicesDict?: Record<string, MenuChoiceItem[]>;
    modelList?: ModelTreeItem[];
    viewList?: Record<string, string>;
    menuUrlList?: MenuUrlItem[];
  }>(),
  {
    isAdd: false,
    auth: () => ({}),
    treeData: () => [],
    choicesDict: () => ({}),
    modelList: () => [],
    viewList: () => ({}),
    menuUrlList: () => []
  }
);

const { t } = useI18n();

/** 类型 → 校验规则（目录/菜单/权限点字段集不同） */
const rulesFor = (menuType: number) =>
  menuType === MenuChoices.PERMISSION
    ? permissionFormRules
    : menuType === MenuChoices.MENU
      ? menuFormRules
      : dirFormRules;

const form = reactive<MenuFormModel>(cloneDeep(props.model));
const initialSnapshot = JSON.stringify(props.model);
const formRef = ref();
const rules = ref(cloneDeep(rulesFor(props.model.menuType)));
const activeGroups = ref<string[]>(["basic"]);
const cascadeInactive = ref(false);

const disabled = computed(() => !props.auth?.partialUpdate);

const menuTypeChoices = computed<MenuChoiceItem[]>(() => {
  const list = props.choicesDict?.["menu_type"];
  return list?.length
    ? list
    : [
        { value: MenuChoices.DIRECTORY, label: t("systemMenu.directory") },
        { value: MenuChoices.MENU, label: t("systemMenu.menu") },
        { value: MenuChoices.PERMISSION, label: t("systemMenu.permissions") }
      ];
});

/** 类型分段选项：沿用项目 ReSegmented（激活态为深色文字 + 主色描边，满足 AA 对比度） */
const menuTypeOptions = computed<OptionsType[]>(() =>
  menuTypeChoices.value.map(item => ({
    label: String(item.label ?? ""),
    tip: String(item.label ?? ""),
    value: item.value,
    disabled: typeOptionDisabled(item.value)
  }))
);

/** 编辑态类型约束：权限点与页面菜单互不转换（后端语义差异大） */
const typeOptionDisabled = (value?: number | string) => {
  if (props.isAdd) return false;
  if (form.menuType === MenuChoices.PERMISSION) {
    return value !== MenuChoices.PERMISSION;
  }
  return value === MenuChoices.PERMISSION;
};

const treeRows = computed(() => props.treeData ?? []);
const treeIndex = computed(() => {
  const map = new Map<string, MenuRow>();
  const walk = (rows: MenuRow[]) =>
    rows.forEach(row => {
      map.set(String(row.pk), row);
      if (row.children.length) walk(row.children);
    });
  walk(treeRows.value);
  return map;
});

/** 自身与后代：上级节点候选中必须排除（避免父子成环） */
const selfAndDescendants = computed(() => {
  const set = new Set<string>();
  if (form.pk === undefined) return set;
  const walk = (row: MenuRow) => {
    set.add(String(row.pk));
    row.children.forEach(walk);
  };
  const node = treeIndex.value.get(String(form.pk));
  if (node) walk(node);
  return set;
});

const parentDisabled = (data: unknown) => {
  const row = data as MenuRow;
  return (
    row.menuType === MenuChoices.PERMISSION ||
    selfAndDescendants.value.has(String(row.pk))
  );
};

const parentChain = computed<MenuRow[]>(() => {
  if (form.parent === "" || form.parent === null) return [];
  const chain: MenuRow[] = [];
  let cursor = treeIndex.value.get(String(form.parent));
  const visited = new Set<string>();
  while (cursor && !visited.has(String(cursor.pk))) {
    visited.add(String(cursor.pk));
    chain.unshift(cursor);
    cursor =
      cursor.parent === null
        ? undefined
        : treeIndex.value.get(String(cursor.parent));
  }
  return chain;
});

const descendantCount = computed(() => {
  if (form.pk === undefined) return 0;
  return treeIndex.value.get(String(form.pk))?.descendantCount ?? 0;
});

const typeLabel = computed(
  () =>
    menuTypeChoices.value.find(item => item.value === form.menuType)?.label ??
    ""
);

const context = reactive({
  model: form,
  isAdd: props.isAdd,
  disabled: disabled.value,
  auth: props.auth,
  treeData: treeRows.value,
  parentChain,
  descendantCount,
  cascadeInactive,
  menuTypeChoices: menuTypeChoices.value,
  methodChoices: props.choicesDict?.["method"] ?? [],
  menuUrlList: props.menuUrlList ?? [],
  modelList: props.modelList ?? [],
  viewList: props.viewList ?? {}
}) as unknown as MenuFormContext;
provide(MENU_FORM_KEY, context);

watch(
  () => form.menuType,
  value => {
    rules.value = cloneDeep(rulesFor(value));
    nextTick(() => {
      formRef.value?.clearValidate([
        "title",
        "name",
        "path",
        "component",
        "method"
      ]);
    });
  }
);

const validate = (): Promise<boolean> =>
  formRef.value
    ?.validate()
    .then(() => true)
    .catch(() => false) ?? Promise.resolve(false);

/** 表单载荷（与全仓表单组件同契约名；返回深拷贝，调用方不再持有内部引用） */
const getPayload = (): MenuFormModel => cloneDeep(form);

/** 未保存变更：与打开时的快照比对（关闭/取消/切换节点三处拦截共用） */
const isDirty = () => JSON.stringify(form) !== initialSnapshot;

/** 停用目录时可选「连同子级一起停用」：返回需要一并停用的后代 pk */
const getCascadePks = (): Array<number | string> => {
  if (form.isActive || !cascadeInactive.value || form.pk === undefined)
    return [];
  const node = treeIndex.value.get(String(form.pk));
  if (!node) return [];
  const pks: Array<number | string> = [];
  const walk = (row: MenuRow) => {
    row.children.forEach(child => {
      pks.push(child.pk);
      walk(child);
    });
  };
  walk(node);
  return pks;
};

defineExpose({ validate, getPayload, isDirty, getCascadePks });
</script>

<template>
  <div class="menu-form">
    <div class="menu-form__head">
      <div class="menu-form__head-main">
        <el-tag
          :type="menuTypeTagType(form.menuType)"
          class="menu-form__tag"
          effect="light"
          size="small"
        >
          {{ typeLabel }}
        </el-tag>
        <span class="menu-form__head-title">
          {{
            form.title
              ? translateTitle(form.title)
              : t("systemMenu.verifyTitle")
          }}
        </span>
      </div>
      <el-switch
        v-model="form.isActive"
        :aria-label="t('labels.status')"
        :disabled="disabled"
      />
    </div>

    <el-breadcrumb
      v-if="parentChain.length"
      separator="/"
      class="menu-form__crumb"
    >
      <el-breadcrumb-item v-for="item in parentChain" :key="item.pk">
        {{ displayTitle(item) }}
      </el-breadcrumb-item>
    </el-breadcrumb>

    <el-alert
      v-if="!form.isActive && descendantCount > 0"
      :closable="false"
      show-icon
      type="warning"
      :title="t('systemMenu.inactiveDirectoryHint')"
    >
      <template #default>
        <el-checkbox v-model="cascadeInactive" :disabled="disabled">
          {{ t("systemMenu.cascadeInactive", { count: descendantCount }) }}
        </el-checkbox>
      </template>
    </el-alert>

    <el-form
      ref="formRef"
      :disabled="disabled"
      :model="form"
      :rules="rules"
      label-width="108px"
      @submit.prevent
    >
      <el-collapse v-model="activeGroups" class="menu-form__groups">
        <el-collapse-item name="basic" :title="t('systemMenu.group.basic')">
          <el-form-item :label="t('systemMenu.type')" prop="menuType">
            <Segmented v-model="form.menuType" :options="menuTypeOptions" />
          </el-form-item>
          <el-form-item :label="t('systemMenu.parentNode')">
            <el-tree-select
              v-model="form.parent"
              :data="treeRows"
              :default-expanded-keys="parentChain.map(item => item.pk)"
              :props="{
                children: 'children',
                label: (data: unknown) => displayTitle(data as MenuRow),
                disabled: parentDisabled
              }"
              check-strictly
              clearable
              filterable
              node-key="pk"
              style="width: 100%"
            />
          </el-form-item>
          <menu-form-basic />
        </el-collapse-item>

        <el-collapse-item
          v-if="form.menuType === MenuChoices.PERMISSION"
          name="permission"
          :title="t('systemMenu.group.permission')"
        >
          <menu-form-permission />
        </el-collapse-item>
        <template v-else>
          <el-collapse-item name="nav" :title="t('systemMenu.group.nav')">
            <menu-form-nav />
          </el-collapse-item>
          <el-collapse-item name="extra" :title="t('systemMenu.group.extra')">
            <menu-form-extra />
          </el-collapse-item>
        </template>
      </el-collapse>
    </el-form>
  </div>
</template>

<style lang="scss" scoped>
.menu-form {
  &__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-bottom: 12px;
    border-bottom: 1px dashed var(--el-border-color-lighter);
  }

  &__head-main {
    display: flex;
    gap: 8px;
    align-items: center;
    min-width: 0;
  }

  &__head-title {
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 15px;
    font-weight: 600;
    white-space: nowrap;
  }

  &__crumb {
    margin: 10px 0 4px;
  }

  /* el-tag 的 light 效果文字色取主题色（小字号白底对比不足）：覆写为 regular */
  &__tag {
    --el-tag-text-color: var(--el-text-color-regular);
  }

  &__groups {
    margin-top: 8px;
    border-top: none;
  }
}
</style>
