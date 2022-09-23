import cssColors from './css-colors';
//#region types
export type ColorStringType = 'RGB' | 'HSL' | 'HEX';
export type ColorStringMode = ColorStringType | 'rgb' | 'hsl' | 'hex';
export type ColorArrayType = 'RGB' | 'HSL';
export type ColorArray = [number, number, number, number];
type CA = ColorArray;
export type ColorChangeCallback =
	| ((...args: unknown[]) => unknown)
	| ((rgba: CA, hsla: CA) => unknown);
export type ColorCombineOperator = '+' | '-' | '*' | '/';
export type ColorArrayCombiner<T extends ColorArrayType> = T extends 'HSL'
	? (hsla1: CA | number[], hsla2: CA | number[]) => CA
	: (rgba1: CA | number[], rgba2: CA | number[]) => CA;
export type ColorModifier = (color: CA, colorType?: ColorArrayType) => void;
export type ColorToStringMethod = (outputMode?: ColorStringType) => string;
export type ColorName = keyof typeof cssColors;
export type ColorInstance = {
	red: number;
	green: number;
	blue: number;
	alpha: number;
	hue: number;
	saturation: number;
	lightness: number;
	rgb: CA;
	hsl: CA;
	hex: string;
	onChange?: ColorChangeCallback;
	add: (color: CA, type?: ColorArrayType) => void;
	sub: (color: CA, type?: ColorArrayType) => void;
	mult: (color: CA, type?: ColorArrayType) => void;
	div: (color: CA, type?: ColorArrayType) => void;
	inverted: () => ColorInstance;
	clone: () => ColorInstance;
	toString: (outputMode?: ColorStringType) => string;
};
//#endregion
//#region constants
export const ALPHA_RANGE = 1;
export const RGB_RANGE = [255, 255, 255];
export const HSL_RANGE = [360, 100, 100];
export const HEX_RANGE = 255;
export const PRECISION_ALPHA = 3;
export const PATTERNS: Record<ColorStringType, RegExp> = {
	RGB: /^\s*rgb(a)?\(\s*(?<r>\d{1,3}(\.\d+)?)\s*,\s*(?<g>\d{1,3}(\.\d+)?)\s*,\s*(?<b>\d{1,3}(\.\d+)?)\s*(,\s*(?<a>\d{1}(\.\d+)?))?\s*\)\s*$/i,
	HSL: /^\s*hsl(a)?\(\s*(?<r>\d{1,3}(\.\d+)?)\s*,\s*(?<g>\d{1,3}(\.\d+)?)\s*,\s*(?<b>\d{1,3}(\.\d+)?)\s*(,\s*(?<a>\d{1}(\.\d+)?))?\s*\)\s*$/i,
	HEX: /^\s*#?([\da-f]{3}){1,2}([\da-f]{2})?\s*$/i,
};
export const DEFAULT_COLORS = {
	get RGB() {
		return [0, 0, 0, ALPHA_RANGE] as CA;
	},
	get HSL() {
		return [0, HSL_RANGE[1], 0, ALPHA_RANGE] as CA;
	},
	get HEX() {
		return '#000000';
	},
};
//#endregion
//#region typechecking
function isNum<X = unknown>(x?: X) {
	return (typeof x === 'number' && !Number.isNaN(x)) as X extends number
		? true
		: false;
}
function isFloat<X = unknown>(x?: X) {
	return (typeof x === 'number' &&
		!Number.isNaN(x) &&
		x % 1 !== 0 &&
		isFinite(x)) as X extends number ? boolean : false;
}
function isArr<X = unknown>(x?: X) {
	return Array.isArray(x) as X extends Array<unknown> ? true : false;
}
//#endregion
//#region regexp functions
export function colorTest(str: string) {
	if (typeof str !== 'string') return null;
	for (const key of Object.keys(PATTERNS)) {
		if (PATTERNS[key].test(str)) return key as ColorStringType;
	}
	return null;
}
//#endregion
//#region math functions
function roundFloat(value: number, precision = 1) {
	if (!isFloat(value)) return value;
	const multiplier = 10 ** precision;
	return Math.round(value * multiplier) / multiplier;
}
function clamp(value: number, min: number, max: number) {
	return Math.max(Math.min(value, max), min);
}
function divSafe(dividend: number, divisor: number) {
	return !dividend || !divisor ? 0 : dividend / divisor;
}

