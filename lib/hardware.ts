export const HARDWARE_LINE = [
  { id: "v1", tierId: "early", version: "1.0", name: "Vision 1.0", halo: false },
  { id: "v2", tierId: "pro", version: "2.0", name: "Vision 2.0", halo: false },
  { id: "v3", tierId: "master", version: "3.0", name: "Vision 3.0", halo: false },
  { id: "v4", tierId: "apex", version: "4.0", name: "Vision 4.0", halo: true },
] as const;

export type HardwareModelId = (typeof HARDWARE_LINE)[number]["id"];
