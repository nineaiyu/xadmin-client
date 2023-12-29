<script setup lang="ts">
import { ref, watch } from "vue";
import { FormProps } from "./utils/types";
import FromQuestion from "@/components/FromQuestion/index.vue";
import ReAnimateSelector from "@/components/ReAnimateSelector";
import { IconSelect } from "@/components/ReIcon";

import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import { transformI18n } from "@/plugins/i18n";
import { SelectOption } from "@/constants/constants";
import { dirFormRules, menuFormRules, permissionFormRules } from "./utils/rule";
import { hasAuth } from "@/router/utils";
import { cloneDeep } from "@pureadmin/utils";
import { useI18n } from "vue-i18n";
import { MenuChoices } from "@/views/system/constants";

const { t } = useI18n();
const emit = defineEmits(["handleConfirm"]);
const props = withDefaults(defineProps<FormProps>(), {
  treeData: () => [],
  choicesDict: () => [],
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

const ifEnableOptions: SelectOption<boolean>[] = [
  { label: t("labels.enable"), value: true },
  { label: t("labels.disable"), value: false }
];

// const MenuTypeOptions: SelectOption<number>[] = [
//   { label: t("menu.directory"), value: 0 },
//   { label: t("menu.menu"), value: 1 },
//   { label: t("menu.permissions"), value: 2 }
// ];

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

const handleChangeMenuType = (val: number) => {
  setTimeout(function () {
    ruleFormRef.value!.clearValidate([
      "menu_type",
      "title",
      "rank",
      "path",
      "perms"
    ]);
  }, 30);

  if (val === 0) {
    formRules.value = dirFormRules;
  } else if (val === 1) {
    formRules.value = menuFormRules;
  } else {
    formRules.value = permissionFormRules;
  }
};

defineExpose({ getRef });

const getMinHeight = () => {
  if (!newFormInline.value.is_add) {
    return `calc(100vh - 133px)`;
  }
  return "";
};
</script>

<template>
  <div
    class="h-full bg-bg_color overflow-auto"
    :style="{ minHeight: getMinHeight() }"
  >
    <el-form
      ref="ruleFormRef"
      :model="newFormInline"
      :rules="formRules"
      label-width="160px"
      :disabled="!hasAuth('update:systemMenu')"
      class="search-form bg-bg_color w-[90%] pl-8 pt-[12px]"
    >
      <el-form-item :label="t('menu.type')" prop="menu_type">
        <el-radio-group
          v-model="newFormInline.menu_type"
          @change="handleChangeMenuType"
        >
          <el-radio-button
            v-for="(item, index) in menuChoices"
            :key="index"
            :label="item.key"
            :disabled="
              !newFormInline.is_add &&
              ((newFormInline.menu_type === MenuChoices.PERMISSION &&
                index !== 2) ||
                (newFormInline.menu_type !== MenuChoices.PERMISSION &&
                  index === 2))
            "
            >{{ item.label }}
          </el-radio-button>
        </el-radio-group>
      </el-form-item>
      <el-form-item :label="t('menu.parentNode')" prop="parentId">
        <el-tree-select
          ref="treeSelectRef"
          v-model="newFormInline.parent"
          :data="props.treeData"
          :props="{
            children: 'children',
            label: data => transformI18n(data.meta.title),
            disabled: data => data.menu_type == MenuChoices.PERMISSION
          }"
          node-key="pk"
          accordion
          auto-expand-parent
          show-checkbox
          :default-expanded-keys="newFormInline.parent_ids"
          filterable
          check-strictly
          clearable
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
            clearable
            :placeholder="t('menu.verifyTitle')"
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
              :label="t('menu.componentName')"
              :description="t('menu.exampleComponentName')"
            />
          </template>
          <el-input
            v-model="newFormInline.name"
            clearable
            :placeholder="t('menu.componentName')"
          />
        </el-form-item>
        <el-form-item :label="t('menu.routePath')" prop="path">
          <template #label>
            <from-question
              :label="t('menu.routePath')"
              :description="t('menu.exampleRoutePath')"
            />
          </template>
          <el-input
            v-model="newFormInline.path"
            clearable
            :placeholder="t('menu.verifyPath')"
          />
        </el-form-item>
      </div>
      <div v-if="newFormInline.menu_type === MenuChoices.MENU">
        <el-form-item :label="t('menu.componentPath')" prop="component">
          <template #label>
            <from-question
              :label="t('menu.componentPath')"
              :description="t('menu.exampleComponentPath')"
            />
          </template>
          <el-input
            v-model="newFormInline.component"
            clearable
            :placeholder="t('menu.verifyComponentPath')"
          />
        </el-form-item>

        <el-divider />
        <el-form-item :label="t('menu.cache')" prop="keepAlive">
          <template #label>
            <from-question
              :label="t('menu.cache')"
              :description="t('menu.exampleCache')"
            />
          </template>
          <el-radio-group v-model="newFormInline.meta.is_keepalive">
            <el-radio-button
              v-for="(item, index) in ifEnableOptions"
              :key="index"
              :label="item.value"
              >{{ item.label }}
            </el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item :label="t('menu.showParentMenu')" prop="showParent">
          <el-radio-group v-model="newFormInline.meta.is_show_parent">
            <el-radio-button
              v-for="(item, index) in ifEnableOptions"
              :key="index"
              :label="item.value"
              >{{ item.label }}
            </el-radio-button>
          </el-radio-group>
        </el-form-item>
      </div>
      <div v-if="newFormInline.menu_type !== MenuChoices.PERMISSION">
        <el-divider />
        <el-form-item :label="t('menu.showLink')" prop="showLink">
          <template #label>
            <from-question
              :label="t('menu.showLink')"
              :description="t('menu.exampleShowLink')"
            />
          </template>
          <el-radio-group v-model="newFormInline.meta.is_show_menu">
            <el-radio-button
              v-for="(item, index) in ifEnableOptions"
              :key="index"
              :label="item.value"
              >{{ item.label }}
            </el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-form-item :label="t('labels.status')" prop="is_active">
          <template #label>
            <from-question
              :label="t('labels.status')"
              :description="t('menu.exampleMenuStatus')"
            />
          </template>
          <el-radio-group v-model="newFormInline.is_active">
            <el-radio-button
              v-for="(item, index) in ifEnableOptions"
              :key="index"
              :label="item.value"
              >{{ item.label }}
            </el-radio-button>
          </el-radio-group>
        </el-form-item>

        <el-divider />
        <el-form-item :label="t('menu.externalLink')" prop="isFrame">
          <template #label>
            <from-question
              :label="t('menu.externalLink')"
              :description="t('menu.exampleExternalLink')"
            />
          </template>
          <el-input
            v-model="newFormInline.meta.frame_url"
            clearable
            :placeholder="t('menu.verifyExampleExternalLink')"
          />
        </el-form-item>
        <el-form-item :label="t('menu.animation')" prop="frameLoading">
          <template #label>
            <from-question
              :label="t('menu.animation')"
              :description="t('menu.exampleAnimation')"
            />
          </template>
          <el-radio-group v-model="newFormInline.meta.frame_loading">
            <el-radio-button
              v-for="(item, index) in ifEnableOptions"
              :key="index"
              :label="item.value"
              >{{ item.label }}
            </el-radio-button>
          </el-radio-group>
        </el-form-item>
      </div>
      <div v-if="newFormInline.menu_type === MenuChoices.PERMISSION">
        <el-form-item :label="t('menu.permissionName')" prop="title">
          <el-input
            v-model="newFormInline.title"
            clearable
            :placeholder="t('menu.verifyPermissionName')"
          />
        </el-form-item>
        <el-form-item :label="t('menu.permissionCode')" prop="name">
          <template #label>
            <from-question
              :label="t('menu.permissionCode')"
              :description="t('menu.examplePermissionCode')"
            />
          </template>
          <el-input
            v-model="newFormInline.name"
            clearable
            :placeholder="t('menu.verifyPermissionCode')"
          />
        </el-form-item>
        <el-form-item :label="t('menu.permissionPath')" prop="path">
          <el-select
            v-model="newFormInline.path"
            style="width: 100%"
            clearable
            placeholder="Select"
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
        <el-form-item :label="t('menu.requestMethod')" prop="component">
          <el-select
            v-model="newFormInline.component"
            class="filter-item"
            style="width: 180px"
            clearable
          >
            <el-option
              v-for="item in props.choicesDict"
              :key="item.key"
              :label="item.label"
              :disabled="item.disabled"
              :value="item.key"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('labels.status')" prop="is_active">
          <template #label>
            <from-question
              :label="t('labels.status')"
              :description="t('menu.exampleRequestStatus')"
            />
          </template>
          <el-radio-group v-model="newFormInline.is_active">
            <el-radio-button
              v-for="(item, index) in ifEnableOptions"
              :key="index"
              :label="item.value"
              >{{ item.label }}
            </el-radio-button>
          </el-radio-group>
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
