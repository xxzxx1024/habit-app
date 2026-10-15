import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, View, Text, Pressable } from 'react-native';
import { getLocales } from 'expo-localization';
import { AppData, Document, Language, RuleError } from '../domain/model';
import { id, initialData, rollover } from '../domain/engine';
import { CloudSnapshot, decideSync } from '../domain/sync';
import { dateKey } from '../domain/time';
import { storage } from '../services/storage';
import { cloud } from '../services/cloud';
import { refreshReminders } from '../services/notifications';
import { TextKey, translate } from '../i18n';

interface Store {
  data: AppData;
  busy: boolean;
  autoSync: boolean;
  syncStatus: TextKey;
  conflict: CloudSnapshot[] | null;
  mutate: (fn: (s: AppData) => AppData) => Promise<void>;
  sync: (choice?: 'local' | 'cloud') => Promise<void>;
  enableSync: (enabled: boolean) => Promise<void>;
  t: (key: TextKey) => string;
}
const Context = createContext<Store | null>(null);
const systemLanguage = (): Language => {
  const l = getLocales()[0]?.languageCode;
  return l === 'en' || l === 'ja' || l === 'ko' ? l : 'zh';
};
const documentFor = (data: AppData): Document => ({
  revision: id(),
  updatedAt: new Date().toISOString(),
  data,
});

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [doc, setDoc] = useState<Document | null>(null),
    current = useRef<Document | null>(null);
  const [, setClock] = useState(0);
  const [loadError, setLoadError] = useState(false),
    [busy, setBusy] = useState(false);
  const [autoSync, setAutoSync] = useState(false),
    auto = useRef(false);
  const [syncStatus, setSyncStatus] = useState<TextKey>('local');
  const [conflict, setConflict] = useState<CloudSnapshot[] | null>(null);
  // All writes and cloud actions use one queue. Two rapid taps never read a
  // stale render snapshot, and storage must succeed BEFORE the UI is committed.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const enqueue = useCallback(<T,>(fn: () => Promise<T>): Promise<T> => {
    const job = queue.current.then(async () => {
      setBusy(true);
      try {
        return await fn();
      } finally {
        setBusy(false);
      }
    });
    queue.current = job.catch(() => undefined);
    return job;
  }, []);
  // 先落盘后更新内存：磁盘写失败时界面仍显示原状态，不显示虚假的成功积分。
  const commit = useCallback(async (next: Document) => {
    await storage.save(next);
    current.current = next;
    setDoc(next);
  }, []);
  const load = useCallback(async () => {
    try {
      setLoadError(false);
      let value = await storage.load();
      if (!value) {
        value = documentFor(initialData(systemLanguage()));
        await storage.save(value);
      }
      const data = rollover(value.data);
      if (data !== value.data) {
        value = documentFor(data);
        await storage.save(value);
      }
      const enabled = await storage.auto();
      auto.current = enabled;
      setAutoSync(enabled);
      current.current = value;
      setDoc(value);
    } catch {
      setLoadError(true);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const mutate = useCallback(
    (fn: (s: AppData) => AppData) =>
      enqueue(async () => {
        const old = current.current;
        if (!old) return;
        const data = fn(rollover(old.data));
        if (data !== old.data) {
          await commit(documentFor(data));
          setSyncStatus('local');
        }
      }),
    [enqueue, commit],
  );
  // 同步和用户操作共享同一条串行队列，避免网络等待期间出现余额竞争。
  // 原生层负责文件读写，这里负责版本冲突、同步基线和当前周的补记。
  const sync = useCallback(
    (choice?: 'local' | 'cloud') =>
      enqueue(async () => {
        const local = current.current;
        if (!local) return;
        setSyncStatus('syncing');
        try {
          if (!(await cloud.available())) {
            setSyncStatus('cloudUnavailable');
            return;
          }
          // Re-read at the time of resolution. New device writes are never ignored.
          const heads = await cloud.heads();
          const base = await storage.base();
          const decision =
            choice === 'local'
              ? 'upload'
              : choice === 'cloud' && heads.length
                ? 'download'
                : decideSync(local, heads, base);
          if (decision === 'conflict') {
            setConflict(heads);
            setSyncStatus('conflict');
            return;
          }
          if (decision === 'download') {
            const remote = heads[0]!.document;
            // Choosing a cloud branch in a fork records a new resolving snapshot
            // referencing all heads, so the discarded branch stays recoverable.
            let resolved = remote;
            if (heads.length > 1) {
              resolved = documentFor(remote.data);
              await cloud.write({
                parents: heads.map((h) => h.document.revision),
                document: resolved,
              });
            }
            // Store baseline BEFORE any local rollover, which is itself a new edit.
            await commit(resolved);
            await storage.setBase(resolved.revision);
            const rolled = rollover(resolved.data);
            if (rolled !== resolved.data) {
              const next = documentFor(rolled);
              await commit(next);
              await cloud.write({ parents: [resolved.revision], document: next });
              await storage.setBase(next.revision);
            }
          } else if (decision === 'upload') {
            // A fork resolution needs its own ID even if local was already a head.
            const resolved =
              choice === 'local' || heads.some((h) => h.document.revision === local.revision)
                ? documentFor(local.data)
                : local;
            await cloud.write({
              parents: heads.map((h) => h.document.revision),
              document: resolved,
            });
            if (resolved !== local) await commit(resolved);
            await storage.setBase(resolved.revision);
          } else await storage.setBase(local.revision);
          setConflict(null);
          setSyncStatus('synced');
        } catch {
          setSyncStatus('syncError');
        }
      }),
    [enqueue, commit],
  );
  const enableSync = useCallback(
    (enabled: boolean) =>
      enqueue(async () => {
        await storage.setAuto(enabled);
        auto.current = enabled;
        setAutoSync(enabled);
        if (!enabled) setSyncStatus('local');
      }),
    [enqueue],
  );
  // Only sync after a quiet edit interval. Queue ordering avoids IO races.
  useEffect(() => {
    if (!doc || !autoSync || conflict) return;
    const timer = setTimeout(() => {
      void sync();
    }, 1200);
    return () => clearTimeout(timer);
  }, [doc?.revision, autoSync, conflict, sync]);
  const templateKey = doc ? JSON.stringify([doc.data.habits, doc.data.settings.language]) : '';
  useEffect(() => {
    if (!current.current) return;
    void refreshReminders(current.current.data).catch(() => setSyncStatus('notificationError'));
  }, [templateKey]);
  useEffect(() => {
    const tick = () => {
      setClock((n) => n + 1);
      void mutate((s) => rollover(s));
      if (current.current) void refreshReminders(current.current.data).catch(() => undefined);
      if (auto.current) void sync();
    };
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') tick();
    });
    // Refresh at midnight even if the app stays foreground across day/week.
    let last = dateKey();
    const timer = setInterval(() => {
      const next = dateKey();
      if (next !== last) {
        last = next;
        tick();
      }
    }, 15000);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, [mutate, sync]);
  if (loadError)
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 32, backgroundColor: '#F5F4F0' }}>
        <Text>{translate(systemLanguage())('storageError')}</Text>
        <Pressable onPress={() => void load()}>
          <Text style={{ marginTop: 24 }}>{translate(systemLanguage())('retry')}</Text>
        </Pressable>
      </View>
    );
  if (!doc)
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  return (
    <Context.Provider
      value={{
        data: doc.data,
        busy,
        autoSync,
        syncStatus,
        conflict,
        mutate,
        sync,
        enableSync,
        t: translate(doc.data.settings.language),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useApp(): Store {
  const ctx = useContext(Context);
  if (!ctx) throw new Error('Missing AppProvider');
  return ctx;
}
export function errorKey(error: unknown): TextKey {
  if (error instanceof RuleError) return error.code;
  if (
    error instanceof Error &&
    ['notificationDenied', 'notificationError', 'csvUnavailable'].includes(error.message)
  )
    return error.message as TextKey;
  return 'error';
}
