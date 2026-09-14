<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import { FormProps } from "../utils/types";
import { computed, nextTick, ref, watch } from "vue";
import { cloneDeep } from "@pureadmin/utils";
import { transformI18n } from "@/plugins/i18n";
import { MenuChoices } from "@/views/system/constants";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import Segmented, { type OptionsType } from "@/components/ReSegmented";
import {
  dirFormRules,
  menuFormRules,
  permissionFormRules
} from "../utils/rule";
import MenuBasicFields from "./MenuBasicFields.vue";
import MenuPermissionFields from "./MenuPermissionFields.vue";

/**
 * 菜单新增/编辑表单（拆分自 553 行单体）：
 * 类型切换与父节点选择留在本组件，目录/菜单字段区见 MenuBasicFields.vue，
 * 权限码字段区见 MenuPermissionFields.vue（均就地修改 formInline）。
 */

const { t } = useI18n();

const emit = defineEmits(["handleConfirm"]);

const props = withDefaults(defineProps<FormProps>(), {
  treeData: () => [],
  methodChoices: () => [],
  modelList: () => [],
  menuChoices: () => [],
  menuUrlList: () => [],
  viewList: () => ({}),
  auth: () => ({}),
  formInline: () => ({
    menu_type: MenuChoices.DIRECTORY,
    isAdd: false,
    parent: "",
    parent_ids: [],
    name: "",
    path: "",
    rank: 0,
    component: "",
    method: "",
    model: [],
    is_active: true,
    meta: {
      title: "",
      icon: "",
      r_svg_name: "",
      is_show_menu: true,
      is_show_parent: false,
      is_keepalive: true,
      frame_url: "",
      frame_loading: false,
      transition_enter: "",
      transition_leave: "",
      is_hidden_tag: false,
      fixed_tag: false,
      dynamic_level: 0
    }
  })
});

const ruleFormRef = ref();
const treeSelectRef = ref();
const newFormInline = ref(props.formInline);

const ifEnableOptions: Array<OptionsType> = [
  {
    label: t("labels.enable"),
    tip: t("labels.enable"),
    value: true
  },
  {
    label: t("labels.disable"),
    tip: t("labels.disable"),
    value: false
  }
];

function getRef() {
  return ruleFormRef.value;
}

const formRules = ref(cloneDeep(dirFormRules));

watch(
  () => newFormInline.value.menu_type,
  () => {
    handleChangeMenuType(newFormInline.value.menu_type);
  }
);

const onChange = ({ option }) => {
  const { key } = option;
  handleChangeMenuType(key);
};

const handleChangeMenuType = menu_type => {
  // 用 nextTick 替代 30ms 定时器：等表单按新规则渲染完成后再清校验，避免时序竞态
  nextTick(() => {
    ruleFormRef.value?.clearValidate([
      "menu_type",
      "title",
      "rank",
      "path",
      "perms"
    ]);
  });

  if (menu_type === MenuChoices.DIRECTORY) {
    formRules.value = dirFormRules;
  } else if (menu_type === MenuChoices.MENU) {
    formRules.value = menuFormRules;
  } else {
    formRules.value = permissionFormRules;
  }
};

const getMinHeight = () => {
  if (!newFormInline.value.isAdd) {
    return `calc(100vh - 145px)`;
  }
  return "";
};

const menuOptions = computed<Array<OptionsType>>(() => {
  const data = cloneDeep(props.menuChoices);
  data.forEach(item => {
    if (!newFormInline.value.isAdd) {
      if (newFormInline.value.menu_type === MenuChoices.PERMISSION) {
        item.disabled = item.value !== MenuChoices.PERMISSION;
      } else {
        item.disabled = item.value === MenuChoices.PERMISSION;
      }
    }
  });
  return data;
});

defineExpose({ getRef });
</script>

<template>
  <div
    :style="{ minHeight: getMinHeight() }"
    class="h-full bg-bg_color overflow-auto"
  >
    <el-form
      ref="ruleFormRef"
      :disabled="!auth.partialUpdate"
      :model="newFormInline"
      :rules="formRules"
      class="search-form bg-bg_color w-[90%] pl-8 pt-3"
      label-width="120px"
    >
      <el-form-item :label="t('systemMenu.type')" prop="menu_type">
        <Segmented
          v-model="newFormInline.menu_type"
          :options="menuOptions"
          @change="onChange"
        />
      </el-form-item>
      <el-form-item :label="t('systemMenu.parentNode')" prop="parentId">
        <el-tree-select
          ref="treeSelectRef"
          v-model="newFormInline.parent"
          :data="props.treeData"
          :default-expanded-keys="newFormInline.parent_ids"
          :props="{
            children: 'children',
            label: data => transformI18n(data.meta.title),
            disabled: data => data.menu_type == MenuChoices.PERMISSION
          }"
          accordion
          auto-expand-parent
          check-strictly
          clearable
          filterable
          node-key="pk"
          show-checkbox
          style="width: 100%"
        >
          <template #default="{ data }">
            <div style="height: 30px">
              <span
                :class="[
                  'pr-1',
                  'rounded-sm',
                  'flex',
                  'items-center',
                  'select-none'
                ]"
              >
                <component :is="useRenderIcon(data.meta.icon)" class="m-1" />
                {{ `${transformI18n(data.meta.title)}` }}</span
              >
            </div>
          </template>
        </el-tree-select>
      </el-form-item>

      <menu-basic-fields
        :if-enable-options="ifEnableOptions"
        :new-form-inline="newFormInline"
        :view-list="viewList"
      />

      <menu-permission-fields
        :if-enable-options="ifEnableOptions"
        :menu-url-list="menuUrlList"
        :method-choices="methodChoices"
        :model-list="modelList"
        :new-form-inline="newFormInline"
      />

      <el-form-item
        v-if="auth.partialUpdate && !newFormInline.isAdd && newFormInline.pk"
        class="flex float-right"
      >
        <el-popconfirm
          :title="t('buttons.confirmUpdate')"
          @confirm="emit('handleConfirm', ruleFormRef, newFormInline)"
        >
          <template #reference>
            <el-button
              :disabled="newFormInline.isAdd || !newFormInline.pk"
              plain
              type="danger"
              >{{ t("buttons.update") }}
            </el-button>
          </template>
        </el-popconfirm>
      </el-form-item>
    </el-form>
  </div>
</template>
