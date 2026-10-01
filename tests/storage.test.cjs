const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// An IndexedDB event-contract fixture: request success precedes transaction
// completion, and a successful request can still belong to an aborted commit.
function fixture() {
  const state = { records: new Map(), abortNext: false };
  const db = {
    createObjectStore() {}, close() {},
    transaction() {
      const staged = new Map(state.records);
      const tx = {};
      function request(operation) {
        const req = {};
        queueMicrotask(() => {
          req.result = operation(); req.onsuccess?.();
          queueMicrotask(() => {
            if (state.abortNext) {
              state.abortNext = false;
              tx.error = new Error('Quota exceeded at commit'); tx.onabort?.();
            } else {
              state.records = staged; tx.oncomplete?.();
            }
          });
        });
        return req;
      }
      tx.objectStore = () => ({
        put(record) { return request(() => { staged.set(record.id, record); return record.id; }); },
        getAll() { return request(() => [...staged.values()]); },
        delete(id) { return request(() => { staged.delete(id); }); }
      });
      return tx;
    }
  };
  const context = { window: {}, indexedDB: { open() {
    const req = { result: db };
    queueMicrotask(() => { req.onupgradeneeded?.(); req.onsuccess?.(); });
    return req;
  } } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../js/storage.js'), 'utf8'), context);
  return { store: context.window.NieveStorage, state };
}

test('a saved version retains its source blob and settings, ordered newest first', async () => {
  const { store } = fixture();
  const blob = new Blob(['source-image-fixture'], { type: 'image/png' });
  await store.saveVersion({ id: 'first', createdAt: 1, imageBlob: blob, settings: { headSize: 0.4 } });
  await store.saveVersion({ id: 'second', createdAt: 2, imageBlob: blob, settings: { height: 0.6 } });
  const versions = await store.listVersions();
  assert.equal(versions[0].id, 'second');
  assert.equal(versions[1].settings.headSize, 0.4);
  assert.equal(await versions[1].imageBlob.text(), 'source-image-fixture');
});

test('request success followed by a failed commit rejects instead of claiming save success', async () => {
  const { store, state } = fixture();
  state.abortNext = true;
  await assert.rejects(store.saveVersion({ id: 'failed', createdAt: 1 }), /Quota exceeded/);
  assert.equal(state.records.size, 0);
});

test('delete removes the selected version while preserving another version and source', async () => {
  const { store } = fixture();
  await store.saveVersion({ id: 'keep', createdAt: 1, imageBlob: new Blob(['keep']) });
  await store.saveVersion({ id: 'delete', createdAt: 2, imageBlob: new Blob(['delete']) });
  await store.deleteVersion('delete');
  const versions = await store.listVersions();
  assert.equal(versions.length, 1);
  assert.equal(versions[0].id, 'keep');
  assert.equal(await versions[0].imageBlob.text(), 'keep');
});
