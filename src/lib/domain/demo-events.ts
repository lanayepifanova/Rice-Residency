import { assignEventImages } from "./event-images";

export type DemoEvent = {
  id: string;
  title: string;
  meta: string;
  host: string;
  description: string;
  image: string;
  group: "Upcoming events" | "Events you are hosting" | "Events you attended";
};

const eventSeed = [
  {
    id: "weekly-run-club",
    title: "Weekly Run Club",
    meta: "Monday 6:30pm",
    host: "Maya Chen",
    description: "A relaxed loop through the park with water breaks, stretching, and coffee after.",
    group: "Upcoming events",
  },
  {
    id: "founders-dinner",
    title: "Founders Dinner",
    meta: "Thursday 8:00pm",
    host: "Theo Ramirez",
    description: "A small table for people building new things to trade notes, introductions, and half-formed ideas.",
    group: "Upcoming events",
  },
  {
    id: "saturday-market-walk",
    title: "Saturday Market Walk",
    meta: "Saturday 10:00am",
    host: "Nina Patel",
    description: "Meet at the north entrance and wander the stalls together for flowers, fruit, and breakfast.",
    group: "Upcoming events",
  },
  {
    id: "design-crit",
    title: "Design Crit",
    meta: "Every 2 weeks",
    host: "Lana Yepifanova",
    description: "Bring one screen, one flow, or one messy problem. The group gives direct notes and useful references.",
    group: "Events you are hosting",
  },
  {
    id: "neighborhood-coffee",
    title: "Neighborhood Coffee",
    meta: "First Friday",
    host: "Lana Yepifanova",
    description: "A standing morning coffee for neighbors, friends, and anyone new nearby.",
    group: "Events you are hosting",
  },
  {
    id: "book-swap",
    title: "Book Swap",
    meta: "Monthly",
    host: "Lana Yepifanova",
    description: "Bring a book you liked, take one home, and stay for a short conversation about what everyone is reading.",
    group: "Events you are hosting",
  },
  {
    id: "gallery-opening",
    title: "Gallery Opening",
    meta: "Yesterday",
    host: "Amara Lewis",
    description: "An evening opening with new photography, soft music, and a few familiar faces.",
    group: "Events you attended",
  },
  {
    id: "morning-yoga",
    title: "Morning Yoga",
    meta: "Last Sunday",
    host: "Sofia Marin",
    description: "A gentle outdoor class focused on breath, balance, and waking up slowly.",
    group: "Events you attended",
  },
  {
    id: "community-potluck",
    title: "Community Potluck",
    meta: "Last month",
    host: "Julian Brooks",
    description: "A casual shared meal where everyone brings something simple and leaves with new names.",
    group: "Events you attended",
  },
] satisfies Array<Omit<DemoEvent, "image">>;

export const demoEvents: DemoEvent[] = assignEventImages(eventSeed);

export function getDemoEvent(eventId: string): DemoEvent | undefined {
  return demoEvents.find((event) => event.id === eventId);
}
