import type { ComponentDefinition } from "./types";

const ic2 = (name: string) => `/assets/ic2/textures/items/${name}`;
const gt = (name: string) => `/assets/gregtech/textures/items/${name}`;

type FuelSize = "single" | "dual" | "quad";

const FUEL_SIZE: Record<FuelSize, { rodCount: number; energyScale: number; heatScale: number; keyPrefix: string }> = {
  single: { rodCount: 1, energyScale: 1, heatScale: 1, keyPrefix: "fuelRod" },
  dual: { rodCount: 2, energyScale: 4, heatScale: 6, keyPrefix: "dualFuelRod" },
  quad: { rodCount: 4, energyScale: 12, heatScale: 24, keyPrefix: "quadFuelRod" },
};

function fuelDisplayName(nameBase: string, size: FuelSize, sourceMod: ComponentDefinition["sourceMod"]) {
  const label =
    size === "single"
      ? "燃料棒"
      : size === "dual"
        ? sourceMod === "IC2"
          ? "双联燃料棒"
          : "二联燃料棒"
        : "四联燃料棒";
  const open = sourceMod === "IC2" ? "(" : "（";
  const close = sourceMod === "IC2" ? ")" : "）";
  return `${label}${open}${nameBase}${close}`;
}

function basePulses(rodCount: number) {
  return rodCount === 1 ? 1 : rodCount === 2 ? 2 : 3;
}

function energyMultiplier(baseEUt: number, size: FuelSize) {
  const spec = FUEL_SIZE[size];
  return (baseEUt * spec.energyScale * 2) / basePulses(spec.rodCount);
}

function heatMultiplier(baseHuS: number, size: FuelSize) {
  const spec = FUEL_SIZE[size];
  const pulses = basePulses(spec.rodCount);
  return (baseHuS * spec.heatScale) / (pulses * (pulses + 1));
}

function fuel(
  id: number,
  key: string,
  name: string,
  image: string,
  maxDamage: number,
  sourceMod: ComponentDefinition["sourceMod"],
  energyMult: number,
  heatMult: number,
  rodCount: number,
  moxStyle: boolean,
): ComponentDefinition {
  return {
    id,
    key,
    name,
    kind: "fuelRod",
    maxDamage,
    maxHeat: 1,
    sourceMod,
    image,
    fuel: { energyMult, heatMult, rodCount, moxStyle },
  };
}

function sizedFuel(
  id: number,
  keyBase: string,
  nameBase: string,
  image: string,
  maxDamage: number,
  sourceMod: ComponentDefinition["sourceMod"],
  baseEUt: number,
  baseHuS: number,
  size: FuelSize,
  moxStyle: boolean,
): ComponentDefinition {
  const spec = FUEL_SIZE[size];
  return fuel(
    id,
    `${spec.keyPrefix}${keyBase}`,
    fuelDisplayName(nameBase, size, sourceMod),
    image,
    maxDamage,
    sourceMod,
    energyMultiplier(baseEUt, size),
    heatMultiplier(baseHuS, size),
    spec.rodCount,
    moxStyle,
  );
}

function fuelFamily(
  startId: number,
  keyBase: string,
  nameBase: string,
  images: Record<FuelSize, string>,
  maxDamage: number,
  sourceMod: ComponentDefinition["sourceMod"],
  baseEUt: number,
  baseHuS: number,
  moxStyle: boolean,
): ComponentDefinition[] {
  return (["single", "dual", "quad"] as const).map((size, index) =>
    sizedFuel(startId + index, keyBase, nameBase, images[size], maxDamage, sourceMod, baseEUt, baseHuS, size, moxStyle),
  );
}

function singleFuel(
  id: number,
  keyBase: string,
  nameBase: string,
  image: string,
  maxDamage: number,
  sourceMod: ComponentDefinition["sourceMod"],
  baseEUt: number,
  baseHuS: number,
  moxStyle: boolean,
): ComponentDefinition {
  return sizedFuel(id, keyBase, nameBase, image, maxDamage, sourceMod, baseEUt, baseHuS, "single", moxStyle);
}

