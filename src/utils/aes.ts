import AES from "crypto-js/aes";
import Utf8 from "crypto-js/enc-utf8";

export function AesEncrypted(key: string, msg: string): string {
  return AES.encrypt(msg, key).toString();
}

export function AesDecrypted(key: string, encryptedMessage: string): string {
  return AES.decrypt(encryptedMessage, key).toString(Utf8);
}
