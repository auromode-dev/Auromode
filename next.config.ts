import type { NextConfig } from "next";
const config: NextConfig = {
  poweredByHeader: false,
  async redirects() {
    // Saved inventory and older links may still point to the replaced JPGs.
    return [
      ["studio", "/stay/studio-room/DSC01679.webp"],
      ["twin", "/stay/twin-room/DSC01639.webp"],
      ["triple", "/stay/triple-room/DSC01584.webp"],
      ["family-suite", "/stay/family/DSC01732.webp"],
      ["hero", "/slide01.webp"],
      ["room", "/stay/twin-room/DSC01639.webp"],
      ["family", "/stay/family/DSC01732.webp"],
      ["standard", "/stay/twin-room/DSC01639.webp"],
    ].map(([name, destination]) => ({
      source: `/images/${name}.jpg`,
      destination,
      permanent: true,
    }));
  },
};
export default config;
