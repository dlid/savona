export function newUniqueId(length: number = 6): string {
    return Math.random().toString(20).substr(2, 6);
}
