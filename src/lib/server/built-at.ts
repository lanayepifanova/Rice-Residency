/**
 * When this build ran.
 *
 * Read once, at module load, rather than per page. Two reasons: every page gets
 * the same stamp, so the whole site agrees on which moment it was built at; and
 * reading the clock inside a component is a side effect during render, which is
 * exactly the thing React's purity rule objects to.
 *
 * The pages hand this to the client components that decide what has already
 * happened. See `useReaderNow` for what they do with it.
 */
export const BUILT_AT = Date.now();
