import {
  Camera,
  Clapperboard,
  Disc3,
  Headphones,
  Laptop2,
  UsersRound
} from "lucide-react";

const iconMap = {
  photography: Camera,
  videography: Clapperboard,
  "platform-membership-site-building-maintenance": UsersRound,
  "dj-services": Disc3,
  "pc-tech-services": Laptop2,
  "beat-creation-session": Headphones
};

export function ServiceIcon({ slug, className = "service-icon" }) {
  const Icon = iconMap[slug] || Camera;
  return <Icon className={className} strokeWidth={1.8} aria-hidden="true" />;
}
