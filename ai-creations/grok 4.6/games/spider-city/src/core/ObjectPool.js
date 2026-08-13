/* core/ObjectPool.js — zero-allocation-in-loop helpers.
   Used for impact FX, web lines, debris, projectiles, damage numbers. */

export class ObjectPool {
  constructor(factory, reset, initial = 0) {
    this.factory = factory;
    this.reset = reset || (() => {});
    this.free = [];
    this.live = [];
    for (let i = 0; i < initial; i++) this.free.push(factory());
  }
  acquire() {
    const o = this.free.pop() || this.factory();
    this.live.push(o);
    return o;
  }
  release(o) {
    const i = this.live.indexOf(o);
    if (i >= 0) this.live.splice(i, 1);
    this.reset(o);
    this.free.push(o);
  }
  releaseAll() {
    while (this.live.length) this.release(this.live[this.live.length - 1]);
  }
  get activeCount() { return this.live.length; }
}

/** Fixed-capacity ring of structs — never grows, never allocates after init. */
export class Ring {
  constructor(capacity, factory) {
    this.capacity = capacity;
    this.items = new Array(capacity);
    for (let i = 0; i < capacity; i++) this.items[i] = factory(i);
    this.head = 0;
  }
  next() {
    const it = this.items[this.head];
    this.head = (this.head + 1) % this.capacity;
    return it;
  }
  forEach(fn) { for (let i = 0; i < this.capacity; i++) fn(this.items[i], i); }
}
