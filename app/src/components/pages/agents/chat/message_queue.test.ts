import { describe, expect, it } from 'vitest';
import { MessageQueue } from './message_queue';

describe('MessageQueue', () => {
  it('starts empty', () => {
    const queue = new MessageQueue();
    expect(queue.size).toBe(0);
    expect(queue.shift()).toBeUndefined();
  });

  it('enqueues in order and shifts from the head', () => {
    const queue = new MessageQueue();
    queue.enqueue('first');
    queue.enqueue('second');
    expect(queue.size).toBe(2);
    expect(queue.shift()?.text).toBe('first');
    expect(queue.shift()?.text).toBe('second');
    expect(queue.size).toBe(0);
    expect(queue.shift()).toBeUndefined();
  });

  it('gives every item a unique id', () => {
    const queue = new MessageQueue();
    const a = queue.enqueue('a');
    const b = queue.enqueue('b');
    expect(a.id).not.toBe(b.id);
  });

  it('removes an item without touching the rest', () => {
    const queue = new MessageQueue();
    const a = queue.enqueue('a');
    queue.enqueue('b');
    queue.remove(a.id);
    expect(queue.size).toBe(1);
    expect(queue.shift()?.text).toBe('b');
  });

  it('ignores removing an unknown id', () => {
    const queue = new MessageQueue();
    queue.enqueue('a');
    queue.remove('missing');
    expect(queue.size).toBe(1);
  });

  it('clears everything', () => {
    const queue = new MessageQueue();
    queue.enqueue('a');
    queue.enqueue('b');
    queue.clear();
    expect(queue.size).toBe(0);
  });
});
