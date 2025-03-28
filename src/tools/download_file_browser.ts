import { fetch_get } from './fetch';

export const download_file_in_browser = (
  link: string,
  name: string,
  revoke_url_after_download = false
) => {
  const a = document.createElement('a');
  a.href = link;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  if (revoke_url_after_download) URL.revokeObjectURL(link);
};

export const download_external_file_in_browser = async (link: string, name: string) => {
  const req = await fetch_get('/api/stream_file', {
    params: {
      file_url: link
    }
  });
  const blob = await req.blob();
  const blob_url = window.URL.createObjectURL(blob);
  download_file_in_browser(blob_url, name, true);
};
