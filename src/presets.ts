import type { Settings } from './types';

export type PresetId = 'ant' | 'elephant' | 'wizard' | 'custom';

export interface Preset {
  id: Exclude<PresetId, 'custom'>;
  name: string;
  settings: Settings;
}

export const CUSTOM_PRESET_ID: PresetId = 'custom';

export const PRESETS: Preset[] = [
  {
    id: 'ant',
    name: 'Skruzdėlytė',
    settings: {
      enabledOps: ['+', '-'],
      maxByOp: { '+': 20, '-': 20, '×': 5, '÷': 5 },
      allowNegative: false,
      maxTotal: 100,
    },
  },
  {
    id: 'elephant',
    name: 'Drambliukas',
    settings: {
      enabledOps: ['+', '-'],
      maxByOp: { '+': 500, '-': 500, '×': 5, '÷': 5 },
      allowNegative: false,
      maxTotal: 1000,
    },
  },
  {
    id: 'wizard',
    name: 'Burtininkė',
    settings: {
      enabledOps: ['+', '-', '×', '÷'],
      maxByOp: { '+': 20, '-': 20, '×': 5, '÷': 5 },
      allowNegative: false,
      maxTotal: 100,
    },
  },
];

export const DEFAULT_PRESET = PRESETS[0];
