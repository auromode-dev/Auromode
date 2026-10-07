export const photos = {
  hero: "/images/hero.jpg",
  garden: "/images/garden.jpg",
  room: "/images/twin.jpg",
  work: "/images/work.jpg",
  food: "/images/food.jpg",
  store: "/images/store.jpg",
  auroville: "/images/auroville.jpg",
  family: "/images/family.jpg",
  standard: "/images/standard.jpg",
};
export const experiences = [
  {
    n: "01",
    tag: "STAY",
    title: "A little space to just be.",
    name: "Auromode Guesthouse",
    text: "Thoughtfully simple rooms, leafy mornings, and the feeling of being at home.",
    image: photos.room,
    href: "/guesthouse",
  },
  {
    n: "02",
    tag: "WORK",
    title: "Good ideas grow here.",
    name: "Hive Coworking",
    text: "Find your focus. Meet your people. Make room for a different way of working.",
    image: photos.work,
    href: "/amenities/hive",
  },
  {
    n: "03",
    tag: "EAT",
    title: "Gather around good food.",
    name: "Auromode Restaurant",
    text: "Fresh food, shared tables, and flavours that bring people together.",
    image: photos.food,
    href: "/amenities/tanto",
  },
  {
    n: "04", tag: "CONNECT", title: "Discover the thoughtfully made.",
    name: "To Be Two Showroom",
    text: "A conscious collection of everyday pieces, with a story behind every find.",
    image: photos.store, href: "/amenities/to-be-two",
  },
];
export const roomTypes = [
  {
    id: "studio",
    name: "Studio Suite",
    capacity: 1,
    beds: 1,
    image: "/images/studio.jpg",
    description:
      "A comfortable one-bed suite for a quiet stay at your own pace.",
  },
  {
    id: "twin",
    name: "Twin Room",
    capacity: 2,
    beds: 2,
    image: "/images/twin.jpg",
    description: "Two beds and a welcoming space to settle in together.",
  },
  {
    id: "triple",
    name: "Triple Room",
    capacity: 3,
    beds: 3,
    image: "/images/triple.jpg",
    description: "Three beds with room for friends or family to feel at home.",
  },
  {
    id: "family",
    name: "Family Suite",
    capacity: 4,
    beds: 4,
    image: "/images/family-suite.jpg",
    description:
      "A four-bed suite for shared moments and a slower kind of holiday.",
  },
];
