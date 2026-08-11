import { SiteHeader } from "../../components/SiteHeader";
import { SideNav } from "../../components/SideNav";

const weekdays = [
  ["MO", "Monday"],
  ["TU", "Tuesday"],
  ["WE", "Wednesday"],
  ["TH", "Thursday"],
  ["FR", "Friday"],
  ["SA", "Saturday"],
  ["SU", "Sunday"],
];

export default function NewEventPage() {
  return (
    <>
      <SiteHeader />
      <SideNav />
      <main>
        <h1>Create recurring event</h1>

        <form method="post" action="/api/event-series">
          <fieldset>
            <legend>Event</legend>

            <label>
              Title
              <input name="title" defaultValue="Weekly Run Club" required />
            </label>

            <label>
              Location
              <input name="locationName" defaultValue="Riverside Park" />
            </label>

            <label>
              Invites
              <textarea
                name="inviteEmails"
                placeholder="maya@example.com, jordan@example.com&#10;sam@example.com"
              />
            </label>

            <label>
              Capacity
              <input name="capacity" type="number" min="1" defaultValue="20" />
            </label>

            <label>
              Description
              <textarea name="description" defaultValue="Meet by the park entrance." />
            </label>
          </fieldset>

          <fieldset>
            <legend>Schedule</legend>

            <label>
              Timezone
              <input name="timezone" defaultValue="America/New_York" required />
            </label>

            <label>
              Starts
              <input name="startsAtLocal" type="datetime-local" defaultValue="2026-09-07T18:30" required />
            </label>

            <label>
              Duration minutes
              <input name="durationMinutes" type="number" min="1" defaultValue="60" required />
            </label>
          </fieldset>

          <fieldset>
            <legend>Recurrence</legend>

            <label>
              Frequency
              <select name="freq" defaultValue="weekly">
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </label>

            <label>
              Interval
              <input name="interval" type="number" min="1" defaultValue="1" required />
            </label>

            <div>
              <p>Weekdays</p>
              {weekdays.map(([value, label]) => (
                <label key={value} className="inline-label">
                  <input name="byDay" type="checkbox" value={value} defaultChecked={value === "MO"} />
                  {label}
                </label>
              ))}
            </div>

            <label>
              Until
              <input name="until" type="datetime-local" />
            </label>
          </fieldset>

          <fieldset>
            <legend>Attendance</legend>

            <label className="inline-label">
              <input name="waitlistEnabled" type="checkbox" defaultChecked />
              Waitlist enabled
            </label>
          </fieldset>

          <input name="visibility" type="hidden" value="public" />

          <button type="submit">Create event</button>
        </form>
      </main>
    </>
  );
}
