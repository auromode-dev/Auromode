import {
  ArrowUpRight,
  Building2,
  ShieldCheck,
  Wifi,
  Users,
  Zap,
  Droplets,
  Car,
  Phone,
  Mail,
} from "lucide-react";
const facilities = [
  {
    icon: Building2,
    title: "Space for your team",
    text: "Office sizes of 20, 30 and 40 sq. m.",
  },
  {
    icon: ShieldCheck,
    title: "24/7 security",
    text: "Round-the-clock security service.",
  },
  {
    icon: Wifi,
    title: "Reliable internet",
    text: "Uninterrupted internet, including during power cuts.",
  },
  {
    icon: Users,
    title: "Room to meet",
    text: "Conference room available on demand for up to 40 people.",
  },
  {
    icon: Zap,
    title: "Power backup",
    text: "Backup power to keep your workday moving.",
  },
  {
    icon: Droplets,
    title: "Drinking water",
    text: "Dynamised and filtered drinking water.",
  },
  {
    icon: Car,
    title: "Easy parking",
    text: "On-site parking for cars and bikes.",
  },
];
const community: { name: string; href?: string }[] = [
  { name: "Aire Mask", href: "https://airemasks.com/" },
  {
    name: "Auro Dent",
    href: "https://auroville-learning.net/av_unit/aurodent/",
  },
  { name: "Delicious Bites", href: "https://www.delicious-bites.com/" },
  { name: "Sarvam Computers", href: "https://sarvam-computers.business.site/" },
  { name: "To Be Two", href: "https://www.tobetwo.in/" },
  { name: "Tanto", href: "http://tanto.in/" },
  { name: "Hibiscus Heroes", href: "http://www.hibiscusheroes.com/" },
  {
    name: "Avitra International Translators",
    href: "https://www.translatorscafe.com/cafe/agency3443.htm",
  },
  {
    name: "Hands for Earth",
    href: "https://www.facebook.com/Hands-For-Earth-105202778333731/",
  },
  { name: "Auro Designs" },
  { name: "Peace Education" },
  { name: "Just Joy Creative Studio" },
  { name: "Lotus Food Healing Hub" },
  { name: "Flourish" },
  { name: "Go Nature-Fruits & Vegetables" },
];
export function OfficeRentals() {
  return (
    <section
      id="offices"
      className="section office-rentals"
      aria-labelledby="offices-title"
    >
      <div className="section-heading">
        <div>
          <span className="eyebrow">YOUR WORK, WITH ROOM TO GROW</span>
          <h2 id="offices-title">
            Offices in a <em>greener setting.</em>
          </h2>
        </div>
        <p>
          Newly renovated offices at Auromode, available to rent in quiet and
          green surroundings. Choose a space of 20, 30 or 40 sq. m. and become
          part of our campus community.
        </p>
      </div>
      <div className="office-layout">
        <div className="office-facilities">
          {facilities.map(({ icon: Icon, title, text }) => (
            <div className="office-facility" key={title}>
              <Icon size={22} strokeWidth={1.4} aria-hidden="true" />
              <div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            </div>
          ))}
        </div>
        <aside
          className="office-enquiry"
          aria-labelledby="office-enquiry-title"
        >
          <span className="eyebrow">MAKE AUROMODE YOUR WORKPLACE</span>
          <h3 id="office-enquiry-title">Find your office.</h3>
          <p>
            For renting or further queries, get in touch with our office rental
            team.
          </p>
          <a className="button" href="tel:+919943390391">
            <Phone size={16} aria-hidden="true" /> +91 99433 90391
          </a>
          <a className="office-email" href="mailto:pandian@auroville.org.in">
            <Mail size={16} aria-hidden="true" />
            pandian@auroville.org.in
          </a>
          <a className="office-email" href="mailto:auromode@auroville.org.in">
            <Mail size={16} aria-hidden="true" />
            auromode@auroville.org.in
          </a>
        </aside>
      </div>
      <div className="office-community">
        <span className="eyebrow">IN GOOD COMPANY</span>
        <h3>Already at home at Auromode.</h3>
        <p>Meet the businesses and initiatives based on our campus.</p>
        <ul>
          {community.map((office) => (
            <li key={office.name}>
              {office.href ? (
                <a href={office.href} target="_blank" rel="noopener noreferrer">
                  {office.name}
                  <ArrowUpRight size={15} aria-hidden="true" />
                  <span className="sr-only"> (opens in a new tab)</span>
                </a>
              ) : (
                <span>{office.name}</span>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