/**
 * @param value incoming value
 * @param inputRangeStart start of incoming range
 * @param inputRangeEnd end of incoming range
 * @param outputRangeStart start of output range
 * @param outputRangeEnd end of output range
 * @param constrainOutput constrain number within output range
 */
function map(
	value: number,
	inputRangeStart: number,
	inputRangeEnd: number,
	outputRangeStart: number,
	outputRangeEnd: number,
	constrainOutput = false
) {
	const result =
		divSafe(value - inputRangeStart, inputRangeEnd - inputRangeStart) *
			(outputRangeEnd - outputRangeStart) +
		outputRangeStart;
	return !constrainOutput
		? result
		: clamp(
				result,
				Math.min(outputRangeStart, outputRangeEnd),
				Math.max(outputRangeStart, outputRangeEnd)
		  );
}
function normalize(value: number, rangeStart: number, rangeEnd: number) {
	return map(value, rangeStart, rangeEnd, 0, 1, true);
}
function euclideanModulo(value: number, max: number) {
	return ((value % max) + max) % max;
}

/**
 * @param value     value of which the segment position is calculated
 * @param segments  amount of segments
 * @param min       lowest value in range
 * @param max      highest value in range
 * @returns zero based index of the segment
 */
function segmentMap(value: number, segments: number, min: number, max: number) {
	return euclideanModulo(
		Math.floor(map(value, min, max, 0, segments, true)),
		segments
	);
}
/**
 * Get Y-value on a parabola at a given X-value
 *
 * @param x     incoming value of x, between 0 and 1
 * @param tMin  minimum value of t, used with x and tMax to get a normalized t-value.
 * @param tMax  maximum value of t, used with x and tMin to get a normalized t-value.
 */
function parabola(x: number, tMin = 0, tMax = 1) {
	const t = normalize(x, tMin, tMax);
	const h = 0.5,
		a = -4;
	return a * Math.pow(t - h, 2) + 1;
}

/**
 * Get Y-value on a cubic bezier-curve at a given X-value
 *
 * @function cubicBezier
 * @param   x     incoming value of x, between 0 and 1
 * @param   tMin  minimum value of t, used with x and tMax to get a normalized t-value.
 * @param   tMax  maximum value of t, used with x and tMin to get a normalized t-value.
 * @param   y1    Y-value of first control-point in curve
 * @param   y2    Y-value of second control-point in curve
 * @param   y3    Y-value of third control-point in curve
 * @param   y4    Y-value of fourth controlpoint in curve
 * @returns  Y value at X
 */
function cubicBezier(
	x: number,
	tMin: number,
	tMax: number,
	y1: number,
	y2: number,
	y3: number,
	y4: number
) {
	const t = normalize(x, tMin, tMax);
	const y =
		Math.pow(1 - t, 3) * y1 +
		3 * Math.pow(1 - t, 2) * t * y2 +
		3 * (1 - t) * Math.pow(t, 2) * y3 +
		Math.pow(t, 3) * y4;
	return y * (tMax - tMin);
}
//#endregion
//#region helper functions
function replaceAtIndex<T>(arr: T[], value: T, index: number): T[] {
	if (!isArr(arr)) return arr;
	if (!isNum(index) || index < 0 || index >= arr.length) return [...arr];
	return [...arr.slice(0, index), value, ...arr.slice(index + 1)];
}
//#endregion
//#region arrays builders
function colorArray(...values: [number, number, number, number]) {
	const [a, b, c, d] = values;
	return [a, b, c, d].map((v) => (isNum(v) ? v : 0)) as CA;
}

export function RGBArray(...values: number[]) {
	const defaultRGB = DEFAULT_COLORS.RGB;
	if (!values.length) return defaultRGB;
	let [r, g, b, a] = values;
	[r, g, b] = [r, g, b].map((v, i) => {
		return isNum(v) ? clamp(v, 0, RGB_RANGE[i]) : defaultRGB[i];
	});
	a =
		isNum(a) && a !== ALPHA_RANGE
			? clamp(a, 0, ALPHA_RANGE)
			: defaultRGB[3];
	return colorArray(r, g, b, a);
}

