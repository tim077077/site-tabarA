/* Connection settings for the Tineret R5 app.
   These keys are public by design (safe to commit). */
window.R5CONFIG = {
  // Supabase — events, chat, accounts, photo index
  url: "https://itttrepotdzvifseqvak.supabase.co",
  key: "sb_publishable_QTTQmwidPvxivhsX7FwDgw_7SieSSb7",

  // Google OAuth Web client ID (public, safe to commit). Used by native
  // Google sign-in in the Android app; must also be the client ID configured
  // in Supabase → Auth → Providers → Google.
  googleWebClientId: "803315240248-ev0bmfbfmi8lb1h93pshrck6kafs56ma.apps.googleusercontent.com",

  // Cloudinary — where the photos themselves are stored (25 GB free).
  // Fill these in once, from your Cloudinary dashboard:
  //   cloudName    = Dashboard → "Cloud name"
  //   uploadPreset = Settings → Upload → Upload presets → add an
  //                  *unsigned* preset, then paste its name here.
  cloudinary: {
    cloudName: "pz8e0bhk",     // Cloudinary "Cloud name"
    uploadPreset: "ml_default" // unsigned upload preset
  }
};
