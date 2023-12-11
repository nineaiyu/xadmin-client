<script setup lang="ts">
import sha1 from "js-sha1";

import { UploadFilled } from "@element-plus/icons-vue";
import {
  uploadCompleteApi,
  uploadContentHashApi,
  uploadGetAuthSidApi,
  uploadPreHashApi
} from "@/api/movies/file";
import { message } from "@/utils/message";
import { uploadResult, xmlOpts } from "./types";
import {
  UploadProgressEvent,
  UploadRequestHandler,
  UploadRequestOptions
} from "element-plus";
import { useI18n } from "vue-i18n";

defineOptions({
  name: "FileUpload"
});

const props = defineProps({
  fileId: String,
  filePk: String,
  multiple: Boolean,
  limit: Number,
  accept: String
});
const emit = defineEmits<{
  (e: "update:fileId", v: string);
  (e: "update:filePk", v: string);
  (e: "success", v: any): void;
}>();

const { t } = useI18n();

function onSuccess(pk: string) {
  emit("success", pk);
}

function BlobToArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = function (event) {
      resolve(event.target.result);
    };
    reader.onerror = function (event) {
      reject(event);
    };
    reader.readAsArrayBuffer(file);
  });
}

function GetFilePreHash(buffer) {
  return sha1.hex(buffer.slice(0, 1024));
}

function ArrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let len = bytes.byteLength, i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

async function GetFileHashProofCode(option, md5_int) {
  const start = Number(BigInt(md5_int) % BigInt(option.file.size));
  const end = Math.min(start + 8, option.file.size);
  const p_buff = option.file.slice(start, end);
  return ArrayBufferToBase64(await BlobToArrayBuffer(p_buff));
}

function fetchProgress(url, opts: xmlOpts, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(opts.method, url);
    for (let key in opts.headers || {}) {
      xhr.setRequestHeader(key, opts.headers[key]);
    }
    xhr.onload = e => resolve(e.target);
    xhr.onerror = reject;
    if (xhr.upload && onProgress) {
      xhr.upload.onprogress = onProgress; //上传
    }
    if ("onprogerss" in xhr && onProgress) {
      xhr.onprogress = onProgress; //下载
    }
    xhr.send(opts.body);
  });
}

async function ContentHash(
  option,
  md5_int
): Promise<{ conHash: string; proofCode: string }> {
  return new Promise((resolve, reject) => {
    const chunkSize = 50 * 1024 * 1024;
    let promise: Promise<void> = Promise.resolve();
    for (let index = 0; index < option.file.size; index += chunkSize) {
      promise = promise.then(() =>
        hashBlob(option.file.slice(index, index + chunkSize), index)
      );
    }
    let count = 0;
    const hash = sha1.create();

    function hashBlob(blob, index) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = ({ target }) => {
          hash.update(target.result);
          count += 1;
          resolve(null);
        };
        reader.onerror = function (event) {
          reject(event);
        };
        reader.onprogress = function (evt) {
          option.onProgress({
            percent:
              evt.total > 0
                ? ((evt.loaded + index) / option.file.size) * 100
                : 0
          });
        };
        reader.readAsArrayBuffer(blob);
      });
    }

    promise
      .then(async () => {
        const conHash = hash.hex().toUpperCase();
        const proofCode = await GetFileHashProofCode(option, md5_int);
        resolve({ conHash, proofCode });
      })
      .catch(() => {
        reject();
      });
  });
}

const uploadAction = async (
  upload_extra,
  part_info_list,
  option,
  fileHashInfo
) => {
  let count = 0;
  const chunkSize = upload_extra.part_size;
  for (let index = 0; index < part_info_list.length; index++) {
    const chunk = option.file.slice(index * chunkSize, (index + 1) * chunkSize);
    let res = await fetchProgress(
      part_info_list[index].upload_url,
      { method: "put", body: chunk },
      pr => {
        option.onProgress({
          percent: Math.ceil(
            ((pr.loaded + index * chunkSize) * 100) / option.file.size
          )
        });
      }
    );
    if (res.status !== 200) {
      count += 1;
      break;
    }
  }
  if (count === 0) {
    uploadCompleteApi({ file_info: fileHashInfo }).then(
      ({ check_status, file_id, pk }: uploadResult | any) => {
        if (check_status) {
          option.onProgress({ percent: 100 });
          emit("update:fileId", file_id);
          emit("update:filePk", pk);
          onSuccess(pk);
          message(t("results.success"), { type: "success" });
        } else {
          message(t("MoviesFile.uploadFailed", { count: 1 }), {
            type: "error"
          });
        }
      }
    );
  } else {
    message(t("MoviesFile.uploadFailed", { count: 2 }), { type: "error" });
  }
};

const uploadRequest: UploadRequestHandler = (option: UploadRequestOptions) => {
  // 1.检查是否可以秒传
  const file = option.file;
  uploadGetAuthSidApi().then(async ({ data }: any) => {
    // a.hash校验
    const buffer = await BlobToArrayBuffer(file.slice(0, 1024));
    let fileHashInfo = {
      sid: data.sid,
      file_name: file.name,
      file_size: file.size,
      pre_hash: GetFilePreHash(buffer),
      proof_code: null,
      content_hash: null
    };
    uploadPreHashApi({ file_info: fileHashInfo }).then(
      async ({
        check_status,
        md5_token,
        upload_extra,
        part_info_list
      }: uploadResult | any) => {
        if (check_status === true) {
          // 秒传逻辑
          let hash = await ContentHash(option, md5_token);
          fileHashInfo.proof_code = hash.proofCode;
          fileHashInfo.content_hash = hash.conHash;
          uploadContentHashApi({ file_info: fileHashInfo }).then(
            async ({
              check_status,
              file_id,
              upload_extra,
              part_info_list,
              pk
            }: uploadResult | any) => {
              if (check_status) {
                option.onProgress({ percent: 100 } as UploadProgressEvent);
                emit("update:fileId", file_id);
                emit("update:filePk", pk);
                onSuccess(pk);
                message(t("results.success"), { type: "success" });
              } else {
                await uploadAction(
                  upload_extra,
                  part_info_list,
                  option,
                  fileHashInfo
                );
              }
            }
          );
        } else {
          await uploadAction(
            upload_extra,
            part_info_list,
            option,
            fileHashInfo
          );
        }
      }
    );
  });
};
</script>

<template>
  <div class="selector">
    <el-upload
      drag
      :http-request="uploadRequest"
      :limit="props.limit"
      :accept="props.accept"
      :multiple="props.multiple"
    >
      <el-icon class="el-icon--upload">
        <upload-filled />
      </el-icon>
      <div class="el-upload__text">
        {{ t("MoviesFile.uploadTip1") }}
        <em>{{ t("MoviesFile.uploadTip2") }}</em>
      </div>
    </el-upload>
  </div>
</template>
