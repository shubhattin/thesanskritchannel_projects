import type { Icon, InputEnhancer, Plugin } from 'carta-md';
import type { Component } from 'svelte';
import { toggleHtmlTagWrap } from './toggleHtmlWrap';

type WrapTagBase = {
  id: string;
  label: string;
  component: Component;
  openTag: string;
  closeTag: string;
};

type WrapTagPluginOptions = WrapTagBase & {
  shortcut?: readonly string[];
};

function wrapTagAction(openTag: string, closeTag: string) {
  return (input: InputEnhancer) => {
    toggleHtmlTagWrap(input, openTag, closeTag);
  };
}

export function createWrapTagIcon(options: WrapTagBase): Icon {
  return {
    id: options.id,
    label: options.label,
    component: options.component,
    action: wrapTagAction(options.openTag, options.closeTag)
  };
}

export function createWrapTagPlugin(options: WrapTagPluginOptions): Plugin {
  const icon = createWrapTagIcon(options);
  return {
    icons: [icon],
    shortcuts: options.shortcut
      ? [
          {
            id: options.id,
            combination: new Set(options.shortcut),
            action: icon.action
          }
        ]
      : []
  };
}
