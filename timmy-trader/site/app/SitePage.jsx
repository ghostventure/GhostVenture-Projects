import { readFileSync } from "node:fs";
import path from "node:path";

const contentDirectory = path.join(process.cwd(), "content", "pages");

function readSource(filename) {
  return readFileSync(path.join(contentDirectory, filename), "utf8");
}

export function getSiteMetadata(filename) {
  const source = readSource(filename);
  const title = source.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim();
  const description = source.match(
    /<meta\s+name="description"\s+content="([^"]*)"/i,
  )?.[1];

  return {
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
  };
}

export default function SitePage({ filename }) {
  const source = readSource(filename);
  const body = source.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1];
  if (!body) {
    throw new Error(`The static page ${filename} has no body element.`);
  }

  const styles = [...source.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map(
    (match) => match[1],
  );
  const content = body.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");

  return (
    <>
      {styles.map((css, index) => (
        <style key={`${filename}-style-${index}`} dangerouslySetInnerHTML={{ __html: css }} />
      ))}
      <div dangerouslySetInnerHTML={{ __html: content }} />
    </>
  );
}
