import { remark } from 'remark';
import type { Code, Root } from 'mdast';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
// @ts-ignore
import flatmap from 'unist-util-flatmap';
import { globby } from 'globby';
import { join, dirname } from 'path';
import { exec } from 'child_process';

const verify = process.argv.includes('--verify');
let fileChanged = false;
// Possible Improvement: combine with lint-staged to only copy files that have changed
const prepareOutFile = (file: string): string => {
  const outFile = join('docs', file.replace('src/docs/', ''));
  mkdirSync(dirname(outFile), { recursive: true });
  return outFile;
};

const verifyAndCopy = (file: string, content?: string) => {
  const outFile = prepareOutFile(file);
  const existingBuffer = existsSync(outFile) ? readFileSync(outFile) : Buffer.from('#NEW FILE#');
  const newBuffer = content ? Buffer.from(content) : readFileSync(file);
  if (existingBuffer.equals(newBuffer)) {
    // Files are same, skip.
    return;
  }
  console.log(`File changed: ${outFile}`);
  fileChanged = true;
  if (!verify) {
    writeFileSync(outFile, newBuffer);
  }
};

const transform = (file: string) => {
  const doc = readFileSync(file, 'utf8');
  const ast: Root = remark.parse(doc);
  const out = flatmap(ast, (c: Code) => {
    if (c.type !== 'code' || !c.lang?.startsWith('mermaid')) {
      return [c];
    }
    if (c.lang === 'mermaid' || c.lang === 'mmd') {
      c.lang = 'mermaid-example';
    }
    return [c, Object.assign({}, c, { lang: 'mermaid' })];
  });

  const transformed = `# THIS IS AN AUTOGENERATED FILE. DO NOT EDIT. Please edit corresponding file in src/docs.\n${remark.stringify(
    out
  )}`;
  verifyAndCopy(file, transformed);
};

(async () => {
  const mdFiles = await globby(['./src/docs/**/*.md']);
  mdFiles.forEach(transform);
  const nonMDFiles = await globby(['src/docs/**', '!**/*.md']);
  nonMDFiles.forEach((file) => {
    verifyAndCopy(file);
  });
  if (fileChanged) {
    if (verify) {
      console.log(
        "Changes detected in files in `docs`. Please run `yarn docs:build` after making changes to 'src/docs' to update the `docs` folder."
      );
      process.exit(1);
    }
    console.log('Committing changes to the docs folder');
    exec('git add docs');
  }
})();
