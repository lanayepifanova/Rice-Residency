import { SiteHeader } from "./components/SiteHeader";
import { SideNav } from "./components/SideNav";
import { demoEvents } from "@/lib/domain/demo-events";

const currentUser = {
  firstName: "Lana",
};

const eventGroups = [
  {
    title: "Upcoming events",
  },
  {
    title: "Events you are hosting",
  },
  {
    title: "Events you attended",
  },
];

export default function Home() {
  return (
    <>
      <SiteHeader />
      <SideNav />
      <main>
        <h1>Welcome Back {currentUser.firstName}</h1>

        {eventGroups.map((group) => (
          <section className="event-section" key={group.title}>
            <h2>{group.title}</h2>
            <div className="event-grid">
              {demoEvents
                .filter((event) => event.group === group.title)
                .map((event) => (
                  <a className="event-square" href={`/events/${event.id}`} key={event.id}>
                    <h3>{event.title}</h3>
                    <p>{event.meta}</p>
                  </a>
                ))}
            </div>
          </section>
        ))}
      </main>
    </>
  );
}
