import { Columns2Icon, MoonIcon, RectangleVerticalIcon, SmartphoneIcon, TypeIcon, type LucideIcon } from "lucide-react";
import type { DisplayLayout } from "@/state/store";

export const LAYOUTS: { value: DisplayLayout; label: string; description: string; icon: LucideIcon }[] = [
  { value: "auto", label: "Auto", description: "Side by side when the screen is turned sideways", icon: SmartphoneIcon },
  { value: "side", label: "Landscape", description: "The clock beside the verse", icon: Columns2Icon },
  { value: "stacked", label: "Portrait", description: "The clock above the verse", icon: RectangleVerticalIcon },
  { value: "verse", label: "Verse", description: "The verse as large as it fits", icon: TypeIcon },
  { value: "night", label: "Night", description: "Dim and warm, for a dark room", icon: MoonIcon },
];