function cell(
  id: number,
  key: string,
  name: string,
  image: string,
  maxHeat: number,
  sourceMod: ComponentDefinition["sourceMod"],
): ComponentDefinition {
  return {
    id,
    key,
    name,
    kind: "coolantCell",
    maxDamage: 1,
    maxHeat,
    sourceMod,
    image,
  };
}

export const COMPONENTS: ComponentDefinition[] = [
  ...fuelFamily(
    1,
    "Uranium",
    "铀",
    {
      single: ic2("reactorUraniumSimple.png"),
      dual: ic2("reactorUraniumDual.png"),
      quad: ic2("reactorUraniumQuad.png"),
    },
    20_000,
    "IC2",
    50,
    4,
    false,
  ),
  ...fuelFamily(
    4,
    "Mox",
    "MOX",
    {
      single: ic2("reactorMOXSimple.png"),
      dual: ic2("reactorMOXDual.png"),
      quad: ic2("reactorMOXQuad.png"),
    },
    10_000,
    "IC2",
    50,
    4,
    true,
  ),
  { id: 7, key: "neutronReflector", name: "中子反射板", kind: "reflector", maxDamage: 30_000, maxHeat: 1, sourceMod: "IC2", image: ic2("reactorReflector.png") },
  { id: 8, key: "thickNeutronReflector", name: "加厚中子反射板", kind: "reflector", maxDamage: 120_000, maxHeat: 1, sourceMod: "IC2", image: ic2("reactorReflectorThick.png") },
  { id: 9, key: "heatVent", name: "散热片", kind: "vent", maxDamage: 1, maxHeat: 1_000, sourceMod: "IC2", image: ic2("reactorVent.png"), vent: { selfVent: 6, hullDraw: 0, sideVent: 0 } },
  { id: 10, key: "advancedHeatVent", name: "高级散热片", kind: "vent", maxDamage: 1, maxHeat: 1_000, sourceMod: "IC2", image: ic2("reactorVentDiamond.png"), vent: { selfVent: 12, hullDraw: 0, sideVent: 0 } },
  { id: 11, key: "reactorHeatVent", name: "反应堆散热片", kind: "vent", maxDamage: 1, maxHeat: 1_000, sourceMod: "IC2", image: ic2("reactorVentCore.png"), vent: { selfVent: 5, hullDraw: 5, sideVent: 0 } },
  { id: 12, key: "componentHeatVent", name: "元件散热片", kind: "vent", maxDamage: 1, maxHeat: 1, sourceMod: "IC2", image: ic2("reactorVentSpread.png"), vent: { selfVent: 0, hullDraw: 0, sideVent: 4 } },
  { id: 13, key: "overclockedHeatVent", name: "超频散热片", kind: "vent", maxDamage: 1, maxHeat: 1_000, sourceMod: "IC2", image: ic2("reactorVentGold.png"), vent: { selfVent: 20, hullDraw: 36, sideVent: 0 } },
  cell(14, "coolantCell10k", "10k冷却单元", ic2("reactorCoolantSimple.png"), 10_000, "IC2"),
  cell(15, "coolantCell30k", "30k冷却单元", ic2("reactorCoolantTriple.png"), 30_000, "IC2"),
  cell(16, "coolantCell60k", "60k冷却单元", ic2("reactorCoolantSix.png"), 60_000, "IC2"),
  { id: 17, key: "heatExchanger", name: "热交换器", kind: "exchanger", maxDamage: 1, maxHeat: 2_500, sourceMod: "IC2", image: ic2("reactorHeatSwitch.png"), exchanger: { switchSide: 12, switchReactor: 4 } },
  { id: 18, key: "advancedHeatExchanger", name: "高级热交换器", kind: "exchanger", maxDamage: 1, maxHeat: 10_000, sourceMod: "IC2", image: ic2("reactorHeatSwitchDiamond.png"), exchanger: { switchSide: 24, switchReactor: 8 } },
  { id: 19, key: "coreHeatExchanger", name: "反应堆热交换器", kind: "exchanger", maxDamage: 1, maxHeat: 5_000, sourceMod: "IC2", image: ic2("reactorHeatSwitchCore.png"), exchanger: { switchSide: 0, switchReactor: 72 } },
  { id: 20, key: "componentHeatExchanger", name: "元件热交换器", kind: "exchanger", maxDamage: 1, maxHeat: 5_000, sourceMod: "IC2", image: ic2("reactorHeatSwitchSpread.png"), exchanger: { switchSide: 36, switchReactor: 0 } },
  { id: 21, key: "reactorPlating", name: "反应堆隔板", kind: "plating", maxDamage: 1, maxHeat: 1, sourceMod: "IC2", image: ic2("reactorPlating.png"), plating: { heatAdjustment: 1_000, explosionPowerMultiplier: 0.9025 } },
  { id: 22, key: "heatCapacityReactorPlating", name: "高热容反应堆隔板", kind: "plating", maxDamage: 1, maxHeat: 1, sourceMod: "IC2", image: ic2("reactorPlatingHeat.png"), plating: { heatAdjustment: 1_700, explosionPowerMultiplier: 0.9801 } },
  { id: 23, key: "containmentReactorPlating", name: "密封反应堆隔板", kind: "plating", maxDamage: 1, maxHeat: 1, sourceMod: "IC2", image: ic2("reactorPlatingExplosive.png"), plating: { heatAdjustment: 500, explosionPowerMultiplier: 0.81 } },
  { id: 24, key: "rshCondensator", name: "红石冷却单元", kind: "condensator", maxDamage: 1, maxHeat: 20_000, sourceMod: "IC2", image: ic2("reactorCondensator.png") },
  { id: 25, key: "lzhCondensator", name: "青金石冷却单元", kind: "condensator", maxDamage: 1, maxHeat: 100_000, sourceMod: "IC2", image: ic2("reactorCondensatorLap.png") },
  ...fuelFamily(
    26,
    "Thorium",
    "钍",
    {
      single: gt("gt.rodThorium.png"),
      dual: gt("gt.rodThorium2.png"),
      quad: gt("gt.rodThorium4.png"),
    },
    50_000,
    "GregTech",
    10,
    1,
    false,
  ),
  { id: 35, key: "iridiumNeutronReflector", name: "铱中子反射板", kind: "reflector", maxDamage: 1, maxHeat: 1, sourceMod: "GregTech", image: gt("gt.neutronreflector.png") },
  ...fuelFamily(
    36,
    "HighDensityUranium",
    "浓缩铀",
    {
      single: gt("gt.rodHighDensityUranium.png"),
      dual: gt("gt.rodHighDensityUranium2.png"),
      quad: gt("gt.rodHighDensityUranium4.png"),
    },
    20_000,
    "GoodGenerator",
    100,
    4,
    false,
  ),
  ...fuelFamily(
    39,
    "HighDensityPlutonium",
    "浓缩钚",
    {
      single: gt("gt.rodHighDensityPlutonium.png"),
      dual: gt("gt.rodHighDensityPlutonium2.png"),
      quad: gt("gt.rodHighDensityPlutonium4.png"),
    },
    30_000,
    "GoodGenerator",
    50,
    4,
    true,
  ),
  ...fuelFamily(
    42,
    "ExcitedUranium",
    "激发铀",
    {
      single: gt("gt.rodExcitedUranium.png"),
      dual: gt("gt.rodExcitedUranium2.png"),
      quad: gt("gt.rodExcitedUranium4.png"),
    },
    6_000,
    "GoodGenerator",
    1_200,
    64,
    false,
  ),
  ...fuelFamily(
    45,
    "Naquadah",
    "硅岩",
    {
      single: gt("gt.rodNaquadah.png"),
      dual: gt("gt.rodNaquadah2.png"),
      quad: gt("gt.rodNaquadah4.png"),
    },
    100_000,
    "GregTech",
    100,
    4,
    false,
  ),
  ...fuelFamily(
    48,
    "Naquadria",
    "超能硅岩",
    {
      single: gt("gt.rodNaquadria.png"),
      dual: gt("gt.rodNaquadria2.png"),
      quad: gt("gt.rodNaquadria4.png"),
    },
    100_000,
    "GregTech",
    100,
    4,
    true,
  ),
  ...fuelFamily(
    51,
    "Tiberium",
    "泰伯利亚",
    {
      single: gt("gt.rodTiberium.png"),
      dual: gt("gt.rodTiberium2.png"),
      quad: gt("gt.rodTiberium4.png"),
    },
    50_000,
    "GregTech",
    50,
    2,
    false,
  ),
  fuel(
    54,
    "fuelRodTheCore",
    "“核心”",
    gt("gt.rodNaquadah32.png"),
    100_000,
    "GregTech",
    (200 * 544 * 2) / 3,
    (4 * 4_896) / 12,
    32,
    false,
  ),
  cell(55, "coolantCell180kSpace", "180k空间冷却单元", gt("gt.180k_Space_Coolantcell.png"), 180_000, "GregTech"),
  cell(56, "coolantCell360kSpace", "360k空间冷却单元", gt("gt.360k_Space_Coolantcell.png"), 360_000, "GregTech"),
  cell(57, "coolantCell540kSpace", "540k空间冷却单元", gt("gt.540k_Space_Coolantcell.png"), 540_000, "GregTech"),
  cell(58, "coolantCell1080kSpace", "1080k空间冷却单元", gt("gt.1080k_Space_Coolantcell.png"), 1_080_000, "GregTech"),
  ...fuelFamily(
    59,
    "ExcitedPlutonium",
    "激发钚",
    {
      single: gt("gt.rodExcitedPlutonium.png"),
      dual: gt("gt.rodExcitedPlutonium2.png"),
      quad: gt("gt.rodExcitedPlutonium4.png"),
    },
    10_000,
    "GoodGenerator",
    1_200,
    64,
    true,
  ),
  singleFuel(62, "Glowstone", "荧石", gt("gt.rodGlowstone.png"), 10_000, "GregTech", 0, 0, false),
  singleFuel(63, "Lithium", "锂", gt("gt.rodLithium.png"), 10_000, "GregTech", 0, 0, false),
  cell(64, "coolantCell60kHelium", "60k氦冷却单元", gt("gt.60k_Helium_Coolantcell.png"), 60_000, "GregTech"),
  cell(65, "coolantCell180kHelium", "180k氦冷却单元", gt("gt.180k_Helium_Coolantcell.png"), 180_000, "GregTech"),
  cell(66, "coolantCell360kHelium", "360k氦冷却单元", gt("gt.360k_Helium_Coolantcell.png"), 360_000, "GregTech"),
  cell(67, "coolantCell60kNaK", "60k钠钾冷却单元", gt("gt.60k_NaK_Coolantcell.png"), 60_000, "GregTech"),
  cell(68, "coolantCell180kNaK", "180k钠钾冷却单元", gt("gt.180k_NaK_Coolantcell.png"), 180_000, "GregTech"),
  cell(69, "coolantCell360kNaK", "360k钠钾冷却单元", gt("gt.360k_NaK_Coolantcell.png"), 360_000, "GregTech"),
];

export const COMPONENT_BY_ID = new Map(COMPONENTS.map((component) => [component.id, component]));
export const COMPONENT_BY_KEY = new Map(COMPONENTS.map((component) => [component.key, component]));

export const PALETTE_GROUPS = [
  { title: "燃料棒", ids: [1, 2, 3, 4, 5, 6, 26, 27, 28, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 59, 60, 61, 62, 63] },
  { title: "冷却单元", ids: [14, 15, 16, 64, 65, 66, 67, 68, 69, 55, 56, 57, 58] },
  { title: "散热/换热", ids: [9, 10, 11, 12, 13, 17, 18, 19, 20] },
  { title: "反射/隔板/冷凝", ids: [7, 8, 35, 21, 22, 23, 24, 25] },
];
