interface uploadResult {
  check_status?: boolean;
  file_id?: string;
  pk?: string;
  upload_extra?: string;
  part_info_list?: string;
  md5_token?: string;
}
interface xmlOpts {
  method?: string;
  headers?: {};
  body?: XMLHttpRequestBodyInit;
}

export type { uploadResult, xmlOpts };
