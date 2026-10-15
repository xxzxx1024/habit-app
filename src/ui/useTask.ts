import { useRef, useState } from 'react';
import { useApp, errorKey } from '../state/AppProvider';
import { notify } from './components';
/** Synchronous ref guards the small gap before React updates disabled buttons. */
export function useTask() {
  const { t } = useApp(),
    lock = useRef(false),
    [pending, setPending] = useState(false);
  const run = async (fn: () => Promise<void>) => {
    if (lock.current) return;
    lock.current = true;
    setPending(true);
    try {
      await fn();
    } catch (e) {
      notify(t('error'), t(errorKey(e)));
    } finally {
      lock.current = false;
      setPending(false);
    }
  };
  return { run, pending };
}
