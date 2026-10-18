/* Реестр canvas-фонов живых тем: id темы → фабрика рендерера.
 * Темы без записи в реестре либо спокойные (без анимации), либо ещё
 * не переведены на canvas. Компонент ThemeCanvas берёт фабрику сюда. */

import type { RendererFactory } from "./utils";
import { create as createStorm } from "./storm";
import { create as createMatrix } from "./matrix";
import { create as createEmber } from "./ember";
import { create as createSakura } from "./sakura";
import { create as createAurora } from "./aurora";
import { create as createSunset } from "./sunset";
import { create as createLavender } from "./lavender";
import { create as createOcean } from "./ocean";
import { create as createNeon } from "./neon";
import { create as createCosmos } from "./cosmos";
import { create as createMeadow } from "./meadow";

export const BACKDROPS: Record<string, RendererFactory> = {
  storm: createStorm,
  matrix: createMatrix,
  ember: createEmber,
  sakura: createSakura,
  aurora: createAurora,
  sunset: createSunset,
  lavender: createLavender,
  ocean: createOcean,
  neon: createNeon,
  cosmos: createCosmos,
  meadow: createMeadow,
};

export type BackdropId = string;
