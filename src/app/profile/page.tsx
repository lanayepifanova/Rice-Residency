import { SideNav } from "../components/SideNav";
import { SiteHeader } from "../components/SiteHeader";

export default function ProfilePage() {
  return (
    <>
      <SiteHeader />
      <SideNav />
      <main>
        <section className="profile-photo-section">
          <form method="post" action="/api/profile/photo" encType="multipart/form-data">
            <fieldset>
              <legend>Profile picture</legend>

              <label className="profile-photo-upload">
                <span className="profile-photo-large" aria-hidden="true">
                  L
                </span>
                <input name="photo" type="file" accept="image/*" />
              </label>
            </fieldset>

            <fieldset>
              <legend>Profile details</legend>

              <label>
                Name
                <input name="name" defaultValue="Lana Yepifanova" required />
              </label>

              <label>
                Username
                <input name="username" defaultValue="lanayepifanova" required />
              </label>

              <label>
                Instagram
                <input name="instagram" placeholder="instagram.com/lanayepifanova" />
              </label>

              <label>
                Twitter
                <input name="twitter" placeholder="x.com/lanayepifanova" />
              </label>

              <label>
                Quick description
                <textarea name="description" placeholder="A short note about you." />
              </label>

              <label>
                Birthday
                <input name="birthday" type="date" />
              </label>

              <label>
                Join date
                <input name="joinDate" type="date" defaultValue="2026-08-11" />
              </label>

              <button type="submit">Save profile</button>
            </fieldset>
          </form>
        </section>
      </main>
    </>
  );
}
