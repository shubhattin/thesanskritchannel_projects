import { nanoid } from 'nanoid';

/** One message waiting for the in-flight reply to finish. Text only: the composer is text-only. */
export interface QueuedMessage {
  id: string;
  text: string;
}

/**
 * Client-side outbox for the agent chat. While a reply streams, new messages pile up here
 * and are sent one at a time as each run finishes normally. Plain data (no Svelte runes) so
 * it stays unit-testable; AgentChat holds the instance in `$state` for reactivity.
 */
export class MessageQueue {
  items: QueuedMessage[] = [];

  get size(): number {
    return this.items.length;
  }

  enqueue(text: string): QueuedMessage {
    const item: QueuedMessage = { id: nanoid(10), text };
    this.items.push(item);
    return item;
  }

  remove(id: string): void {
    const index = this.items.findIndex((item) => item.id === id);
    if (index !== -1) this.items.splice(index, 1);
  }

  /** Remove and return the head of the queue. */
  shift(): QueuedMessage | undefined {
    return this.items.shift();
  }

  clear(): void {
    this.items.length = 0;
  }
}
