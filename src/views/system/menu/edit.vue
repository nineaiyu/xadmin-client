<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import { FormProps } from "./utils/types";
import { useApiAuth } from "./utils/hook";
import { computed, ref, watch } from "vue";
import { cloneDeep } from "@pureadmin/utils";
import { transformI18n } from "@/plugins/i18n";
import { IconSelect } from "@/components/ReIcon";
import { MenuChoices } from "@/views/system/constants";
import { useRenderIcon } from "@/components/ReIcon/src/hooks";
import ReAnimateSelector from "@/components/ReAnimateSelector";
import FromQuestion from "@/components/FromQuestion/index.vue";
import Segmented, { type OptionsType } from "@/components/ReSegmented";
import { dirFormRules, menuFormRules, permissionFormRules } from "./utils/rule";

const { t } = useI18n();
const { auth } = useApiAuth();

const emit = defineEmits(["handleConfirm"]);

const props = withDefaults(defineProps<FormProps>(), {
  treeData: () => [],
  methodChoices: () => [],
  modelList: () => [],
  menuChoices: () => [],
  menuUrlList: () => [],
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
      is_keepalive: false,
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
      :disabled="!auth.update"
      :model="newFormInline"
      :rules="formRules"
      class="search-form bg-bg_color w-[90%] pl-8 pt-[12px]"
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
        <el-form-item :label="t('systemMenu.title')" prop="title">
          <el-input
            v-model="newFormInline.title"
            :placeholder="t('systemMenu.verifyTitle')"
            clearable
          />
        </el-form-item>
        <el-form-item :label="t('systemMenu.icon')" prop="icon">
          <icon-select v-model="newFormInline.meta.icon" />
        </el-form-item>
        <div v-if="newFormInline.menu_type === MenuChoices.MENU">
          <el-form-item :label="t('systemMenu.transitionEnter')" prop="icon">
            <ReAnimateSelector v-model="newFormInline.meta.transition_enter" />
          </el-form-item>

          <el-form-item :label="t('systemMenu.transitionLeave')" prop="icon">
            <ReAnimateSelector
              v-model="newFormInline.meta.transition_leave"
              :disabled="!newFormInline.meta.transition_enter"
            />
          </el-form-item>
        </div>
        <el-form-item :label="t('systemMenu.componentName')" prop="name">
          <template #label>
            <from-question
              :description="t('systemMenu.exampleComponentName')"
              :label="t('systemMenu.componentName')"
            />
          </template>
          <el-input
            v-model="newFormInline.name"
            :placeholder="t('systemMenu.componentName')"
            clearable
          />
        </el-form-item>
        <el-form-item :label="t('systemMenu.path')" prop="path">
          <template #label>
            <from-question
              :description="t('systemMenu.exampleRoutePath')"
              :label="t('systemMenu.path')"
            />
          </template>
          <el-input
            v-model="newFormInline.path"
            :placeholder="t('systemMenu.verifyPath')"
            clearable
          />
        </el-form-item>
      </div>
      <div v-if="newFormInline.menu_type === MenuChoices.MENU">
        <el-form-item :label="t('systemMenu.componentPath')" prop="component">
          <template #label>
            <from-question
              :description="t('systemMenu.exampleComponentPath')"
              :label="t('systemMenu.componentPath')"
            />
          </template>
          <el-input
            v-model="newFormInline.component"
            :placeholder="t('systemMenu.verifyComponentPath')"
            clearable
          />
        </el-form-item>

        <el-divider />
        <el-form-item :label="t('systemMenu.cache')" prop="keepAlive">
          <template #label>
            <from-question
              :description="t('systemMenu.exampleCache')"
              :label="t('systemMenu.cache')"
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
        <el-form-item :label="t('systemMenu.showParentMenu')" prop="showParent">
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
        <el-row>
          <el-col :span="12">
            <el-form-item :label="t('systemMenu.showLink')" prop="showLink">
              <template #label>
                <from-question
                  :description="t('systemMenu.exampleShowLink')"
                  :label="t('systemMenu.showLink')"
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
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('labels.status')" prop="is_active">
              <template #label>
                <from-question
                  :description="t('systemMenu.exampleMenuStatus')"
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
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('systemMenu.fixedTag')" prop="fixedTag">
              <template #label>
                <from-question
                  :description="t('systemMenu.fixedTagTip')"
                  :label="t('systemMenu.fixedTag')"
                />
              </template>
              <Segmented
                :modelValue="newFormInline.meta.fixed_tag ? 0 : 1"
                :options="ifEnableOptions"
                @change="
                  ({ option: { value } }) => {
                    newFormInline.meta.fixed_tag = value;
                  }
                "
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item :label="t('systemMenu.hiddenTag')" prop="hiddenTag">
              <template #label>
                <from-question
                  :description="t('systemMenu.hiddenTagTip')"
                  :label="t('systemMenu.hiddenTag')"
                />
              </template>
              <Segmented
                :modelValue="newFormInline.meta.is_hidden_tag ? 0 : 1"
                :options="ifEnableOptions"
                @change="
                  ({ option: { value } }) => {
                    newFormInline.meta.is_hidden_tag = value;
                  }
                "
              />
            </el-form-item>
          </el-col>
        </el-row>

        <el-divider />
        <el-form-item :label="t('systemMenu.externalLink')" prop="isFrame">
          <template #label>
            <from-question
              :description="t('systemMenu.exampleExternalLink')"
              :label="t('systemMenu.externalLink')"
            />
          </template>
          <el-input
            v-model="newFormInline.meta.frame_url"
            :placeholder="t('systemMenu.verifyExampleExternalLink')"
            clearable
          />
        </el-form-item>
        <el-form-item :label="t('systemMenu.animation')" prop="frameLoading">
          <template #label>
            <from-question
              :description="t('systemMenu.exampleAnimation')"
              :label="t('systemMenu.animation')"
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
        <el-form-item :label="t('systemMenu.permissionName')" prop="title">
          <el-input
            v-model="newFormInline.title"
            :placeholder="t('systemMenu.verifyPermissionName')"
            clearable
          />
        </el-form-item>
        <el-form-item :label="t('systemMenu.permissionCode')" prop="name">
          <template #label>
            <from-question
              :description="t('systemMenu.examplePermissionCode')"
              :label="t('systemMenu.permissionCode')"
            />
          </template>
          <el-input
            v-model="newFormInline.name"
            :placeholder="t('systemMenu.verifyPermissionCode')"
            clearable
          />
        </el-form-item>
        <el-form-item :label="t('systemMenu.permissionPath')" prop="path">
          <el-select
            v-model="newFormInline.path"
            class="w-full"
            clearable
            filterable
          >
            <el-option
              v-for="item in menuUrlList"
              :key="item.name"
              :label="`${item.name}----${item.url}`"
              :value="item.url"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('systemMenu.associationModel')" prop="model">
          <template #label>
            <from-question
              :description="t('systemMenu.exampleAssociationModel')"
              :label="t('systemMenu.associationModel')"
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
              v-for="item in modelList"
              :key="item.pk"
              :disabled="item.disabled || item.name === '*'"
              :label="`${item.label}(${item.name})`"
              :value="item.pk"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('systemMenu.requestMethod')" prop="method">
          <el-select
            v-model="newFormInline.method"
            class="!w-[180px]"
            clearable
          >
            <el-option
              v-for="item in methodChoices"
              :key="item.value"
              :disabled="item.disabled"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="t('labels.status')" prop="is_active">
          <template #label>
            <from-question
              :description="t('systemMenu.exampleRequestStatus')"
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
        v-if="auth.update && !newFormInline.isAdd && newFormInline.pk"
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
