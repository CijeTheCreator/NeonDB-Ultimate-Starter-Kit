module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.ts", "**/?(*.)+(spec|test).ts"],
  globals: {
    "ts-jest": {
      tsconfig: "./server/tsconfig.json",
    },
  },
};
