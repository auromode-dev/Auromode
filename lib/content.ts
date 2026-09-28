export const photos = {
  hero: "/images/hero.jpg",
  garden: "/images/garden.jpg",
  room: "/images/room.jpg",
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
    name: "Tanto Restaurant",
    text: "Slow lunches, shared tables, and flavours that bring people together.",
    image: photos.food,
    href: "/amenities/tanto",
  },
  {
    n: "04",
    tag: "CONNECT",
    title: "Discover the thoughtfully made.",
    name: "To Be Two Store",
    text: "A considered collection of everyday pieces, with a story behind every find.",
    image: photos.store,
    href: "/amenities/to-be-two",
  },
];
export const roomTypes = [
  {
    id: "standard",
    name: "Standard Room",
    capacity: 2,
    image: photos.standard,
    description:
      "An easy, restful retreat with natural light and everything you need to settle in.",
  },
  {
    id: "deluxe",
    name: "Deluxe Room",
    capacity: 2,
    image: photos.room,
    description:
      "A little more room to unwind, with thoughtful details and a comfortable workspace.",
  },
  {
    id: "family",
    name: "Family Room",
    capacity: 4,
    image: photos.family,
    description:
      "Room for your favourite people, shared moments, and a slower kind of holiday.",
  },
  {
    id: "long-stay",
    name: "Long Stay",
    capacity: 2,
    image: photos.garden,
    description:
      "Make yourself at home in Auroville. Ask us about extended stays and tailored rates.",
  },
];
