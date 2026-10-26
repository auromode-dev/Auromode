import type { RoomCategory } from "./rooms";

// Supplied category photographs; order also determines the public cover image.
export const roomPhotos: Record<RoomCategory, string[]> = {
  studio: ["DSC01679", "DSC01684", "DSC01685", "DSC01688", "DSC01692", "DSC01693"].map(
    (name) => `/stay/studio-room/${name}.webp`,
  ),
  twin: ["DSC01639", "DSC01633", "DSC01616", "DSC01622", "DSC01641", "DSC01646"].map(
    (name) => `/stay/twin-room/${name}.webp`,
  ),
  triple: ["DSC01584", "DSC01554", "DSC01566", "DSC01577", "DSC01585", "DSC01591"].map(
    (name) => `/stay/triple-room/${name}.webp`,
  ),
  family: ["DSC01732", "DSC01703", "DSC01708", "DSC01713", "DSC01721", "DSC01724"].map(
    (name) => `/stay/family/${name}.webp`,
  ),
};