export function HSLArray(...values: number[]) {
	const defaultHSL = DEFAULT_COLORS.HSL;
	if (!values.length) return defaultHSL;
	let [h, s, l, a] = values;
	h = isNum(h) ? euclideanModulo(h, HSL_RANGE[0]) : defaultHSL[0];
	s = isNum(s) ? clamp(s, 0, HSL_RANGE[1]) : defaultHSL[1];
	l = isNum(l) ? clamp(l, 0, HSL_RANGE[2]) : defaultHSL[2];
	a = isNum(a) ? clamp(a, 0, ALPHA_RANGE) : defaultHSL[3];
	return colorArray(h, s, l, a);
}
//#endregion
//#region parsing
export function parseRGB(rgbStr: string): CA | null {
	if (typeof rgbStr !== 'string') return null;
	const match = rgbStr.match(PATTERNS.RGB);
	if (!match) return null;
	const { r, g, b, a } = match.groups as {
		r: string;
		g: string;
		b: string;
		a: string;
	};
	const rgba = [r, g, b, a].map((v) => parseFloat(v));
	return RGBArray(...rgba);
}

export function parseHEX(hexStr: string): CA | null {
	if (typeof hexStr !== 'string') return null;
	const matches = hexStr.match(PATTERNS.HEX);
	if (!matches) return null;
	const hex = matches[0].replace('#', '');
	const values: number[] = [];
	const hexValLength = hex.length % 2 === 0 ? 2 : 1;
	for (let i = 0; i < hex.length; i += hexValLength) {
		const v = hex.substring(i, i + hexValLength);
		values.push(parseInt(hexValLength === 2 ? v : v + v, 16));
	}
	let [r, g, b, a] = values;
	if (isNum(a)) a = map(a, 0, HEX_RANGE, 0, ALPHA_RANGE);
	return RGBArray(r, g, b, a);
}

export function parseHSL(hslStr: string): CA | null {
	if (typeof hslStr !== 'string') return null;
	const match = hslStr.match(PATTERNS.HSL);
	if (!match) return null;
	const { h, s, l, a } = match.groups as {
		h: string;
		s: string;
		l: string;
		a: string;
	};
	const hsla = [h, s, l, a].map((v) => parseFloat(v));
	return HSLArray(...hsla);
}

export function parseColor(
	colorStr: string | ColorName
): [CA | null, 'HSL' | 'RGB' | null] {
	if (Object.prototype.hasOwnProperty.call(cssColors, colorStr)) {
		return [cssColors[colorStr] as CA, 'RGB'];
	}
	const type = colorTest(colorStr);
	switch (type) {
		case 'RGB':
			return [parseRGB(colorStr), 'RGB'];
		case 'HSL':
			return [parseHSL(colorStr), 'RGB'];
		case 'HEX':
			return [parseHEX(colorStr), 'RGB'];
		default:
			return [null, null];
	}
}
//#endregion
//#region manipulation
//#region round
function roundCA(values: number[], type: ColorArrayType) {
	const [arrFn, defaultColor] =
		type === 'HSL'
			? [HSLArray, DEFAULT_COLORS.HSL]
			: [RGBArray, DEFAULT_COLORS.RGB];
	if (!isArr(values) || !values.length) return defaultColor;
	let [a, b, c, alpha] = arrFn(...values);
	[a, b, c] = [a, b, c].map((v) => Math.round(v));
	alpha = roundFloat(alpha, PRECISION_ALPHA);
	return colorArray(a, b, c, alpha);
}

export function roundRGB(...values: number[]) {
	return roundCA(values, 'RGB');
}
export function roundHSL(...values: number[]) {
	return roundCA(values, 'HSL');
}
//#endregion
//#region map
export function mapRGB(rgba: number[], low = 0, high = 1) {
	if (!isArr(rgba) || !rgba.length) {
		return RGBArray(low, low, low, ALPHA_RANGE);
	}
	let [r, g, b, a] = RGBArray(...rgba);
	[r, g, b] = [r, g, b].map((v, i) => map(v, 0, RGB_RANGE[i], low, high));
	a = map(a, 0, ALPHA_RANGE, low, high);
	return colorArray(r, g, b, a);
}

