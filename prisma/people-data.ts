/**
 * The house directory: who lives here, and who comes to cowork.
 *
 * Two lists, because the house draws that line and the app should show it. A
 * name appearing in both is a resident — residents come to the sessions too, so
 * the coworking list picks them up, and the residents list is the authority.
 *
 * Most people here have no email. They are directory entries, not accounts: the
 * house knows them, and they have never signed in. `email` is set only where a
 * real address is known, since it is the key sign-in is keyed on and inventing
 * one would put fiction in that column.
 */

export type Person = {
  name: string;
  /** Only where a real address is known. */
  email?: string;
  /** Overrides the handle derived from the name. */
  username?: string;
};

/** Lives at Rice Residency. */
export const residents: Person[] = [
  { name: "Lana Yepifanova", username: "lana", email: "lana@example.com" },
  { name: "Halbert Kim" },
  { name: "Jun Lee" },
  { name: "Adam Towner" },
  { name: "Catherine Zhou" },
  { name: "Gavin Firestone" },
  { name: "Howard Zhao" },
  { name: "Jocelyn Lass" },
  { name: "Manuel Ponce" },
  { name: "Nathan Kwon" },
  { name: "Nolan Connolly" },
  { name: "Saul Brauns" },
  // Listed in the coworking export only as tangsc@stanford.edu, confirmed as
  // Chris Tang — the same Chris who appears throughout the card-game results.
  { name: "Chris Tang", email: "tangsc@stanford.edu" },
];

/**
 * Comes to coworking without living here.
 *
 * Residents have been removed from this list rather than repeated: everyone who
 * appeared in both exports is above, and the twelve names that overlapped are
 * not duplicated here.
 */
export const attendees: Person[] = [
  { name: "Abu-Hurairah Balogun" },
  { name: "Adam Siwek" },
  { name: "Adhira Tippur" },
  { name: "Adonai Kidane" },
  { name: "Amelia Davis" },
  { name: "Andrew Chu" },
  { name: "Andrew Mao" },
  { name: "Benjamin Alcott" },
  { name: "Benjamin Guo" },
  { name: "Blake Brown" },
  { name: "Brett Barron" },
  { name: "Brian Zhang" },
  { name: "Chad Diao" },
  { name: "Chelsey Chan" },
  { name: "Chloe Diehl" },
  { name: "Christian Dominguez" },
  { name: "Cindy Zhang" },
  { name: "Daniel Kuo" },
  { name: "Darshon Singh" },
  { name: "Demetris Chrysostomou" },
  { name: "Didi Jack" },
  { name: "Diego Rico" },
  { name: "Edison Won" },
  { name: "Emmie Casey" },
  { name: "Ethan Harjabrata" },
  { name: "Hemesh Chadalavada" },
  { name: "Ioan-Alexandru Mirica" },
  { name: "Ishaan Sinha" },
  { name: "Jack Lu" },
  { name: "Jeffery Liu" },
  { name: "Jiong Li" },
  { name: "Kaitlyn Kirt" },
  { name: "Luke Tjiong" },
  { name: "Mac Ajwani" },
  { name: "Madhavan Vinod" },
  { name: "Malachy Pearlman" },
  { name: "McKinley Garner" },
  { name: "Mert Çulcu" },
  { name: "Micayla Pang" },
  { name: "Michael Gonzalez McNeil" },
  { name: "Mika Chang" },
  { name: "Mike Zhang" },
  { name: "Milan Cohen Camarena" },
  { name: "Muyiwa Ogunsola" },
  { name: "Nick Hu" },
  { name: "Paul Eakin" },
  { name: "Risus Zhao" },
  // Listed in the coworking export only as ssnajjar05@gmail.com.
  { name: "Saleem Najjar", email: "ssnajjar05@gmail.com" },
  { name: "Sanjana Kavula" },
  { name: "Sathya Padmanabhan" },
  { name: "Siiri Einio" },
  { name: "Stella Chen" },
  { name: "Tony Nguyen" },
  { name: "Vismay Ravikumar" },
  { name: "Yash Bali" },
];

/**
 * People the seed invented before the house directory was real. Removed by
 * name so a real person can never be caught by a broad rule — deleting anyone
 * whose address ends in @example.com would take Lana with it.
 */
export const retiredDemoUsernames = [
  "maya",
  "theo",
  "nina",
  "amara",
  "sofia",
  "julian",
  "kai",
];

/**
 * A handle from a name: lowercased, accents folded, everything else hyphenated.
 * "Mert Çulcu" becomes "mert-culcu", so the profile URL is typeable.
 */
export function usernameFor(person: Person): string {
  if (person.username) {
    return person.username;
  }

  return person.name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
