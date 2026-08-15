export const eventImagePool = [
  "/photos/event-images/image-01.jpeg",
  "/photos/event-images/image-02.jpeg",
  "/photos/event-images/image-03.jpeg",
  "/photos/event-images/image-04.jpeg",
  "/photos/event-images/image-05.jpeg",
  "/photos/event-images/image-06.jpeg",
  "/photos/event-images/image-07.jpeg",
  "/photos/event-images/image-08.jpeg",
  "/photos/event-images/image-09.jpeg",
  "/photos/event-images/image-10.jpeg",
  "/photos/event-images/image-11.jpeg",
  "/photos/event-images/image-12.jpeg",
  "/photos/event-images/image-13.jpeg",
  "/photos/event-images/image-14.jpeg",
  "/photos/event-images/image-15.jpeg",
  "/photos/event-images/image-16.jpeg",
  "/photos/event-images/image-17.jpeg",
  "/photos/event-images/image-18.jpeg",
  "/photos/event-images/image-19.jpeg",
  "/photos/event-images/image-20.jpeg",
  "/photos/event-images/image-21.png",
  "/photos/event-images/image-22.jpeg",
  "/photos/event-images/image-23.jpeg",
  "/photos/event-images/image-24.jpeg",
  "/photos/event-images/image-25.jpeg",
  "/photos/event-images/image-26.jpeg",
  "/photos/event-images/image-27.jpeg",
  "/photos/event-images/image-28.jpeg",
  "/photos/event-images/image-29.jpeg",
  "/photos/event-images/image-30.jpeg",
  "/photos/event-images/image-31.jpeg",
];

/**
 * The cover for a series that has none of its own. Derived from the series id
 * so the same event always shows the same picture — a random pick per render
 * would make the grid flicker on every navigation.
 */
export function coverImageFor(seriesId: string, explicit?: string | null): string {
  if (explicit) {
    return explicit;
  }

  let hash = 0;
  for (let index = 0; index < seriesId.length; index += 1) {
    hash = (hash * 31 + seriesId.charCodeAt(index)) % 2147483647;
  }

  return eventImagePool[hash % eventImagePool.length];
}

export function assignEventImages<T>(items: T[]): Array<T & { image: string }> {
  const shuffledImages = shuffleWithSeed(eventImagePool, 1729);

  return items.map((item, index) => ({
    ...item,
    image: shuffledImages[index % shuffledImages.length],
  }));
}

function shuffleWithSeed<T>(items: T[], seed: number): T[] {
  const shuffled = [...items];
  let state = seed;

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    state = (state * 1664525 + 1013904223) % 4294967296;
    const swapIndex = state % (index + 1);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}
