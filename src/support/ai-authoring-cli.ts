import { approveBundle, createPlanBundle, implementBundle } from './ai-authoring/workflow';

function getArgValues(args: string[], flag: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === flag && args[index + 1]) {
      values.push(args[index + 1]);
      index += 1;
    }
  }
  return values;
}

function getArgValue(args: string[], flag: string): string | undefined {
  return getArgValues(args, flag)[0];
}

function printHelp(): void {
  console.log(
    [
      '',
      'Testonaut AI Authoring CLI',
      '==========================',
      '',
      '  plan       Create a normalized source bundle, coverage analysis, and reviewable test plan',
      '             npm run ai:plan -- --source GL-123 --source https://.../browse/GL-456 [--out my-bundle]',
      '',
      '  approve    Mark a proposed bundle as approved',
      '             npm run ai:approve -- --from my-bundle',
      '',
      '  implement  Generate approved repo artifacts from a bundle',
      '             npm run ai:implement -- --from my-bundle',
      '',
    ].join('\n'),
  );
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const action = args[0];

  if (action === 'plan') {
    const sources = getArgValues(args, '--source');
    const outputSlug = getArgValue(args, '--out');
    const { bundle, paths } = await createPlanBundle(sources, outputSlug);

    console.log(`\nBundle created: ${bundle.slug}`);
    console.log(`Status: ${bundle.status}`);
    console.log(`Bundle: ${paths.bundlePath}`);
    console.log(`Source context: ${paths.sourceContextPath}`);
    console.log(`Coverage analysis: ${paths.coveragePath}`);
    console.log(`Test plan: ${paths.planPath}`);
    return;
  }

  if (action === 'approve') {
    const from = getArgValue(args, '--from');
    if (!from) {
      throw new Error('`--from <slug-or-path>` is required for ai:approve.');
    }

    const { bundle, paths } = approveBundle(from);
    console.log(`\nBundle approved: ${bundle.slug}`);
    console.log(`Status: ${bundle.status}`);
    console.log(`Bundle: ${paths.bundlePath}`);
    return;
  }

  if (action === 'implement') {
    const from = getArgValue(args, '--from');
    if (!from) {
      throw new Error('`--from <slug-or-path>` is required for ai:implement.');
    }

    const { bundle, paths } = await implementBundle(from);
    console.log(`\nBundle processed: ${bundle.slug}`);
    console.log(`Status: ${bundle.status}`);
    console.log(`Bundle: ${paths.bundlePath}`);
    if (bundle.implementation?.wroteFiles?.length) {
      console.log(`Wrote files: ${bundle.implementation.wroteFiles.join(', ')}`);
    }
    if (bundle.implementation?.blockers.length) {
      console.log(`Blockers: ${bundle.implementation.blockers.join(' | ')}`);
    }
    console.log(`Implementation preview: ${paths.implementationPreviewPath}`);
    return;
  }

  printHelp();
}

main().catch((error: Error) => {
  console.error(`\nAI authoring command failed: ${error.message}`);
  process.exit(1);
});
