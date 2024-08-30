const { pathsToModuleNameMapper } = require('ts-jest');
const { compilerOptions } = require('./tsconfig.json');

module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  preset: 'ts-jest/presets/default-esm',
  testMatch: ['**/*.test.ts'],

  // isolatedModules: true speeds up jest
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { isolatedModules: true, useESM: true } ]
  },
  extensionsToTreatAsEsm: ['.ts'],

  // moduleNameMapper allows for aliasing paths in tsconfig.json, e.g. "@app/*": ["src/*"]
  // moduleNameMapper: pathsToModuleNameMapper(compilerOptions.paths),
  // modulePaths: [compilerOptions.baseUrl],
  modulePathIgnorePatterns: ['cdk.out', 'dist', 'node_modules'],
};
