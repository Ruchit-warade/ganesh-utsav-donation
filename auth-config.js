/**
 * auth-config.js
 * ------------------------------------------------------------
 * Controls email-domain restriction for contributors.
 *
 * CONFIRM THE OFFICIAL IIT MANDI STUDENT/FACULTY EMAIL DOMAIN
 * BEFORE ENABLING RESTRICTION.
 * (e.g. is it "iitmandi.ac.in"? "...@students.iitmandi.ac.in"?
 *  Ask the organizing team / institute IT cell to confirm.)
 *
 * To disable restriction entirely, set restrictEmailDomain to false.
 * The list below is an allow-list: only emails whose domain is in
 * `allowedDomains` may sign in as a contributor.
 */

export const AUTH_SETTINGS = {
  // Set to false to allow any Google account to sign in.
  restrictEmailDomain: true,

  allowedDomains: [
    "iitmandi.ac.in","students.iitmandi.ac.in",
    // Add other confirmed official domains here, e.g.:
    // "students.iitmandi.ac.in",
  ],

  // Message shown when a user's email domain is not allowed.
  restrictedMessage:
    "This contribution portal is restricted to authorized IIT Mandi community members.",

  // Address shown beside the message so the right person can be contacted.
  supportEmail: "REPLACE_WITH_ORGANIZER_EMAIL@iitmandi.ac.in",
};