export function mapHSL(hsla: number[], low = 0, high = 1) {
	if (!isArr(hsla) || !hsla.length) {
		return HSLArray(low, low, low, ALPHA_RANGE);
	}
	let [h, s, l, a] = HSLArray(...hsla);
	h = map(h, 0, HSL_RANGE[0], low, high);
	s = map(s, 0, HSL_RANGE[1], low, high);
	l = map(l, 0, HSL_RANGE[2], low, high);
	a = map(a, 0, ALPHA_RANGE, low, high);
	return colorArray(h, s, l, a);
}
//#endregion
//#region invert
export function invertHSL(...hsla: number[]) {
	let [h, s, l, a] = HSLArray(...hsla);
	h = euclideanModulo(h + HSL_RANGE[0] / 2, HSL_RANGE[0]);
	l = HSL_RANGE[2] - l;
	return colorArray(h, s, l, a);
}
export function invertRGB(...rgba: number[]) {
	let [r, g, b, a] = RGBArray(...rgba);
	[r, g, b] = [r, g, b].map((v, i) => RGB_RANGE[i] - v);
	return colorArray(r, g, b, a);
}
export function invertHEX(hexStr: string) {
	const parsed = parseHEX(hexStr);
	return !parsed ? '#ffffff' : RGBToHEX(...invertRGB(...parsed));
}
//#endregion
//#region combine color arrays
function combineCA(
	c1: CA | number[],
	c2: CA | number[],
	operator: ColorCombineOperator,
	colorType: ColorArrayType
) {
	const arrFn = colorType === 'HSL' ? HSLArray : RGBArray;
	if (!isArr(c1)) return isArr(c2) ? c2 : arrFn();
	if (!isArr(c2) || !['+', '-', '*', '/'].includes(operator)) return c1;
	const combined = arrFn(...c1).map((a, i) => {
		if (i === 3 || !isNum(c2[i])) return a;
		const b = c2[i];
		switch (operator) {
			case '+':
				return a + b;
			case '-':
				return a - b;
			case '*':
				return a * b;
			case '/':
				return divSafe(a, b);
			default:
				return a;
		}
	});
	return arrFn(...combined);
}
function createCombiners<T extends ColorArrayType>(type: T) {
	return (['+', '-', '*', '/'] as ColorCombineOperator[]).map((op) => {
		return (c1: CA | number[], c2: CA | number[]) =>
			combineCA(c1, c2, op, type);
	}) as ColorArrayCombiner<T>[];
}
const [addRGB, subRGB, multRGB, divRGB] = createCombiners('RGB');
const [addHSL, subHSL, multHSL, divHSL] = createCombiners('HSL');
export { addRGB, subRGB, multRGB, divRGB, addHSL, subHSL, multHSL, divHSL };
//#endregion
//#region modify color arrays
/**
 * Set tone using parabola curve
 * @param rgba RGB Array
 * @param strength number array with value for r, g, and b. recommended strength between -1 and 1
 */
export function RGBTone(
	rgba: number[] | CA,
	strength: [number, number, number]
) {
	if (!isArr(rgba) || !rgba.length) return DEFAULT_COLORS.RGB;
	if (!isArr(strength)) return rgba;
	let [r, g, b] = rgba;
	[r, g, b] = [r, g, b].map((v, i) => {
		if (!isNum(strength[i]) || !strength[i] || !isNum(v)) return 0;
		return parabola(v, 0, RGB_RANGE[i]) * strength[i];
	});
	return addRGB(rgba, [r, g, b, 0]);
}
/**
 * Set brightness using parabola curve
 * @param rgba RGB array
 * @param strength recommended strength between -1 and 1
 */
export function RGBBrightness(rgba: CA | number[], strength: number) {
	if (!strength || !isNum(strength)) return rgba;
	return RGBTone(rgba, [strength, strength, strength]);
}
/**
 *
 * @param rgba RGB Array
 * @param strength recommended strength less than 1
 */
export function RGBContrastCurve(rgba: CA | number[], strength: number) {
	if (!isArr(rgba) || !rgba.length) return DEFAULT_COLORS.RGB;
	if (!strength || !isNum(strength)) return rgba;
	const yMax = 3.465;
	let [r, g, b] = rgba;
	[r, g, b] = [r, g, b].map((v, i) => {
		if (!isNum(v)) return 0;
		return cubicBezier(v, 0, RGB_RANGE[i], 0, -yMax, yMax, 0) * strength;
	});
	return addRGB(rgba, [r, g, b, 0]);
}
//#endregion
//#endregion
//#region conversion
export function RGBToHSL(...rgba: number[]) {
	if (!rgba.length) return DEFAULT_COLORS.HSL;
	const [r, g, b, alpha] = mapRGB(rgba, 0, 1);
	const cmin = Math.min(r, g, b),
		cmax = Math.max(r, g, b),
		delta = cmax - cmin;
	let [h, s, l] = [0, 0, 0];
	switch (cmax) {
		case r:
			h = divSafe(g - b, delta) % 6 || 0;
			break;
		case g:
			h = divSafe(b - r, delta) + 2;
			break;
		case b:
			h = divSafe(r - g, delta) + 4;
	}
	h = map(h, 0, 6, 0, HSL_RANGE[0]);
	l = divSafe(cmax + cmin, 2);
	s = divSafe(delta, 1 - Math.abs(2 * l - 1));
	return HSLArray(
		h,
		map(s, 0, 1, 0, HSL_RANGE[1]),
		map(l, 0, 1, 0, HSL_RANGE[2]),
		alpha
	);
}

