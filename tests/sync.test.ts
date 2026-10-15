import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cloudHeads, CloudSnapshot, decideSync } from '../src/domain/sync';
import { initialData } from '../src/domain/engine';
import { Document } from '../src/domain/model';
const doc = (revision: string): Document => ({
  revision,
  updatedAt: '2026-10-15T12:00:00.000Z',
  data: initialData(),
});
const snap = (revision: string, parents: string[] = []): CloudSnapshot => ({
  document: doc(revision),
  parents,
});
test('empty cloud uploads; identical revisions do nothing', () => {
  assert.equal(decideSync(doc('a'), [], null), 'upload');
  assert.equal(decideSync(doc('a'), [snap('a')], null), 'equal');
});
test('only local changes upload, only remote changes download', () => {
  assert.equal(decideSync(doc('b'), [snap('a')], 'a'), 'upload');
  assert.equal(decideSync(doc('a'), [snap('b')], 'a'), 'download');
});
test('divergent edits and unknown baseline require explicit resolution', () => {
  assert.equal(decideSync(doc('b'), [snap('c')], 'a'), 'conflict');
  assert.equal(decideSync(doc('b'), [snap('c')], null), 'conflict');
});
test('immutable DAG keeps offline branches until a resolving snapshot joins all heads', () => {
  const snapshots = [snap('a'), snap('b', ['a']), snap('c', ['a'])];
  assert.deepEqual(
    cloudHeads(snapshots).map((x) => x.document.revision),
    ['b', 'c'],
  );
  assert.equal(decideSync(doc('b'), cloudHeads(snapshots), 'a'), 'conflict');
  snapshots.push(snap('d', ['b', 'c']));
  assert.deepEqual(
    cloudHeads(snapshots).map((x) => x.document.revision),
    ['d'],
  );
});
test('a delayed offline branch still surfaces after another device resolved', () => {
  const snapshots = [
    snap('a'),
    snap('b', ['a']),
    snap('c', ['a']),
    snap('d', ['b', 'c']),
    snap('e', ['b']),
  ];
  assert.deepEqual(
    cloudHeads(snapshots).map((x) => x.document.revision),
    ['d', 'e'],
  );
});
