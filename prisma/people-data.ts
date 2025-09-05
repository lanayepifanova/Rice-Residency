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
  /** Runs the house. Residents only — set on the two people who do. */
  lead?: true;
  /**
   * Directory headshot under `public/people`, taken from the public site at
   * riceresidency.com. This is the house's photo of a person, not their own:
   * the seed only applies it to someone who has not set a photo themselves.
   */
  photo?: string;
  /**
   * What riceresidency.com says about someone. Same rule as `photo`: this is
   * the house's copy, and the seed defers to anything the person wrote for
   * themselves rather than overwriting it.
   */
  bio?: string;
  projectName?: string;
  projectSummary?: string;
};

/** Lives at Rice Residency. */
export const residents: Person[] = [
  { name: "Lana Yepifanova", username: "lana", email: "lana@example.com", lead: true, photo: "/people/lana-yepifanova.jpg" },
  { name: "Halbert Kim", photo: "/people/halbert-kim.png" },
  { name: "Jun Lee", photo: "/people/jun-lee.png" },
  { name: "Adam Towner", photo: "/people/adam-towner.png" },
  { name: "Catherine Zhou", lead: true, photo: "/people/catherine-zhou.png" },
  { name: "Gavin Firestone", photo: "/people/gavin-firestone.jpg" },
  { name: "Howard Zhao", photo: "/people/howard-zhao.png" },
  { name: "Jocelyn Lass", photo: "/people/jocelyn-lass.png" },
  { name: "Manuel Ponce", photo: "/people/manuel-ponce.png" },
  { name: "Nathan Kwon", photo: "/people/nathan-kwon.jpg" },
  { name: "Nolan Connolly", photo: "/people/nolan-connolly.jpg" },
  { name: "Saul Brauns", photo: "/people/saul-brauns.png" },
  // Listed in the coworking export only as tangsc@stanford.edu, confirmed as
  // Chris Tang — the same Chris who appears throughout the card-game results.
  { name: "Chris Tang", email: "tangsc@stanford.edu", photo: "/people/christopher-tang.png" },
  {
    name: "Arnav Bhalla",
    photo: "/people/arnav-bhalla.png",
    projectName: "Navio",
    projectSummary: "EEG-based focus tools and an AI academic planner.",
    bio: "Arnav is building EEG-based neurofeedback tools for focus and stress regulation, and Navio, an AI academic planner. He assembles Class III neurostimulation implants at Motif Neurotech, conducts robotics research at Rice's Neuroengineering Initiative, and interns at MD Anderson Cancer Center applying machine learning to pancreatic cancer diagnostics.",
  },
  {
    name: "Adithiya Balaguru",
    photo: "/people/adithiya-balaguru.png",
    projectName: "Coop",
    projectSummary: "AI sensors for early respiratory disease in poultry.",
    bio: "Adithiya is building Coop, an AI sensor system for early respiratory disease detection in industrial poultry barns. He researched satellite imagery models with the National Geospatial-Intelligence Agency under the DoD, built a suicide risk prediction model at George Mason University's Center for Evidence Based Behavior Health, and co-founded Connected Crosswalk Assistance, a smart walking cane for the visually impaired.",
  },
  {
    name: "Aruna Gauba",
    photo: "/people/aruna-gauba.jpg",
    projectName: "Mycelium",
    projectSummary: "Sustainable materials and AI-driven indoor farming.",
    bio: "Aruna is building a mycelium business in sustainable materials and integrating AI into smart indoor farming, while working for cybersecurity startup Dropzone AI. She was first author on AgMMU presented at NeurIPS 2025, co-authored a computational genomics paper, and wrote and sold ~1,000 copies of a book on cheetah conservation that raised over $10,000.",
  },
  {
    name: "Ramtin Shahzanian",
    photo: "/people/ramtin-shahzanian.png",
    projectName: "Stealth AI Startup",
    projectSummary: "Agentic memory infrastructure.",
    bio: "Ramtin is an AI student at Rice University working on agentic memory infrastructure through a stealth AI startup. His background spans applied machine learning projects including generative AI and computer vision systems.",
  },
  {
    name: "Stella Chen",
    photo: "/people/stella-chen.jpg",
    projectName: "Lookbook",
    projectSummary: "Share and rank clothing brands with friends.",
    bio: "Stella is building a mobile app where users share and rank clothing brands with friends. She previously interned at NASA on the Moon Exploration team, and co-founded the Maroon Project, which distributed 12,000+ period products to homeless women in Seattle and won 1st place globally at Destination Imagination.",
  },
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
  { name: "Jake Renda" },
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
