import { writeFileSync } from 'node:fs';
import { createDb } from '../packages/shared/src/db/harness';
import { generateTypes } from '../packages/shared/src/db/gen-types';

async function main() {
  const db = await createDb();
  writeFileSync('packages/shared/src/db/database.types.ts', await generateTypes(db));
  console.log('wrote packages/shared/src/db/database.types.ts');
}
void main();
