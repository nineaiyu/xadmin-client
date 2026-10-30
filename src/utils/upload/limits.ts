/**
 * 上传大小兜底上限（字节）：与后端种子 `FILE_UPLOAD_SIZE=10485760` 同口径。
 *
 * 仅在「无权读取上传配置 / 配置请求失败」时使用；正常路径以
 * `config:SystemUploadFile` 下发的 `file_upload_size` 为准。
 */
export const DEFAULT_FILE_UPLOAD_SIZE = 10 * 1024 * 1024;
