export type DemoEvent = {
  id: string;
  title: string;
  meta: string;
  group: "Upcoming events" | "Events you are hosting" | "Events you attended";
};

export const demoEvents: DemoEvent[] = [
  { id: "weekly-run-club", title: "Weekly Run Club", meta: "Mon 6:30 PM", group: "Upcoming events" },
  { id: "founders-dinner", title: "Founders Dinner", meta: "Thu 8:00 PM", group: "Upcoming events" },
  { id: "saturday-market-walk", title: "Saturday Market Walk", meta: "Sat 10:00 AM", group: "Upcoming events" },
  { id: "design-crit", title: "Design Crit", meta: "Every 2 weeks", group: "Events you are hosting" },
  { id: "neighborhood-coffee", title: "Neighborhood Coffee", meta: "First Friday", group: "Events you are hosting" },
  { id: "book-swap", title: "Book Swap", meta: "Monthly", group: "Events you are hosting" },
  { id: "gallery-opening", title: "Gallery Opening", meta: "Yesterday", group: "Events you attended" },
  { id: "morning-yoga", title: "Morning Yoga", meta: "Last Sunday", group: "Events you attended" },
  { id: "community-potluck", title: "Community Potluck", meta: "Last month", group: "Events you attended" },
];

export function getDemoEvent(eventId: string): DemoEvent | undefined {
  return demoEvents.find((event) => event.id === eventId);
}
