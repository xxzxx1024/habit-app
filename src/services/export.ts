import { Platform } from 'react-native';
import { AppData } from '../domain/model';
import { exportCSV } from '../domain/csv';
import { dateKey } from '../domain/time';
export async function shareCSV(s: AppData): Promise<void> {
  const csv = exportCSV(s),
    name = `tiny-habits-${dateKey()}.csv`;
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  const { File, Paths } = await import('expo-file-system');
  const Sharing = await import('expo-sharing');
  if (!(await Sharing.isAvailableAsync())) throw new Error('csvUnavailable');
  const file = new File(Paths.cache, name);
  file.write(csv);
  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/csv',
    UTI: 'public.comma-separated-values-text',
  });
}
