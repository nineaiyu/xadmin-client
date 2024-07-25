<script lang="ts" setup>
import { onBeforeUnmount, onMounted, ref, shallowRef } from "vue";
import "@wangeditor/editor/dist/css/style.css";
import { Editor, Toolbar } from "@wangeditor/editor-for-vue";
import { uploadFileApi } from "@/api/system/upload";
import { message } from "@/utils/message";
import { formatBytes, getKeyList } from "@pureadmin/utils";
import { useI18n } from "vue-i18n";
import { IEditorConfig } from "@wangeditor/editor";
import { hasAuth, hasGlobalAuth } from "@/router/utils";

const messages = defineModel<string | object | any>();
const editorRef = shallowRef();
const mode = "default";
const { t } = useI18n();
const loading = ref(false);
const uploadConfig = ref({ file_upload_size: 1048576 });
type InsertFnType = (url: string, alt?: string, href?: string) => void;

const emit = defineEmits<{
  (e: "change", values: any): void;
}>();

onMounted(() => {
  uploadFileApi.config().then(res => {
    if (res.code === 1000) {
      uploadConfig.value = res.data;
    }
  });
});

const handleChange = () => {
  emit("change", { messages, files: getUploadFiles() });
};

function getUploadFiles() {
  return [
    ...getKeyList(editorRef.value.getElemsByType("attachment"), "link"),
    ...getKeyList(editorRef.value.getElemsByType("image"), "src"),
    ...getKeyList(editorRef.value.getElemsByType("video"), "src")
  ];
}

defineExpose({ getUploadFiles });

// 注册。要在创建编辑器之前注册，且只能注册一次，不可重复注册。
// created(() => {
//   Boot.registerModule(attachmentModule);
// });

const toolbarConfig: any = {
  excludeKeys: "fullScreen",
  insertKeys: {
    index: -1, // 自定义插入的位置
    keys: []
  }
};
const editorConfig: Partial<IEditorConfig> = {
  readOnly: false,
  MENU_CONF: {},
  hoverbarKeys: {
    attachment: { menuKeys: [] }
  }
};
if (
  hasGlobalAuth("config:systemUploadFile") &&
  hasGlobalAuth("upload:systemUploadFile")
) {
  toolbarConfig.insertKeys.keys = ["uploadAttachment"]; // “上传附件”菜单
  editorConfig.hoverbarKeys.attachment = {
    menuKeys: ["downloadAttachment"] // “下载附件”菜单
  };
  editorConfig.MENU_CONF["uploadImage"] = {
    // 自定义上传
    async customUpload(file: File, insertFn: InsertFnType) {
      if (!beforeUpload(file)) return false;
      loading.value = true;
      const data = new FormData();
      data.append("file", file);
      uploadFileApi.upload({}, data).then(res => {
        if (res.code === 1000) {
          insertFn(
            res.data[0]?.access_url,
            res.data[0]?.filename,
            res.data[0]?.access_url
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
      if (!beforeUpload(file)) return false;
      loading.value = true;
      const data = new FormData();
      data.append("file", file);
      uploadFileApi.upload({}, data).then(res => {
        if (res.code === 1000) {
          insertFn(res.data[0]?.access_url, "");
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
      if (!beforeUpload(file)) return false;
      loading.value = true;
      const data = new FormData();
      data.append("file", file);
      uploadFileApi.upload({}, data).then(res => {
        if (res.code === 1000) {
          insertFn(res.data[0]?.filename, res.data[0]?.access_url);
        } else {
          message(`${t("results.failed")}，${res.detail}`, { type: "error" });
        }
        loading.value = false;
      });
    }
  };
}

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

const beforeUpload = (rawFile: File) => {
  if (rawFile.size > uploadConfig.value.file_upload_size) {
    message(
      `${t("systemUploadFile.uploadTip")} ${formatBytes(uploadConfig.value.file_upload_size)}!`,
      { type: "warning" }
    );
    return false;
  }
  return true;
};
</script>

<template>
  <el-card shadow="never">
    <div class="wangeditor">
      <Toolbar
        :defaultConfig="toolbarConfig"
        :editor="editorRef"
        :mode="mode"
        style="border-bottom: 1px solid #ccc"
      />
      <Editor
        v-model="messages"
        v-loading="loading"
        :defaultConfig="editorConfig"
        :mode="mode"
        style="height: 400px; overflow-y: hidden"
        @onChange="handleChange"
        @onCreated="handleCreated"
      />
    </div>
  </el-card>
</template>
