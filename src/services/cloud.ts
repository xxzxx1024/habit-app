import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { CloudSnapshot, cloudHeads } from '../domain/sync';
import { documentSchema } from '../domain/validate';
import { z } from 'zod';
interface NativeCloud {
  available(): Promise<boolean>;
  readSnapshots(): Promise<string[]>;
  writeSnapshot(revision: string, raw: string): Promise<void>;
}
const native =
  Platform.OS === 'ios' ? requireOptionalNativeModule<NativeCloud>('HabitCloud') : null;
const schema = z.object({ parents: z.array(z.string()), document: documentSchema });
export const cloud = {
  async available(): Promise<boolean> {
    return native ? native.available() : false;
  },
  async heads(): Promise<CloudSnapshot[]> {
    if (!native) throw new Error('cloudUnavailable');
    const snapshots = (await native.readSnapshots()).map((raw) => schema.parse(JSON.parse(raw)));
    return cloudHeads(snapshots).sort((a, b) =>
      b.document.updatedAt.localeCompare(a.document.updatedAt),
    );
  },
  async write(snapshot: CloudSnapshot): Promise<void> {
    if (!native) throw new Error('cloudUnavailable');
    await native.writeSnapshot(snapshot.document.revision, JSON.stringify(snapshot));
  },
};
