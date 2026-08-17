/* Connection settings for the Tineret R5 app.
   These keys are public by design (safe to commit). */
window.R5CONFIG = {
  // Supabase — events, chat, accounts, photo index
  url: "https://itttrepotdzvifseqvak.supabase.co",
  key: "sb_publishable_QTTQmwidPvxivhsX7FwDgw_7SieSSb7",

  // Cloudinary — where the photos themselves are stored (25 GB free).
  // Fill these in once, from your Cloudinary dashboard:
  //   cloudName    = Dashboard → "Cloud name"
  //   uploadPreset = Settings → Upload → Upload presets → add an
  //                  *unsigned* preset, then paste its name here.
  cloudinary: {
    cloudName: "",      // e.g. "tineret-r5"
    uploadPreset: ""    // e.g. "r5_unsigned"
  }
};
