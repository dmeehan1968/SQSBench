export default {
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  preset: 'ts-jest',
  testMatch: ['**/*.test.mts', '**/*.test.ts'],
  moduleFileExtensions: ['js', 'mjs', 'mts'],
  moduleNameMapper: {
    // Remove the .mjs extension from relative imports
    '^(\\.{1,2}/.*)\\.mjs$': '$1',
  },
  transform: {
    // isolatedModules: true speeds up jest
    '^.+\\.m?[jt]sx?$': ['ts-jest', { isolatedModules: true, useESM: true } ]
  },
  transformIgnorePatterns: [
    /**
     * p-limit is used in an earlier CJS version in Jest, and the latest version of p-limit is ESM
     * which is used in the project. package.json uses an alias of p-limit-esm to get both versions
     * into node_modules.  yocto-queue is a sub-dependency of p-limit, and is also ESM.  Note the
     * transform above also needs to treat .js files as ESM.
     * This passes those packages through ts-jest to make them compatible with the project.
     */
    'node_modules/(?!(p-limit-esm|yocto-queue))'
  ],
  modulePathIgnorePatterns: ['cdk.out', 'dist', 'node_modules'],
  extensionsToTreatAsEsm: ['.mts'],
  setupFiles: [
    '<rootDir>/jest.setup.mts',
  ],
}