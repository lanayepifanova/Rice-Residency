import { SideNav } from "../components/SideNav";
import { SiteHeader } from "../components/SiteHeader";

export default function ProfilePage() {
  return (
    <>
      <SiteHeader />
      <SideNav />
      <main>
        <h1>Profile</h1>

        <section className="profile-photo-section">
          <div className="profile-photo-large" aria-hidden="true">
            L
          </div>

          <form method="post" action="/api/profile/photo" encType="multipart/form-data">
            <fieldset>
              <legend>Profile picture</legend>

              <label>
                Photo
                <input name="photo" type="file" accept="image/*" required />
              </label>

              <button type="submit">Upload photo</button>
            </fieldset>
          </form>
        </section>
      </main>
    </>
  );
}
