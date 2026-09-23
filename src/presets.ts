import type { Settings } from './types';

export type PresetId = 'ant' | 'elephant' | 'wizard' | 'custom';

export interface Preset {
  id: Exclude<PresetId, 'custom'>;
  name: string;
  tagline: string;
  settings: Settings;
}

export const CUSTOM_PRESET_ID: PresetId = 'custom';

export const PRESETS: Preset[] = [
  {
    id: 'ant',
    name: 'Skruzdėlytė',
    tagline: 'Sudėtis ir atimtis iki 20, suma iki 100',
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
    tagline: 'Dideli skaičiai: iki 500, suma iki 1000',
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
    tagline: 'Visi veiksmai: ± iki 20, × ÷ iki 5, suma iki 100',
    settings: {
      enabledOps: ['+', '-', '×', '÷'],
      maxByOp: { '+': 20, '-': 20, '×': 5, '÷': 5 },
      allowNegative: false,
      maxTotal: 100,
    },
  },
];

export const DEFAULT_PRESET = PRESETS[0];
