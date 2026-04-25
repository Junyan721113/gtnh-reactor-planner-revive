import type { ComponentDefinition } from "./types";

const ic2 = (name: string) => `/assets/ic2/textures/items/${name}`;
const gt = (name: string) => `/assets/gregtech/textures/items/${name}`;
const gtnh = (name: string) => `/assets/gtnh/textures/items/${name}`;
const gg = (name: string) => `/assets/goodgenerator/textures/items/${name}`;

type FuelSize = "single" | "dual" | "quad";

const FUEL_SIZE: Record<FuelSize, { rodCount: number; energyScale: number; heatScale: number; label: string; keyPrefix: string }> = {
  single: { rodCount: 1, energyScale: 1, heatScale: 1, label: "Fuel Rod", keyPrefix: "fuelRod" },
  dual: { rodCount: 2, energyScale: 4, heatScale: 6, label: "Dual Fuel Rod", keyPrefix: "dualFuelRod" },
  quad: { rodCount: 4, energyScale: 12, heatScale: 24, label: "Quad Fuel Rod", keyPrefix: "quadFuelRod" },
};

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
    `${spec.label} (${nameBase})`,
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
    "Uranium",
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
  { id: 7, key: "neutronReflector", name: "Neutron Reflector", kind: "reflector", maxDamage: 30_000, maxHeat: 1, sourceMod: "IC2", image: ic2("reactorReflector.png") },
  { id: 8, key: "thickNeutronReflector", name: "Thick Neutron Reflector", kind: "reflector", maxDamage: 120_000, maxHeat: 1, sourceMod: "IC2", image: ic2("reactorReflectorThick.png") },
  { id: 9, key: "heatVent", name: "Heat Vent", kind: "vent", maxDamage: 1, maxHeat: 1_000, sourceMod: "IC2", image: ic2("reactorVent.png"), vent: { selfVent: 6, hullDraw: 0, sideVent: 0 } },
  { id: 10, key: "advancedHeatVent", name: "Advanced Heat Vent", kind: "vent", maxDamage: 1, maxHeat: 1_000, sourceMod: "IC2", image: ic2("reactorVentDiamond.png"), vent: { selfVent: 12, hullDraw: 0, sideVent: 0 } },
  { id: 11, key: "reactorHeatVent", name: "Reactor Heat Vent", kind: "vent", maxDamage: 1, maxHeat: 1_000, sourceMod: "IC2", image: ic2("reactorVentCore.png"), vent: { selfVent: 5, hullDraw: 5, sideVent: 0 } },
  { id: 12, key: "componentHeatVent", name: "Component Heat Vent", kind: "vent", maxDamage: 1, maxHeat: 1, sourceMod: "IC2", image: ic2("reactorVentSpread.png"), vent: { selfVent: 0, hullDraw: 0, sideVent: 4 } },
  { id: 13, key: "overclockedHeatVent", name: "Overclocked Heat Vent", kind: "vent", maxDamage: 1, maxHeat: 1_000, sourceMod: "IC2", image: ic2("reactorVentGold.png"), vent: { selfVent: 20, hullDraw: 36, sideVent: 0 } },
  cell(14, "coolantCell10k", "10k Coolant Cell", ic2("reactorCoolantSimple.png"), 10_000, "IC2"),
  cell(15, "coolantCell30k", "30k Coolant Cell", ic2("reactorCoolantTriple.png"), 30_000, "IC2"),
  cell(16, "coolantCell60k", "60k Coolant Cell", ic2("reactorCoolantSix.png"), 60_000, "IC2"),
  { id: 17, key: "heatExchanger", name: "Heat Exchanger", kind: "exchanger", maxDamage: 1, maxHeat: 2_500, sourceMod: "IC2", image: ic2("reactorHeatSwitch.png"), exchanger: { switchSide: 12, switchReactor: 4 } },
  { id: 18, key: "advancedHeatExchanger", name: "Advanced Heat Exchanger", kind: "exchanger", maxDamage: 1, maxHeat: 10_000, sourceMod: "IC2", image: ic2("reactorHeatSwitchDiamond.png"), exchanger: { switchSide: 24, switchReactor: 8 } },
  { id: 19, key: "coreHeatExchanger", name: "Reactor Heat Exchanger", kind: "exchanger", maxDamage: 1, maxHeat: 5_000, sourceMod: "IC2", image: ic2("reactorHeatSwitchCore.png"), exchanger: { switchSide: 0, switchReactor: 72 } },
  { id: 20, key: "componentHeatExchanger", name: "Component Heat Exchanger", kind: "exchanger", maxDamage: 1, maxHeat: 5_000, sourceMod: "IC2", image: ic2("reactorHeatSwitchSpread.png"), exchanger: { switchSide: 36, switchReactor: 0 } },
  { id: 21, key: "reactorPlating", name: "Reactor Plating", kind: "plating", maxDamage: 1, maxHeat: 1, sourceMod: "IC2", image: ic2("reactorPlating.png"), plating: { heatAdjustment: 1_000, explosionPowerMultiplier: 0.9025 } },
  { id: 22, key: "heatCapacityReactorPlating", name: "Heat-Capacity Reactor Plating", kind: "plating", maxDamage: 1, maxHeat: 1, sourceMod: "IC2", image: ic2("reactorPlatingHeat.png"), plating: { heatAdjustment: 1_700, explosionPowerMultiplier: 0.9801 } },
  { id: 23, key: "containmentReactorPlating", name: "Containment Reactor Plating", kind: "plating", maxDamage: 1, maxHeat: 1, sourceMod: "IC2", image: ic2("reactorPlatingExplosive.png"), plating: { heatAdjustment: 500, explosionPowerMultiplier: 0.81 } },
  { id: 24, key: "rshCondensator", name: "RSH-Condensator", kind: "condensator", maxDamage: 1, maxHeat: 20_000, sourceMod: "IC2", image: ic2("reactorCondensator.png") },
  { id: 25, key: "lzhCondensator", name: "LZH-Condensator", kind: "condensator", maxDamage: 1, maxHeat: 100_000, sourceMod: "IC2", image: ic2("reactorCondensatorLap.png") },
  ...fuelFamily(
    26,
    "Thorium",
    "Thorium",
    {
      single: gt("gt.Thoriumcell.png"),
      dual: gt("gt.Double_Thoriumcell.png"),
      quad: gt("gt.Quad_Thoriumcell.png"),
    },
    50_000,
    "GTNH",
    10,
    1,
    false,
  ),
  { id: 35, key: "iridiumNeutronReflector", name: "Iridium Neutron Reflector", kind: "reflector", maxDamage: 1, maxHeat: 1, sourceMod: "GTNH", image: gt("gt.neutronreflector.png") },
  ...fuelFamily(
    36,
    "HighDensityUranium",
    "High Density Uranium",
    {
      single: gg("gg.CompressedUranium.png"),
      dual: gg("gg.Double_CompressedUranium.png"),
      quad: gg("gg.Quad_CompressedUranium.png"),
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
    "High Density Plutonium",
    {
      single: gg("gg.CompressedPlutonium.png"),
      dual: gg("gg.Double_CompressedPlutonium.png"),
      quad: gg("gg.Quad_CompressedPlutonium.png"),
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
    "Excited Uranium",
    {
      single: gg("gg.LiquidUranium.png"),
      dual: gg("gg.Double_LiquidUranium.png"),
      quad: gg("gg.Quad_LiquidUranium.png"),
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
    "Naquadah",
    {
      single: gt("gt.Naquadahcell.png"),
      dual: gt("gt.Double_Naquadahcell.png"),
      quad: gt("gt.Quad_Naquadahcell.png"),
    },
    100_000,
    "GTNH",
    100,
    4,
    false,
  ),
  ...fuelFamily(
    48,
    "Naquadria",
    "Naquadria",
    {
      single: gtnh("gt.MNqCell.png"),
      dual: gtnh("gt.Double_MNqCell.png"),
      quad: gtnh("gt.Quad_MNqCell.png"),
    },
    100_000,
    "GTNH",
    100,
    4,
    true,
  ),
  ...fuelFamily(
    51,
    "Tiberium",
    "Tiberium",
    {
      single: gtnh("gt.Tiberiumcell.png"),
      dual: gtnh("gt.Double_Tiberiumcell.png"),
      quad: gtnh("gt.Quad_Tiberiumcell.png"),
    },
    50_000,
    "GTNH",
    50,
    2,
    false,
  ),
  fuel(
    54,
    "fuelRodTheCore",
    "Fuel Rod (The Core)",
    gtnh("gt.Core_Reactor_Cell.png"),
    100_000,
    "GTNH",
    (200 * 544 * 2) / 3,
    (4 * 4_896) / 12,
    32,
    false,
  ),
  cell(55, "coolantCell180k", "180k Coolant Cell", gtnh("gt.180k_Space_Coolantcell.png"), 180_000, "GTNH"),
  cell(56, "coolantCell360k", "360k Coolant Cell", gtnh("gt.360k_Space_Coolantcell.png"), 360_000, "GTNH"),
  cell(57, "coolantCell540k", "540k Coolant Cell", gtnh("gt.540k_Space_Coolantcell.png"), 540_000, "GTNH"),
  cell(58, "coolantCell1080k", "1080k Coolant Cell", gtnh("gt.1080k_Space_Coolantcell.png"), 1_080_000, "GTNH"),
  ...fuelFamily(
    59,
    "ExcitedPlutonium",
    "Excited Plutonium",
    {
      single: gg("gg.LiquidPlutonium.png"),
      dual: gg("gg.Double_LiquidPlutonium.png"),
      quad: gg("gg.Quad_LiquidPlutonium.png"),
    },
    10_000,
    "GoodGenerator",
    1_200,
    64,
    true,
  ),
  singleFuel(62, "Glowstone", "Glowstone", gtnh("gt.GlowstoneCell.png"), 10_000, "GTNH", 0, 0, false),
  singleFuel(63, "Lithium", "Lithium", ic2("reactorMOXSimple.png"), 10_000, "GTNH", 0, 0, false),
];

export const COMPONENT_BY_ID = new Map(COMPONENTS.map((component) => [component.id, component]));
export const COMPONENT_BY_KEY = new Map(COMPONENTS.map((component) => [component.key, component]));

export const PALETTE_GROUPS = [
  { title: "燃料棒", ids: [1, 2, 3, 4, 5, 6, 26, 27, 28, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 59, 60, 61, 62, 63] },
  { title: "冷却单元", ids: [14, 15, 16, 55, 56, 57, 58] },
  { title: "散热/换热", ids: [9, 10, 11, 12, 13, 17, 18, 19, 20] },
  { title: "反射/隔热/冷凝", ids: [7, 8, 35, 21, 22, 23, 24, 25] },
];