export function RGBToHEX(...rgba: number[]) {
	if (!rgba.length) return DEFAULT_COLORS.HEX;
	let [r, g, b, a] = roundRGB(...rgba);
	const hexValues = [
		r,
		g,
		b,
		a !== ALPHA_RANGE
			? Math.round(map(a, 0, ALPHA_RANGE, 0, HEX_RANGE, true))
			: '',
	].map((v) => {
		if (!isNum(v)) return '';
		const hex = v.toString(16);
		return hex.length === 2 ? hex : hex + hex;
	});
	return `#${hexValues.join('')}`;
}

export function HSLToRGB(...hsla: number[]) {
	if (!hsla.length) return DEFAULT_COLORS.RGB;
	let [h, s, l, alpha] = HSLArray(...hsla);
	s = normalize(s, 0, HSL_RANGE[1]);
	l = normalize(l, 0, HSL_RANGE[2]);
	// chroma / color intensity / strongest color
	const c = (1 - Math.abs(2 * l - 1)) * s;
	// second strongest color
	const x = !h ? 0 : c * (1 - Math.abs(((h / (HSL_RANGE[0] / 6)) % 2) - 1));
	// add to each channel to match lightness
	const m = !c ? l : l - c / 2;
	let [r, g, b] = [0, 0, 0];
	const hueSegment = segmentMap(h, 6, 0, HSL_RANGE[0]);
	switch (hueSegment) {
		// hue between 0 and 60
		case 0:
			r = c;
			g = x;
			b = 0;
			break;
		// hue between 60 and 120
		case 1:
			r = x;
			g = c;
			b = 0;
			break;
		// hue between 120 and 180
		case 2:
			r = 0;
			g = c;
			b = x;
			break;
		// hue between 180 and 240
		case 3:
			r = 0;
			g = x;
			b = c;
			break;
		// hue between 240 and 300
		case 4:
			r = x;
			g = 0;
			b = c;
			break;
		// hue between 300 and 360
		case 5:
			r = c;
			g = 0;
			b = x;
			break;
	}
	[r, g, b] = [r, g, b].map((v, i) => map(v + m, 0, 1, 0, RGB_RANGE[i]));
	return RGBArray(r, g, b, alpha);
}
export function HSLToHEX(...hsla: number[]) {
	return RGBToHEX(...HSLToRGB(...hsla));
}

export function HEXToRGB(hexStr: string) {
	const parsed = parseHEX(hexStr);
	return parsed || DEFAULT_COLORS.RGB;
}

export function HEXToHSL(hexStr: string) {
	const parsed = parseHEX(hexStr);
	return !parsed ? DEFAULT_COLORS.HSL : RGBToHSL(...parsed);
}

//#region toString functions
export function RGBToString(...values: number[]) {
	const [r, g, b, a] = roundRGB(...values);
	return a !== ALPHA_RANGE
		? `rgba(${[r, g, b, a].join(',')})`
		: `rgb(${[r, g, b].join(',')})`;
}

export function HSLToString(...values: number[]) {
	const [h, s, l, a] = roundHSL(...values);
	const sl = [s, l].map((v) => `${v}%`).join(',');
	return a !== ALPHA_RANGE ? `hsla(${h},${sl},${a})` : `hsl(${h},${sl})`;
}
//#endregion
//#endregion
//#region Color
/**
 * @param colorStr Accepts strings in following CSS rgb, hsl and hex formats.
 * Also accepts CSS Color Names
 * @see {@link https://www.npmjs.com/package/css-color-names}
 */
