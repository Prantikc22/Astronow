import {
  ArrowBendUpLeft, ArrowBendUpRight, ArrowClockwise, ArrowCounterClockwise,
  ArrowRight, ArrowUp, ArrowUpRight, Bell, BookOpenText, Briefcase, CalendarBlank,
  CaretLeft, CaretRight, ChatCircleDots, Check, CheckCircle, Clock, CloudSlash, Compass,
  CornersOut, Feather, FileText, Gift, GitBranch, GlobeHemisphereEast, Hash, Heart, HouseLine,
  ImageSquare, LockSimple, MapPin, Medal, Moon, NavigationArrow, NotePencil, Pulse,
  MagnifyingGlass, Lightning, ShieldCheck, Smiley, Stack, StarFour, Sun, SunHorizon, Target, TrendUp, UploadSimple, User,
  WarningCircle, X, UsersThree, SignOut, CircleIcon, ChartBar, Flame, Sparkle, Eye, Crown, Lightbulb,
  Hourglass, PaperPlaneTilt, ClockCounterClockwise, Plus, Checks, CaretDown, InfinityIcon, Timer, Palette, HandHeart,
  type IconProps,
} from "phosphor-react-native";
import React from "react";

import { useTheme } from "@/src/theme";

export type FeatherName = string;

const ICONS: Record<string, React.ComponentType<IconProps>> = {
  activity: Pulse,
  "alert-circle": WarningCircle,
  "arrow-right": ArrowRight,
  "arrow-up": ArrowUp,
  "arrow-up-right": ArrowUpRight,
  award: Medal,
  bell: Bell,
  "book-open": BookOpenText,
  briefcase: Briefcase,
  calendar: CalendarBlank,
  check: Check,
  "check-circle": CheckCircle,
  "chevron-left": CaretLeft,
  "chevron-right": CaretRight,
  clock: Clock,
  "cloud-off": CloudSlash,
  compass: Compass,
  "corner-up-left": ArrowBendUpLeft,
  "corner-up-right": ArrowBendUpRight,
  "edit-3": NotePencil,
  feather: Feather,
  "file-text": FileText,
  gift: Gift,
  "git-branch": GitBranch,
  globe: GlobeHemisphereEast,
  hash: Hash,
  heart: Heart,
  home: HouseLine,
  image: ImageSquare,
  layers: Stack,
  lock: LockSimple,
  "map-pin": MapPin,
  "message-circle": ChatCircleDots,
  moon: Moon,
  navigation: NavigationArrow,
  search: MagnifyingGlass,
  "refresh-cw": ArrowClockwise,
  "rotate-ccw": ArrowCounterClockwise,
  "rotate-cw": ArrowClockwise,
  shield: ShieldCheck,
  smile: Smiley,
  star: StarFour,
  sun: Sun,
  sunrise: SunHorizon,
  sunset: SunHorizon,
  target: Target,
  "trending-up": TrendUp,
  "upload-cloud": UploadSimple,
  user: User,
  viewport: CornersOut,
  zap: Lightning,
  x: X,
  users: UsersThree,
  "log-out": SignOut,
  circle: CircleIcon,
  "bar-chart-2": ChartBar,
  flame: Flame,
  sparkle: Sparkle,
  eye: Eye,
  crown: Crown,
  bulb: Lightbulb,
  hourglass: Hourglass,
  send: PaperPlaneTilt,
  history: ClockCounterClockwise,
  plus: Plus,
  checks: Checks,
  "chevron-down": CaretDown,
  infinity: InfinityIcon,
  timer: Timer,
  palette: Palette,
  "hand-heart": HandHeart,
};

export function Icon({ name, size = 20, color, weight = "regular" }: {
  name: FeatherName;
  size?: number;
  color?: string;
  weight?: IconProps["weight"];
}) {
  const { colors } = useTheme();
  const Glyph = ICONS[name] || StarFour;
  return <Glyph size={size} color={color ?? colors.onSurface} weight={weight} />;
}
