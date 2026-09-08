import { AES, Utf8 } from "crypto-es";

export function AesEncrypted(key: string, msg: string): string {
  return AES.encrypt(msg, key).toString();
}

export function AesDecrypted(key: string, encryptedMessage: string): string {
  return AES.decrypt(encryptedMessage, key).toString(Utf8);
}
