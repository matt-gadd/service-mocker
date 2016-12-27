import { AssertionError } from 'chai';
import { TestCase, Suite } from './mocha-suite';

const start = mocha.run.bind(mocha);
(mocha as any).run = () => null;

/**
 * Client tests runner:
 *
 * 1. Fetch server test cases
 * 2. Register tests(if any) into mocha
 * 3. Fetch results from server
 * 4. Reflect results to mocha
 */
export async function clientRunner(client) {
  const res = await client.sendMessage({
    request: 'MOCHA_TASKS',
  });

  (mocha as any).run = start;

  registerTest(res.suites);
  start();

  return client.sendMessage({
    request: 'MOCHA_RESULTS',
  });
}

function registerTest(suites?: Array<Suite>) {
  // suites should be empty when running in legacy mode
  if (!suites || !suites.length) {
    return;
  }

  suites.forEach(({ title, tests, nestSuites }) => {
    describe(title, () => {
      tests.forEach(addCase);

      registerTest(nestSuites);
    });
  });
}

function addCase(test: TestCase) {
  const promise = new Promise((resolve, reject) => {
    navigator.serviceWorker.addEventListener('message', function handler({ data }) {
      if (!data || data.testTitle !== test.expect) {
        return;
      }

      // one-off listener
      navigator.serviceWorker.removeEventListener('message', handler);

      if (data.error) {
        // reflect error to `AssertionError`
        const err = new AssertionError(data.error.message, data.error);
        err.stack = data.error.stack;

        reject(err);
      } else {
        resolve();
      }
    });
  });

  // register to mocha
  it(test.expect, () => promise);
}
