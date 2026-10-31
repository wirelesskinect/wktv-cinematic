// Devices WKTV supports (same list as "Pick your device" on the homepage).
// Used by the free-trial pop-up; the server only accepts these labels.
export const TRIAL_DEVICES = [
  { id: 'onn', label: 'ONN 4K or better', hint: 'ONN 4K / 4K Plus / 4K Pro streaming box' },
  { id: 'android', label: 'Android device', hint: 'Android TV box, Android phone or tablet' },
  { id: 'firetv', label: 'Amazon Fire TV', hint: 'Compatible Fire TV Stick or Fire TV' },
  { id: 'apple', label: 'Apple device', hint: 'iPhone, iPad or Apple TV with a supported third-party IPTV app' },
] as const

export function isTrialDevice(label: unknown): label is string {
  return typeof label === 'string' && TRIAL_DEVICES.some((d) => d.label === label)
}
