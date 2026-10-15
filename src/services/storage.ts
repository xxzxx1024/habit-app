import AsyncStorage from '@react-native-async-storage/async-storage';
import { Document } from '../domain/model';
import { parseDocument } from '../domain/validate';
// 使用独立版本键保留迁移空间。读取异常向上抛出，绝不自动写入空数据。
const DOCUMENT_KEY = '@tiny-habits/document-v1';
const BASE_KEY = '@tiny-habits/cloud-base-v1';
const AUTO_KEY = '@tiny-habits/cloud-enabled-v1';
export const storage = {
  async load(): Promise<Document | null> {
    const s = await AsyncStorage.getItem(DOCUMENT_KEY);
    return s === null ? null : parseDocument(s);
  },
  // One serialized document makes a point operation atomic in AsyncStorage.
  async save(doc: Document): Promise<void> {
    await AsyncStorage.setItem(DOCUMENT_KEY, JSON.stringify(doc));
  },
  async base(): Promise<string | null> {
    return AsyncStorage.getItem(BASE_KEY);
  },
  async setBase(revision: string): Promise<void> {
    await AsyncStorage.setItem(BASE_KEY, revision);
  },
  async auto(): Promise<boolean> {
    return (await AsyncStorage.getItem(AUTO_KEY)) === 'true';
  },
  async setAuto(value: boolean): Promise<void> {
    await AsyncStorage.setItem(AUTO_KEY, String(value));
  },
};
