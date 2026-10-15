import { Platform } from 'react-native';
import { AppData } from '../domain/model';
import { isScheduled } from '../domain/engine';
import { addDays, dateKey, fromKey } from '../domain/time';
import { translate } from '../i18n';

/** Date triggers support every recurrence mode without waking JS in background.
 * iOS has a 64 pending notification limit. Reserve four slots and keep nearest
 * 60 events. Reminders are refreshed on foreground and template changes. */
let queue: Promise<void> = Promise.resolve();
export function refreshReminders(s: AppData, askPermission = false): Promise<void> {
  const job = queue.then(() => schedule(s, askPermission));
  queue = job.catch(() => undefined);
  return job;
}
async function schedule(s: AppData, askPermission: boolean): Promise<void> {
  if (Platform.OS === 'web') return;
  const Notifications = await import('expo-notifications');
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted && askPermission)
    permission = await Notifications.requestPermissionsAsync();
  const allowed =
    permission.granted ||
    permission.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  const previous = await Notifications.getAllScheduledNotificationsAsync();
  for (const n of previous.filter((n) => n.content.data?.owner === 'tiny-habits'))
    await Notifications.cancelScheduledNotificationAsync(n.identifier);
  if (!allowed) {
    if (askPermission && s.habits.some((h) => h.reminder)) throw new Error('notificationDenied');
    return;
  }
  const now = new Date(),
    candidates: { date: Date; name: string; id: string }[] = [];
  for (let i = 0; i < 28; i++) {
    const key = addDays(dateKey(now), i);
    for (const h of s.habits) {
      if (!h.reminder || !isScheduled(h, key)) continue;
      const [hour, minute] = h.reminder.split(':').map(Number),
        date = fromKey(key);
      date.setHours(hour!, minute!, 0, 0);
      if (date > now) candidates.push({ date, name: h.name, id: h.id });
    }
  }
  candidates.sort((a, b) => a.date.getTime() - b.date.getTime());
  const t = translate(s.settings.language);
  for (const c of candidates.slice(0, 60))
    await Notifications.scheduleNotificationAsync({
      identifier: `habit-${c.id}-${c.date.getTime()}`,
      content: {
        title: c.name,
        body: t('notificationBody'),
        sound: true,
        data: { owner: 'tiny-habits', habitId: c.id },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: c.date },
    });
}
