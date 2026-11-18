export const log = (...args) => console.log(new Date().toISOString(), ...args);
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
