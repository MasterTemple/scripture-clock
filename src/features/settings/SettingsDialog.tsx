import type { ReactNode } from "react";
import { DialogContent } from "@/components/ui/overlays";
import { Switch } from "@/components/ui/primitives";
import { Segmented } from "@/components/ui/segmented";
import { Stepper } from "@/components/ui/stepper";
import { PER_MINUTE, slotLength, type HourFormat } from "@/clock/times";
import { useApp, type Theme } from "@/state/store";

function Row({ title, description, children }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0 space-y-0.5">
        <div className="text-sm font-medium">{title}</div>
        {description && <div className="text-xs text-muted-foreground">{description}</div>}
      </div>
      {children}
    </div>
  );
}

/** More than this won't fit on a phone at a readable size */
export const MAX_AT_ONCE = 8;

export function SettingsDialog() {
  const settings = useApp((s) => s.settings);
  const update = useApp((s) => s.updateSettings);
  const wakeLock = typeof navigator !== "undefined" && "wakeLock" in navigator;
  return (
    <DialogContent title="Settings">
      <div className="divide-y px-5 py-1">
        <Row title="Clock" description={settings.hourFormat === "12h" ? "5:48 in the evening is chapter 5" : "5:48 in the evening is chapter 17"}>
          <Segmented<HourFormat>
            size="sm"
            value={settings.hourFormat}
            onChange={(hourFormat) => update({ hourFormat })}
            options={[
              { value: "12h", label: "12-hour" },
              { value: "24h", label: "24-hour" },
            ]}
          />
        </Row>
        <Row title="Other readings" description="Also split the digits other ways: 5:48 as 54:8, 12:01 as 120:1">
          <Switch checked={settings.otherReadings} onCheckedChange={(otherReadings) => update({ otherReadings })} />
        </Row>
        <Row title="Verses at once" description="How many verses the one-verse display shows each minute">
          <Stepper label="Verses at once" value={settings.displayCount} min={1} max={MAX_AT_ONCE} onChange={(displayCount) => update({ displayCount })} />
        </Row>
        <Row title="Verses per minute" description={`Each shows for ${slotLength(settings.perMinute)}`}>
          <Stepper label="Verses per minute" value={settings.perMinute} values={PER_MINUTE} onChange={(perMinute) => update({ perMinute })} />
        </Row>
        <Row title="Seconds" description="Show the seconds on the clock, as large as the hour and minute">
          <Switch checked={settings.showSeconds} onCheckedChange={(showSeconds) => update({ showSeconds })} />
        </Row>
        {wakeLock && (
          <Row title="Keep screen on" description="Don't let the screen sleep while the clock is open">
            <Switch checked={settings.keepAwake} onCheckedChange={(keepAwake) => update({ keepAwake })} />
          </Row>
        )}
        <Row title="Theme">
          <Segmented<Theme>
            size="sm"
            value={settings.theme}
            onChange={(theme) => update({ theme })}
            options={[
              { value: "system", label: "Auto" },
              { value: "light", label: "Light" },
              { value: "dark", label: "Dark" },
            ]}
          />
        </Row>
      </div>
    </DialogContent>
  );
}
