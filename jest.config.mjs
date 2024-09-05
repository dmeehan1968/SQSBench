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
    '^.+\\.m?tsx?$': ['ts-jest', { isolatedModules: true, useESM: true } ]
  },

  modulePathIgnorePatterns: ['cdk.out', 'dist', 'node_modules'],
}