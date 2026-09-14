import { readFileSync } from 'node:fs';
import { SUPERVISED_CONCURRENCY_LEVELS, runSupervisedConcurrencyValidation } from '../src/plazaConcurrencyValidation.ts';

const map = JSON.parse(readFileSync(new URL('../public/maps/plaza-park-v2.tmj', import.meta.url), 'utf8'));
const results = SUPERVISED_CONCURRENCY_LEVELS.map(level => runSupervisedConcurrencyValidation(map, level));
console.log(JSON.stringify(results, null, 2));
