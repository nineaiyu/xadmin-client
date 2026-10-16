<script lang="ts" setup>
/**
 * 元数据搜索选择器统一入口：五件套（SearchUser/Dept/Role/Post/Menu）收敛为
 * 单组件，实体差异（API / 权限码 / i18n 前缀 / 树形 / 回显字段 / 列渲染）
 * 全部落在 PRESETS 一张表里。`api-search-*` 注册名与后端通知载荷的
 * `SearchXxx` 组件名字符串仍是既有契约，见 index.ts 的具名包装。
 */
import { computed, h, reactive, type Ref } from "vue";
import { ElImage } from "element-plus";
import { hasAuth } from "@/router/utils";
import { transformI18n } from "@/plugins/i18n";
import {
  searchDeptApi,
  searchMenuApi,
  searchPostApi,
  searchRoleApi,
  searchUserApi
} from "@/api/system/search";
import RePlusSearch from "@/components/RePlusSearch";
import type { BaseApi } from "@/api/base";
import type { PageTableColumn } from "@/components/RePlusPage";
import type { SearchEntity } from "./index";

type ColumnFormatter = (_payload: {
  listColumns: Ref<PageTableColumn[]>;
}) => void;

/** 低信息列统一窄宽（pk / 状态 / 计数类），宽列同时收窄并左对齐 */
const narrowColumns =
  (narrowKeys: string[], wideKey: string): ColumnFormatter =>
  ({ listColumns }) => {
    listColumns.value.forEach(column => {
      if (narrowKeys.indexOf(column._column?.key as string) > -1) {
        column["width"] = 80;
      }
      if (column._column.key === wideKey) {
        column["width"] = 200;
        column["align"] = "left";
      }
    });
  };

const SEARCH_PRESETS: Record<
  SearchEntity,
  {
    authCode: string;
    api: BaseApi;
    localeName: string;
    isTree?: boolean;
    valueProps: {
      value: string;
      label: string | ((_row: Record<string, unknown>) => string);
    };
    baseColumnsFormat?: ColumnFormatter;
  }
> = {
  user: {
    authCode: "list:SearchUser",
    api: searchUserApi,
    localeName: "systemUser",
    valueProps: { value: "pk", label: "username" },
    baseColumnsFormat: ({ listColumns }) => {
      listColumns.value.forEach(column => {
        if (
          ["pk", "is_active", "gender", "avatar"].indexOf(
            column._column?.key as string
          ) > -1
        ) {
          column["width"] = 80;
        }
        if (column._column.key === "avatar") {
          column["cellRenderer"] = ({ row }) =>
            h(ElImage, {
              lazy: true,
              src: row[column._column?.key as string],
              alt: row[column._column?.key as string],
              class: ["w-[36px]", "h-[36px]", "align-middle"],
              previewSrcList: [row[column._column?.key as string]],
              previewTeleported: true
            });
        }
      });
    }
  },
  dept: {
    authCode: "list:SearchDept",
    api: searchDeptApi,
    localeName: "systemDept",
    isTree: true,
    valueProps: { value: "pk", label: "name" },
    baseColumnsFormat: narrowColumns(
      ["pk", "is_active", "code", "user_count"],
      "name"
    )
  },
  role: {
    authCode: "list:SearchRole",
    api: searchRoleApi,
    localeName: "systemRole",
    valueProps: { value: "pk", label: "name" }
  },
  post: {
    authCode: "list:SearchPost",
    api: searchPostApi,
    localeName: "post",
    valueProps: { value: "pk", label: "name" }
  },
  menu: {
    authCode: "list:SearchMenu",
    api: searchMenuApi,
    localeName: "systemMenu",
    isTree: true,
    valueProps: {
      value: "pk",
      label: row => transformI18n(row.title as string)
    },
    baseColumnsFormat: ({ listColumns }) => {
      listColumns.value.forEach(column => {
        if (
          ["pk", "is_active", "method"].indexOf(column._column?.key as string) >
          -1
        ) {
          column["width"] = 80;
        }
        if (column._column.key === "title") {
          column["width"] = 200;
          column["align"] = "left";
          column["cellRenderer"] = ({ row }) =>
            h("span", transformI18n(row?.title as string));
        }
      });
    }
  }
};

const props = withDefaults(
  defineProps<{
    /** 搜索实体预设：决定 API / 权限码 / 列渲染等差异 */
    entity: SearchEntity;
    multiple?: boolean;
  }>(),
  { multiple: true }
);

const emit = defineEmits<{
  /** 透传 RePlusSearch 的 change 事件载荷 */
  change: [value: object | object[] | string | undefined];
}>();

const selectValue = defineModel<object | object[] | string>();

const preset = computed(() => SEARCH_PRESETS[props.entity]);
const api = computed(() => reactive(preset.value.api));
</script>

<template>
  <RePlusSearch
    v-if="hasAuth(preset.authCode)"
    v-model="selectValue"
    :multiple="multiple"
    :locale-name="preset.localeName"
    :api="api"
    :is-tree="preset.isTree ?? false"
    :value-props="preset.valueProps"
    :base-columns-format="preset.baseColumnsFormat"
    @change="value => emit('change', value)"
  />
</template>
