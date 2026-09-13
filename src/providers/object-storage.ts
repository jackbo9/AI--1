import { readFile, unlink } from "node:fs/promises";
import OSS from "ali-oss";
import { serverEnv } from "@/lib/env";

export type PutObjectInput = { objectKey: string; filePath: string; contentType: string };

export interface ObjectStorage {
  putFile(input: PutObjectInput): Promise<void>;
  getBuffer(objectKey: string): Promise<Buffer>;
  deleteObject(objectKey: string): Promise<void>;
  deleteLocalFile(filePath: string): Promise<void>;
}

class LocalObjectStorage implements ObjectStorage {
  async putFile() {}
  async getBuffer(objectKey: string) { return readFile(objectKey); }
  async deleteObject(objectKey: string) { await unlink(objectKey).catch(() => undefined); }
  async deleteLocalFile() {}
}

class OssObjectStorage implements ObjectStorage {
  private client: OSS;
  constructor() {
    const { OSS_REGION: region, OSS_BUCKET: bucket, OSS_ACCESS_KEY_ID: accessKeyId, OSS_ACCESS_KEY_SECRET: accessKeySecret, OSS_ENDPOINT: endpoint } = serverEnv;
    if (!region || !bucket || !accessKeyId || !accessKeySecret) throw new Error("OSS 存储配置不完整");
    this.client = new OSS({ region, bucket, accessKeyId, accessKeySecret, endpoint: endpoint || undefined, secure: true });
  }
  async putFile(input: PutObjectInput) { await this.client.put(input.objectKey, input.filePath, { headers: { "Content-Type": input.contentType } }); }
  async getBuffer(objectKey: string) {
    const result = await this.client.get(objectKey);
    return Buffer.isBuffer(result.content) ? result.content : Buffer.from(result.content);
  }
  async deleteObject(objectKey: string) { await this.client.delete(objectKey); }
  async deleteLocalFile(filePath: string) { await unlink(filePath).catch(() => undefined); }
}

let storage: ObjectStorage | undefined;
export function objectStorage() {
  storage ??= serverEnv.STORAGE_DRIVER === "oss" ? new OssObjectStorage() : new LocalObjectStorage();
  return storage;
}
