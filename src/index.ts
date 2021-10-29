export function oneWayOrAnother(str: string): string[] {
  // add runtime check for use in JavaScript
  if (typeof str !== 'string') {
    return [];
  }
  return[str];
}
