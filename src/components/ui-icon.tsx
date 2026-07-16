import Image from "next/image";

export type IconName =
  | "home"
  | "calendar"
  | "message"
  | "record"
  | "user"
  | "send"
  | "plus"
  | "check"
  | "checkbox"
  | "close"
  | "chevron-left"
  | "chevron-right"
  | "trash"
  | "kakao"
  | "alert"
  | "pencil"
  | "sparkle"
  | "chat-fab";

type IconProps = {
  name: IconName;
  className?: string;
  size?: number;
  active?: boolean;
};

const assetIcons: Partial<
  Record<
    IconName,
    { src: string; activeSrc?: string; width: number; height: number }
  >
> = {
  home: {
    src: "/assets/home_screen_svg_assets/icon_home.svg",
    width: 32,
    height: 32,
  },
  calendar: {
    src: "/assets/home_screen_svg_assets/icon_calendar.svg",
    activeSrc: "/assets/calendar_screen_svg_assets/nav_calendar_active.svg",
    width: 32,
    height: 32,
  },
  message: {
    src: "/assets/home_screen_svg_assets/icon_chat.svg",
    width: 32,
    height: 32,
  },
  record: {
    src: "/assets/home_screen_svg_assets/icon_record.svg",
    width: 32,
    height: 32,
  },
  user: {
    src: "/assets/home_screen_svg_assets/icon_user.svg",
    width: 32,
    height: 32,
  },
  send: {
    src: "/assets/home_screen_svg_assets/icon_send.svg",
    width: 24,
    height: 24,
  },
  plus: {
    src: "/assets/home_screen_svg_assets/icon_plus.svg",
    width: 24,
    height: 24,
  },
  check: {
    src: "/assets/home_screen_svg_assets/icon_check.svg",
    width: 32,
    height: 32,
  },
  checkbox: {
    src: "/assets/ai_chat_end_svg_assets/checkbox_empty.svg",
    width: 42,
    height: 42,
  },
  close: {
    src: "/assets/calendar_popup_svg_assets/01_close_x_icon.svg",
    width: 48,
    height: 48,
  },
  "chevron-left": {
    src: "/assets/calendar_screen_svg_assets/icon_chevron_left.svg",
    width: 24,
    height: 24,
  },
  "chevron-right": {
    src: "/assets/calendar_screen_svg_assets/icon_chevron_right.svg",
    width: 24,
    height: 24,
  },
  pencil: {
    src: "/assets/ai_chat_end_svg_assets/pencil_icon.svg",
    width: 24,
    height: 24,
  },
  sparkle: {
    src: "/assets/ai_chat_end_svg_assets/sparkle_icon.svg",
    width: 28,
    height: 28,
  },
  "chat-fab": {
    src: "/assets/calendar_screen_svg_assets/fab_chat_active.svg",
    width: 96,
    height: 96,
  },
};

export const scheduleColorChips = [
  {
    value: "#A864D4",
    asset: "/assets/calendar_popup_svg_assets/12_color_chip_purple.svg",
  },
  {
    value: "#EDA640",
    asset: "/assets/calendar_popup_svg_assets/11_color_chip_orange.svg",
  },
  {
    value: "#37B98F",
    asset: "/assets/calendar_popup_svg_assets/10_color_chip_green.svg",
  },
  {
    value: "#EC5B76",
    asset: "/assets/calendar_popup_svg_assets/09_color_chip_pink.svg",
  },
] as const;

export function getScheduleBarAsset(color: string) {
  const normalized = color.toLowerCase();
  const orangeHints = ["eda640", "ffd195", "f1b46c", "ff9e", "ec5b"];

  if (orangeHints.some((hint) => normalized.includes(hint))) {
    return "/assets/home_screen_svg_assets/event_bar_orange.svg";
  }

  return "/assets/home_screen_svg_assets/event_bar_purple.svg";
}

export function Icon({ name, className = "", size, active = false }: IconProps) {
  const asset = assetIcons[name];

  if (asset) {
    const src = active && asset.activeSrc ? asset.activeSrc : asset.src;
    const pixelSize = size ?? asset.width;

    return (
      <Image
        aria-hidden
        className={`ui-icon ui-icon-asset ${className}`.trim()}
        src={src}
        alt=""
        width={pixelSize}
        height={size ?? asset.height}
      />
    );
  }

  return <InlineIcon name={name} className={className} size={size} />;
}

function InlineIcon({
  name,
  className,
  size,
}: {
  name: IconName;
  className?: string;
  size?: number;
}) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 2.35,
  };

  return (
    <svg
      className={`ui-icon ui-icon-inline ${className ?? ""}`.trim()}
      viewBox="0 0 24 24"
      width={size ?? 24}
      height={size ?? 24}
      aria-hidden="true"
    >
      {name === "trash" && (
        <>
          <path {...common} d="M5 7h14M10 11v5M14 11v5" />
          <path {...common} d="M8 7l.7 12h6.6L16 7M9.5 7l.7-2h3.6l.7 2" />
        </>
      )}
      {name === "kakao" && (
        <path
          d="M12 5C7.6 5 4 7.8 4 11.3c0 2.2 1.5 4.2 3.8 5.3l-.6 2.2c-.1.4.3.7.6.4l2.7-1.7c.5.1 1 .1 1.5.1 4.4 0 8-2.8 8-6.3S16.4 5 12 5Z"
          fill="currentColor"
        />
      )}
      {name === "alert" && (
        <>
          <path {...common} d="M12 8v5" />
          <path {...common} d="M12 17h.1" />
          <path
            {...common}
            d="M10.3 4.5 3.4 17.2c-.7 1.3.2 2.8 1.7 2.8h13.8c1.5 0 2.4-1.5 1.7-2.8L13.7 4.5c-.7-1.3-2.7-1.3-3.4 0Z"
          />
        </>
      )}
    </svg>
  );
}

export function ScheduleBar({ color }: { color: string }) {
  return (
    <Image
      aria-hidden
      className="schedule-bar-asset"
      src={getScheduleBarAsset(color)}
      alt=""
      width={6}
      height={56}
    />
  );
}

export function CalendarDot({ color = "#A864D4" }: { color?: string }) {
  return (
    <span
      aria-hidden
      className="calendar-dot-asset"
      style={{ backgroundColor: color }}
    />
  );
}

export function ColorChip({
  value,
  asset,
  defaultChecked = false,
}: {
  value: string;
  asset: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="color-chip-label">
      <input
        type="radio"
        name="color"
        value={value}
        defaultChecked={defaultChecked}
      />
      <Image
        aria-hidden
        className="color-chip-asset"
        src={asset}
        alt=""
        width={52}
        height={52}
      />
    </label>
  );
}
