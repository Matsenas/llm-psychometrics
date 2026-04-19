/**
 * Exhaustiveness guard for discriminated unions. Call in the `default` branch
 * of a switch to get a compile-time error if a new variant is added but the
 * switch is not updated.
 */
export function assertNever(x: never): never {
  throw new Error(`Unhandled discriminant: ${JSON.stringify(x)}`);
}
