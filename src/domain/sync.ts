import { Document } from './model';
/** Immutable cloud snapshots form a DAG. A resolving snapshot references ALL
 * visible heads. Concurrent offline writes create branches, never overwrite
 * each other. A subsequent sync asks the user to resolve multiple heads. */
export interface CloudSnapshot {
  parents: string[];
  document: Document;
}
export type SyncDecision = 'equal' | 'upload' | 'download' | 'conflict';
/** 基线是本机最后一次成功同步的云版本。只有一边相对基线修改时才自动
 * 上传/下载；没有基线或者出现分支时必须让用户决定，禁止时间戳静默覆盖。 */
export function decideSync(
  local: Document,
  heads: CloudSnapshot[],
  base: string | null,
): SyncDecision {
  if (heads.length > 1) return 'conflict';
  const remote = heads[0]?.document;
  if (!remote) return 'upload';
  if (local.revision === remote.revision) return 'equal';
  if (remote.revision === base) return 'upload';
  if (local.revision === base) return 'download';
  return 'conflict';
}
export function cloudHeads(snapshots: CloudSnapshot[]): CloudSnapshot[] {
  const parents = new Set(snapshots.flatMap((x) => x.parents));
  return snapshots.filter((x) => !parents.has(x.document.revision));
}
