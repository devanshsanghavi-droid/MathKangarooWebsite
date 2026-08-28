/**
 * Test stub for the `server-only` package.
 *
 * `server-only` throws when it is resolved outside a React Server Component bundle, which is
 * exactly what we want in production and exactly wrong in Vitest: the content layer is a
 * synchronous, filesystem-backed module that is perfectly testable in Node. Both Vitest
 * configs alias the package to this file, so the production guarantee is kept and the tests
 * can still import the modules that carry it.
 */
export {};
