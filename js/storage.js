(function (root) {
  'use strict';
  let database;
  async function open() {
    if (database) return database;
    database = await new Promise((resolve, reject) => {
      const request = indexedDB.open('nieve-character-studio', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('versions', { keyPath: 'id' });
      request.onsuccess = () => {
        request.result.onversionchange = () => { request.result.close(); database = undefined; };
        resolve(request.result);
      };
      request.onerror = () => reject(request.error || new Error('Browser storage is unavailable.'));
      request.onblocked = () => reject(new Error('Close other studio tabs and try saving again.'));
    });
    return database;
  }
  async function transaction(mode, operation) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('versions', mode);
      const request = operation(tx.objectStore('versions'));
      let result;
      request.onsuccess = () => { result = request.result; };
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(tx.error || request.error || new Error('Could not save to this browser.'));
      tx.onerror = () => reject(tx.error || request.error || new Error('Browser storage failed.'));
    });
  }
  root.NieveStorage = {
    saveVersion(record) { return transaction('readwrite', store => store.put(record)); },
    async listVersions() {
      const versions = await transaction('readonly', store => store.getAll());
      return versions.sort((a, b) => b.createdAt - a.createdAt);
    },
    deleteVersion(id) { return transaction('readwrite', store => store.delete(id)); }
  };
})(window);
