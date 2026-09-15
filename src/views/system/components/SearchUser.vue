<script lang="ts" setup>
import { h, reactive, type Ref } from "vue";
import { hasAuth } from "@/router/utils";
import { searchUserApi } from "@/api/system/search";
import RePlusSearch from "@/components/RePlusSearch";
import { ElImage } from "element-plus";
import type { PageTableColumn } from "@/components/RePlusPage";

defineOptions({ name: "SearchUser" });

const emit = defineEmits<{
  /** 透传 RePlusSearch 的 change 事件载荷 */
  change: [value: object | object[] | string | undefined];
}>();

const selectValue = defineModel<object | object[] | string>();
const { multiple = true } = defineProps<{ multiple?: boolean }>();

const api = reactive(searchUserApi);

const baseColumnsFormat = ({
  listColumns
}: {
  listColumns: Ref<PageTableColumn[]>;
}) => {
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
};
</script>

<template>
  <RePlusSearch
    v-if="hasAuth('list:SearchUser')"
    v-model="selectValue"
    :multiple="multiple"
    locale-name="systemUser"
    :baseColumnsFormat="baseColumnsFormat"
    :api="api"
    :valueProps="{
      value: 'pk',
      label: 'username'
    }"
    @change="
      value => {
        emit('change', value);
      }
    "
  />
</template>
