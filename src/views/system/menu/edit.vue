<script lang="ts" setup>
import { computed, ref, watch } from "vue";
import { FormProps } from "./utils/types";
import FromQuestion from "@/components/FromQuestion/index.vue";
import ReAnimateSelector from "@/components/ReAnimateSelector";
import { IconSelect } from "@/components/ReIcon";

import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { transformI18n } from "@/plugins/i18n";
import { dirFormRules, menuFormRules, permissionFormRules } from "./utils/rule";
import { hasAuth } from "@/router/utils";
import { cloneDeep } from "@pureadmin/utils";
import { useI18n } from "vue-i18n";
import { MenuChoices } from "@/views/system/constants";
import Segmented, { type OptionsType } from "@/components/ReSegmented";

const { t } = useI18n();
const emit = defineEmits(["handleConfirm"]);
const props = withDefaults(defineProps<FormProps>(), {
  treeData: () => [],
  choicesDict: () => [],
  modelList: () => [],
  menuChoices: () => [],
  menuUrlList: () => [],
  formInline: () => ({
    menu_type: MenuChoices.DIRECTORY,
    is_add: false,
    parent: "",
    parent_ids: [],
    name: "",
    path: "",
    rank: 0,
    component: "",
    model: [],
    is_active: true,
    meta: {
      title: "",
      icon: "",
      r_svg_name: "",
      is_show_menu: true,
      is_show_parent: false,
      is_keepalive: false,
      frame_url: "",
      frame_loading: false,
      transition_enter: "",
      transition_leave: "",
      is_hidden_tag: false,
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
  setTimeout(function () {
    ruleFormRef.value!.clearValidate([
      "menu_type",
      "title",
      "rank",
      "path",
      "perms"
    ]);
  }, 30);

  if (menu_type === MenuChoices.DIRECTORY) {
    formRules.value = dirFormRules;
  } else if (menu_type === MenuChoices.MENU) {
    formRules.value = menuFormRules;
  } else {
    formRules.value = permissionFormRules;
  }
};

defineExpose({ getRef });

const getMinHeight = () => {
  if (!newFormInline.value.is_add) {
    return `calc(100vh - 145px)`;
  }
  return "";
};

const menuOptions = computed<Array<OptionsType>>(() => {
  const data = cloneDeep(props.menuChoices);
  data.forEach(item => {
    item.value = item.key;
    if (!newFormInline.value.is_add) {
      if (newFormInline.value.menu_type === MenuChoices.PERMISSION) {
        item.disabled = item.key !== MenuChoices.PERMISSION;
      } else {
        item.disabled = item.key === MenuChoices.PERMISSION;
      }
    }
  });
  return data;
});
</script>

<template>
  <div
    :style="{ minHeight: getMinHeight() }"
    class="h-full bg-bg_color overflow-auto"
  >
    <el-form
      ref="ruleFormRef"
      :disabled="!hasAuth('update:systemMenu')"
      :model="newFormInline"
      :rules="formRules"
      class="search-form bg-bg_color w-[90%] pl-8 pt-[12px]"
      label-width="160px"
    >
      <el-form-item :label="t('menu.type')" prop="menu_type">
        <Segmented
          v-model="newFormInline.menu_type"
          :options="menuOptions"
          @change="onChange"
        />
      </el-form-item>
      <el-form-item :label="t('menu.parentNode')" prop="parentId">
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
                  'rounded',
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
      <div v-if="newFormInline.menu_type !== MenuChoices.PERMISSION">
        <el-form-item :label="t('menu.title')" prop="title">
          <el-input
            v-model="newFormInline.title"
            :placeholder="t('menu.verifyTitle')"
            clearable
          />
        </el-form-item>
        <el-form-item :label="t('menu.icon')" prop="icon">
          <icon-select v-model="newFormInline.meta.icon" />
        </el-form-item>
        <div v-if="newFormInline.menu_type === MenuChoices.MENU">
          <el-form-item :label="t('menu.transitionEnter')" prop="icon">
            <ReAnimateSelector v-model="newFormInline.meta.transition_enter" />
          </el-form-item>

          <el-form-item :label="t('menu.transitionLeave')" prop="icon">
            <ReAnimateSelector
              v-model="newFormInline.meta.transition_leave"
              :disabled="!newFormInline.meta.transition_enter"
            />
          </el-form-item>
        </div>
        <el-form-item :label="t('menu.componentName')" prop="name">
          <template #label>
            <from-question
              :description="t('menu.exampleComponentName')"
              :label="t('menu.componentName')"
            />
          </template>
          <el-input
            v-model="newFormInline.name"
            :placeholder="t('menu.componentName')"
            clearable
          />
        </el-form-item>
        <el-form-item :label="t('menu.routePath')" prop="path">
          <template #label>
            <from-question
              :description="t('menu.exampleRoutePath')"
              :label="t('menu.routePath')"
            />
          </template>
          <el-input
            v-model="newFormInline.path"
            :placeholder="t('menu.verifyPath')"
            clearable
          />
        </el-form-item>
      </div>
      <div v-if="newFormInline.menu_type === MenuChoices.MENU">
        <el-form-item :label="t('menu.componentPath')" prop="component">
          <template #label>
            <from-question
              :description="t('menu.exampleComponentPath')"
              :label="t('menu.componentPath')"
            />
          </template>
          <el-input
            v-model="newFormInline.component"
            :placeholder="t('menu.verifyComponentPath')"
            clearable
          />
        </el-form-item>

        <el-divider />
        <el-form-item :label="t('menu.cache')" prop="keepAlive">
          <template #label>
            <from-question
              :description="t('menu.exampleCache')"
              :label="t('menu.cache')"
            />
          </template>
          <Segmented
            :modelValue="newFormInline.meta.is_keepalive ? 0 : 1"
            :options="ifEnableOptions"
            @change="
              ({ option: { value } }) => {
                newFormInline.meta.is_keepalive = value;
              }
            "
          />
        </el-form-item>
        <el-form-item :label="t('menu.showParentMenu')" prop="showParent">
          <Segmented
            :modelValue="newFormInline.meta.is_show_parent ? 0 : 1"
            :options="ifEnableOptions"
            @change="
              ({ option: { value } }) => {
                newFormInline.meta.is_show_parent = value;
              }
            "
          />
        </el-form-item>
      </div>
      <div v-if="newFormInline.menu_type !== MenuChoices.PERMISSION">
        <el-divider />
        <el-form-item :label="t('menu.showLink')" prop="showLink">
          <template #label>
            <from-question
              :description="t('menu.exampleShowLink')"
              :label="t('menu.showLink')"
            />
          </template>
          <Segmented
            :modelValue="newFormInline.meta.is_show_menu ? 0 : 1"
            :options="ifEnableOptions"
            @change="
              ({ option: { value } }) => {
                newFormInline.meta.is_show_menu = value;
              }
            "
          />
        </el-form-item>

        <el-form-item :label="t('labels.status')" prop="is_active">
          <template #label>
            <from-question
              :description="t('menu.exampleMenuStatus')"
              :label="t('labels.status')"
            />
          </template>
          <Segmented
            :modelValue="newFormInline.is_active ? 0 : 1"
            :options="ifEnableOptions"
            @change="
              ({ option: { value } }) => {
                newFormInline.is_active = value;
              }
            "
          />
        </el-form-item>

        <el-divider />
        <el-form-item :label="t('menu.externalLink')" prop="isFrame">
          <template #label>
            <from-question
              :description="t('menu.exampleExternalLink')"
              :label="t('menu.externalLink')"
            />
          </template>
          <el-input
            v-model="newFormInline.meta.frame_url"
            :placeholder="t('menu.verifyExampleExternalLink')"
            clearable
          />
        </el-form-item>
        <el-form-item :label="t('menu.animation')" prop="frameLoading">
          <template #label>
            <from-question
              :description="t('menu.exampleAnimation')"
              :label="t('menu.animation')"
            />
          </template>
          <Segmented
            :modelValue="newFormInline.meta.frame_loading ? 0 : 1"
            :options="ifEnableOptions"
            @change="
              ({ option: { value } }) => {
                newFormInline.meta.frame_loading = value;
              }
            "
          />
        </el-form-item>
      </div>
      <div v-if="newFormInline.menu_type === MenuChoices.PERMISSION">
        <el-form-item :label="t('menu.permissionName')" prop="title">
          <el-input
            v-model="newFormInline.title"
            :placeholder="t('menu.verifyPermissionName')"
            clearable
          />
        </el-form-item>
        <el-form-item :label="t('menu.permissionCode')" prop="name">
          <template #label>
            <from-question
              :description="t('menu.examplePermissionCode')"
              :label="t('menu.permissionCode')"
            />
          </template>
          <el-input
            v-model="newFormInline.name"
            :placeholder="t('menu.verifyPermissionCode')"
            clearable
          />
        </el-form-item>
        <el-form-item :label="t('menu.permissionPath')" prop="path">
          <el-select
            v-model="newFormInline.path"
            class="w-full"
            clearable
            filterable
          >
            <el-option
              v-for="item in props.menuUrlList"
              :key="item.name"
              :label="`${item.name}----${item.url}`"
              :value="item.url"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('menu.associationModel')" prop="model">
          <template #label>
            <from-question
              :description="t('menu.exampleAssociationModel')"
              :label="t('menu.associationModel')"
            />
          </template>
          <el-select
            v-model="newFormInline.model"
            class="w-full"
            clearable
            filterable
            multiple
          >
            <el-option
              v-for="item in props.modelList"
              :key="item.pk"
              :disabled="item.disabled || item.name === '*'"
              :label="`${item.label}(${item.name})`"
              :value="item.pk"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('menu.requestMethod')" prop="component">
          <el-select
            v-model="newFormInline.component"
            class="!w-[180px]"
            clearable
          >
            <el-option
              v-for="item in props.choicesDict"
              :key="item.key"
              :disabled="item.disabled"
              :label="item.label"
              :value="item.key"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('labels.status')" prop="is_active">
          <template #label>
            <from-question
              :description="t('menu.exampleRequestStatus')"
              :label="t('labels.status')"
            />
          </template>
          <Segmented
            :modelValue="newFormInline.is_active ? 0 : 1"
            :options="ifEnableOptions"
            @change="
              ({ option: { value } }) => {
                newFormInline.is_active = value;
              }
            "
          />
        </el-form-item>
      </div>
      <el-form-item
        v-if="
          hasAuth('update:systemMenu') &&
          !newFormInline.is_add &&
          newFormInline.pk
        "
        class="flex float-right"
      >
        <el-popconfirm
          :title="t('buttons.hsconfirmdupdate')"
          @confirm="emit('handleConfirm', ruleFormRef, newFormInline)"
        >
          <template #reference>
            <el-button
              :disabled="newFormInline.is_add || !newFormInline.pk"
              plain
              type="danger"
              >{{ t("buttons.hsupdate") }}
            </el-button>
          </template>
        </el-popconfirm>
      </el-form-item>
    </el-form>
  </div>
</template>