export function Color(colorStr: ColorName | string) {
	let [rgba, hsla] = (() => {
		const [parsed, type] = parseColor(colorStr);
		return !type || !parsed
			? [RGBArray(), HSLArray()]
			: type === 'HSL'
			? [HSLToRGB(...parsed), parsed]
			: [parsed, RGBToHSL(...parsed)];
	})();
	let onChange: ColorChangeCallback | null = null;
	function setRGB(values: number[]) {
		if (!isArr(values) || !values.length) return;
		let [r, g, b, a] = values;
		[r, g, b, a] = [r, g, b, a].map((v, i) => (isNum(v) ? v : rgba[i]));
		if ([r, g, b, a].every((v, i) => v === rgba[i])) return;
		rgba = RGBArray(r, g, b, a);
		hsla = HSLArray(...rgba);
		onChange && onChange(rgba, hsla);
	}
	function setHSL(values: number[]) {
		if (!isArr(values) || !values.length) return;
		let [h, s, l, a] = values;
		[h, s, l, a] = [h, s, l, a].map((v, i) => (isNum(v) ? v : hsla[i]));
		if ([h, s, l, a].every((v, i) => v === hsla[i])) return;
		hsla = HSLArray(h, s, l, a);
		rgba = HSLToRGB(...hsla);
		onChange && onChange(rgba, hsla);
	}
	function setHEX(hexStr: string) {
		const parsed = parseHEX(hexStr);
		parsed && setRGB(parsed);
	}
	const [add, sub, mult, div] = (() => {
		return (['+', '-', '*', '/'] as ColorCombineOperator[]).map((op) => {
			return (color: CA, colorType?: ColorArrayType) => {
				const [mode, src, setColor] =
					colorType === 'HSL'
						? ['HSL' as ColorArrayType, hsla, setHSL]
						: ['RGB' as ColorArrayType, rgba, setRGB];
				return setColor(combineCA(src, color, op, mode));
			};
		}) as ColorModifier[];
	})();
	function toString(outputMode?: ColorStringType) {
		const mode: ColorStringType =
			typeof outputMode === 'string' &&
			['RGB', 'HSL', 'HEX'].includes(outputMode.toUpperCase())
				? (outputMode.toUpperCase() as ColorStringType)
				: 'RGB';
		switch (mode) {
			case 'RGB':
				return RGBToString(...rgba);
			case 'HSL':
				return HSLToString(...hsla);
			case 'HEX':
				return RGBToHEX(...rgba);
		}
	}
	function replaceHSL(value: number, index: 0 | 1 | 2 | 3) {
		if (!isNum(value) || index < 0 || index > 3) return;
		setHSL(replaceAtIndex(hsla, value, index));
	}
	function replaceRGB(value: number, index: 0 | 1 | 2 | 3) {
		if (!isNum(value) || index < 0 || index > 3) return;
		setRGB(replaceAtIndex(hsla, value, index));
	}
	return Object.defineProperties(
		{},
		{
			isColor: {
				value: true,
			},
			red: {
				get: () => rgba[0],
				set: (r: number) => replaceRGB(r, 0),
				enumerable: true,
			},
			green: {
				get: () => rgba[1],
				set: (g: number) => replaceRGB(g, 1),
				enumerable: true,
			},
			blue: {
				get: () => rgba[2],
				set: (b: number) => replaceRGB(b, 2),
				enumerable: true,
			},
			alpha: {
				get: () => rgba[3],
				set: (a: number) => replaceRGB(a, 3),
				enumerable: true,
			},
			hue: {
				get: () => hsla[0],
				set: (h: number) => replaceHSL(h, 0),
				enumerable: true,
			},
			saturation: {
				get: () => hsla[1],
				set: (s: number) => replaceHSL(s, 0),
				enumerable: true,
			},
			lightness: {
				get: () => hsla[2],
				set: (l: number) => replaceHSL(l, 0),
				enumerable: true,
			},
			rgb: {
				get: () => [...rgba] as CA,
				set: (values: CA) => setRGB(values),
				enumerable: true,
			},
			hsl: {
				get: () => [...hsla] as CA,
				set: (values: CA) => setHSL(values),
				enumerable: true,
			},
			hex: {
				get: () => RGBToHEX(...rgba),
				set: (hexStr: string) => setHEX(hexStr),
			},
			inverted: {
				value: () => Color(RGBToString(...invertRGB(...rgba))),
			},
			clone: { value: () => Color(RGBToString(...rgba)) },
			onChange: {
				get: () => onChange || undefined,
				set: (callbackfn: ColorChangeCallback | null) => {
					onChange =
						typeof callbackfn !== 'function' ? null : callbackfn;
				},
			},
			add: { value: add },
			sub: { value: sub },
			mult: { value: mult },
			div: { value: div },
			toString: { value: toString },
		}
	) as ColorInstance;
}
//#endregion
