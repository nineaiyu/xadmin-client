<script lang="ts" setup>
import { ref } from "vue";
import { useI18n } from "vue-i18n";
import { isEmpty, isNullOrUnDef } from "@pureadmin/utils";
import { IconSelect } from "@/components/ReIcon";
import { MenuChoices } from "@/views/system/constants";
import ReAnimateSelector from "@/components/ReAnimateSelector";
import FromQuestion from "@/components/FromQuestion/index.vue";
import Segmented, { type OptionsType } from "@/components/ReSegmented";
import type { FormItemProps } from "../utils/types";

/**
 * 菜单/目录类型的表单字段区（拆分自 edit.vue：基本信息、缓存与标签开关、
 * 外链与动画）。newFormInline 为父级表单对象，就地修改其字段。
 */
const props = defineProps<{
  newFormInline: FormItemProps;
  ifEnableOptions: Array<OptionsType>;
  viewList: object;
}>();

const { t } = useI18n();

// ref 包装同一对象引用：模板/回调经 ref 修改字段（避免 vue/no-mutating-props）
const newFormInline = ref(props.newFormInline);

/** 组件路径联动：path 自动补 "/" 前缀，name 取视图组件 name */
const handleComponentChange = (value: string) => {
  if (isEmpty(value) || isNullOrUnDef(value)) {
    return;
  }
  newFormInline.value.path = `/${value}`;
  newFormInline.value.name = (props.viewList as Record<string, string>)[value];
};
</script>

<template>
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
      <el-form-item :label="t('systemMenu.componentPath')" prop="component">
        <template #label>
          <from-question
            :description="t('systemMenu.exampleComponentPath')"
            :label="t('systemMenu.componentPath')"
          />
        </template>
        <el-select
          v-model="newFormInline.component"
          class="w-full"
          :placeholder="t('systemMenu.verifyComponentPath')"
          clearable
          filterable
          @change="handleComponentChange"
        >
          <el-option
            v-for="item in Object.keys(viewList)"
            :key="item"
            :value="item"
          >
            <span style="float: left">{{ item }}</span>
            <span
              style="
                float: right;
                font-size: 13px;
                color: var(--el-text-color-secondary);
              "
            >
              {{ viewList[item] }}
            </span>
          </el-option>
        </el-select>
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
        :disabled="newFormInline.menu_type === MenuChoices.MENU"
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
</template>
