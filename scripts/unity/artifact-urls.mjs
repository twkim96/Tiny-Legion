// Unity/browser caches must distinguish the code and data of each build.
export function versionArtifactUrls(html, hashes) {
  return html.replace(/(["'])Build\/([^"'?#]+)\1/g, (match, quote, name) => {
    const hash = hashes[`/unity/Build/${name}`];
    if (!hash) throw new Error(`Missing Unity artifact referenced by HTML: ${name}`);
    return `${quote}Build/${name}?v=${hash}${quote}`;
  });
}
