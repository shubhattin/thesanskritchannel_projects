## What you <lipi>पूर्ण</lipi>

| Step | Action |
| --- | --- |
| 1 | Edit `src/content/lekha_list.json <lipi>पूर्णात्</lipi>`  to set post order |
| 2 | Add `your-slug.json` under `src/content/lekha/` |
| 3 | Later, swap the loader to load the same shape from a database |

Put long **Markdown** in `src/content/lekha_md/<name>.md` and set `"content": "<name>.md"` in the post JSON. Otherwise keep inline Markdown in the `content` field.

The `content` field is **Markdown** (GFM tables, lists, emphasis, etc.). Code blocks render as plain text for now (no syntax highlighting).

Happy writing.
