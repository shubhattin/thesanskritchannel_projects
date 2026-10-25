import DOMPurify from 'dompurify';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';

const processor = unified().use(remarkParse).use(remarkGfm).use(remarkRehype).use(rehypeStringify);

let hooked = false;

/**
 * Agent Markdown → sanitized HTML (browser only). Half-streamed Markdown renders as far as it
 * parses; links leaving the app open in a new tab.
 */
export function renderAgentMarkdown(markdown: string): string {
  if (!hooked) {
    DOMPurify.addHook('afterSanitizeAttributes', (node) => {
      if (node.tagName === 'A' && /^https?:\/\//i.test(node.getAttribute('href') ?? '')) {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
      }
    });
    hooked = true;
  }
  const html = String(processor.processSync(markdown));
  return DOMPurify.sanitize(html, { ADD_ATTR: ['target'] });
}
