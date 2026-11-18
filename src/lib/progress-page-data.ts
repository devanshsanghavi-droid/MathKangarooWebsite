import { getAllProblems, getAllSkills } from './content';
import { getAllAmcProblems, getAmcTaxonomy } from './amc-content';
import { getAllTestProblems, getTestTaxonomy } from './test-content';
import { amcBankSpec, kangarooBankSpec, testBankSpec } from './progress-banks';
import type { BankSpec } from './progress-analytics';

/**
 * The four bank descriptions /progress ships, read from content at build time. BUILD-TIME
 * ONLY (the content layers read the disk); call it from the statically generated page.
 */
export function progressBanks(): BankSpec[] {
  return [
    kangarooBankSpec(getAllSkills(), getAllProblems()),
    amcBankSpec(getAmcTaxonomy(), getAllAmcProblems()),
    testBankSpec(getTestTaxonomy('SAT'), getAllTestProblems('SAT')),
    testBankSpec(getTestTaxonomy('ACT'), getAllTestProblems('ACT')),
  ];
}
