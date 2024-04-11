<script lang="ts" setup>
import { onBeforeUnmount, ref, shallowRef } from "vue";
import "@wangeditor/editor/dist/css/style.css";
import { Editor, Toolbar } from "@wangeditor/editor-for-vue";
import { FormProps, InsertFnType } from "./utils/types";
import { formRules } from "./utils/rule";
import { UploadFileApi } from "@/api/system/upload";
import { message } from "@/utils/message";
import { UploadFileResult } from "@/api/types";
import { getKeyList } from "@pureadmin/utils";
import { NoticeChoices } from "@/views/system/constants";
import { useNoticeForm } from "./utils/hook";

const props = withDefaults(defineProps<FormProps>(), {
  isAdd: () => true,
  showColumns: () => [],
  formInline: () => ({
    pk: 0,
    title: "",
    publish: false,
    message: "",
    level: "primary",
    notice_type_display: "",
    notice_type: NoticeChoices.NOTICE,
    notice_dept: [],
    notice_role: [],
    notice_user: []
  }),
  noticeChoices: () => [],
  levelChoices: () => []
});
const formRef = ref();
const newFormInline = ref(props.formInline);
const editorRef = shallowRef();
const mode = "default";
const { columns, t } = useNoticeForm(props, newFormInline);

function getRef() {
  newFormInline.value.files = getUploadFiles();
  return formRef.value?.formInstance;
}

function getUploadFiles() {
  return [
    ...getKeyList(editorRef.value.getElemsByType("attachment"), "link"),
    ...getKeyList(editorRef.value.getElemsByType("image"), "src"),
    ...getKeyList(editorRef.value.getElemsByType("video"), "src")
  ];
}

defineExpose({ getRef, getUploadFiles });

// 注册。要在创建编辑器之前注册，且只能注册一次，不可重复注册。
// created(() => {
//   Boot.registerModule(attachmentModule);
// });

const toolbarConfig: any = {
  excludeKeys: "fullScreen",
  insertKeys: {
    index: -1, // 自定义插入的位置
    keys: ["uploadAttachment"] // “上传附件”菜单
  }
};
const editorConfig = {
  placeholder: t("systemNotice.message"),
  readOnly: !props.isAdd && props.showColumns.indexOf("message") === -1,
  MENU_CONF: {},
  hoverbarKeys: {
    attachment: {
      menuKeys: ["downloadAttachment"] // “下载附件”菜单
    }
  }
};

editorConfig.MENU_CONF["uploadImage"] = {
  // 自定义上传
  async customUpload(file: File, insertFn: InsertFnType) {
    loading.value = true;
    const data = new FormData();
    data.append("file", file);
    UploadFileApi({}, data).then((res: UploadFileResult) => {
      if (res.code === 1000) {
        insertFn(
          res.data[0]?.filepath,
          res.data[0]?.filename,
          res.data[0]?.filepath
        );
      } else {
        message(`${t("results.failed")}，${res.detail}`, { type: "error" });
      }
      loading.value = false;
    });
  }
};

editorConfig.MENU_CONF["uploadVideo"] = {
  // 自定义上传
  async customUpload(file: File, insertFn: InsertFnType) {
    loading.value = true;
    const data = new FormData();
    data.append("file", file);
    UploadFileApi({}, data).then((res: UploadFileResult) => {
      if (res.code === 1000) {
        insertFn(res.data[0]?.filepath, "");
      } else {
        message(`${t("results.failed")}，${res.detail}`, { type: "error" });
      }
      loading.value = false;
    });
  }
};

editorConfig.MENU_CONF["uploadAttachment"] = {
  // 自定义上传
  async customUpload(file: File, insertFn: InsertFnType) {
    loading.value = true;
    const data = new FormData();
    data.append("file", file);
    UploadFileApi({}, data).then((res: UploadFileResult) => {
      if (res.code === 1000) {
        insertFn(res.data[0]?.filename, res.data[0]?.filepath);
      } else {
        message(`${t("results.failed")}，${res.detail}`, { type: "error" });
      }
      loading.value = false;
    });
  }
};

const handleCreated = editor => {
  // 记录 editor 实例，重要！
  editorRef.value = editor;
};

// 组件销毁时，也及时销毁编辑器
onBeforeUnmount(() => {
  const editor = editorRef.value;
  if (editor == null) return;
  editor.destroy();
});
const loading = ref(false);
</script>

<template>
  <PlusForm
    ref="formRef"
    v-model="newFormInline"
    label-position="right"
    :columns="columns"
    :rules="formRules"
    :hasFooter="false"
    :row-props="{ gutter: 24 }"
    label-width="120px"
  >
    <template #plus-field-message>
      <el-card shadow="never">
        <div class="wangeditor">
          <Toolbar
            :defaultConfig="toolbarConfig"
            :editor="editorRef"
            :mode="mode"
            style="border-bottom: 1px solid #ccc"
          />
          <Editor
            v-model="newFormInline.message"
            v-loading="loading"
            :defaultConfig="editorConfig"
            :mode="mode"
            style="height: 400px; overflow-y: hidden"
            @onCreated="handleCreated"
          />
        </div>
      </el-card>
    </template>
  </PlusForm>
</template>
