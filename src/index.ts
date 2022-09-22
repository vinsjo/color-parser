/* eslint-disable @typescript-eslint/no-unused-vars */
//#region types
export type ColorStringType = 'RGB' | 'HSL' | 'HEX';
export type ColorStringMode = ColorStringType | 'rgb' | 'hsl' | 'hex';
export type ColorArrayType = 'RGB' | 'HSL';
export type ColorArray = [number, number, number, number];
type CA = ColorArray;
export type ColorChangeCallback = (rgba?: CA, hsla?: CA) => unknown;
export type ColorCombineOperator = '+' | '-' | '*' | '/';
export type ColorArrayCombiner<T extends ColorArrayType> = T extends 'HSL'
	? (hsla1: CA, hsla2: CA) => CA
	: (rgba1: CA, rgba2: CA) => CA;
export type ColorModifier = (color: CA, colorType?: ColorArrayType) => void;
export type ColorToStringMethod = (outputMode?: ColorStringType) => string;
//#endregion
//#region constants
export const RGB_RANGE: CA = [255, 255, 255, 1];
export const HSL_RANGE: CA = [360, 100, 100, 1];
export const HEX_RANGE = 255;
export const PRECISION_ALPHA = 3;
export const PATTERNS: Record<ColorStringType, RegExp> = {
	RGB: /^\s*rgb(a)?\(\s*(?<r>\d{1,3}(\.\d+)?)\s*,\s*(?<g>\d{1,3}(\.\d+)?)\s*,\s*(?<b>\d{1,3}(\.\d+)?)\s*(,\s*(?<a>\d{1}(\.\d+)?))?\s*\)\s*$/i,
	HSL: /^\s*hsl(a)?\(\s*(?<r>\d{1,3}(\.\d+)?)\s*,\s*(?<g>\d{1,3}(\.\d+)?)\s*,\s*(?<b>\d{1,3}(\.\d+)?)\s*(,\s*(?<a>\d{1}(\.\d+)?))?\s*\)\s*$/i,
	HEX: /^\s*#?([\da-f]{3}){1,2}([\da-f]{2})?\s*$/i,
};
export const DEFAULT_COLORS = {
	get RGB() {
		return [0, 0, 0, RGB_RANGE[3]] as CA;
	},
	get HSL() {
		return [0, HSL_RANGE[1], 0, HSL_RANGE[3]] as CA;
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
//#region arrays builders
function colorArray(...values: [number, number, number, number]) {
	const [a, b, c, d] = values;
	return [a, b, c, d].map((v) => (isNum(v) ? v : 0)) as CA;
}

export function RGBArray(...values: number[]) {
	if (!values.length) return DEFAULT_COLORS.RGB;
	let [r, g, b, a] = values;
	[r, g, b] = [r, g, b].map((v, i, rgb) => {
		return isNum(v) ? clamp(v, 0, RGB_RANGE[i]) : i > 0 ? rgb[0] : 0;
	});
	a =
		isNum(a) && a !== RGB_RANGE[3]
			? clamp(a, 0, RGB_RANGE[3])
			: RGB_RANGE[3];
	return colorArray(r, g, b, a);
}

export function HSLArray(...values: number[]) {
	if (!values.length) DEFAULT_COLORS.HSL;
	let [h, s, l, a] = values;
	h = isNum(h) ? euclideanModulo(h, HSL_RANGE[0]) : 0;
	s = isNum(s) ? clamp(s, 0, HSL_RANGE[1]) : HSL_RANGE[1];
	l = isNum(l) ? clamp(l, 0, HSL_RANGE[2]) : 0;
	a = isNum(a) ? clamp(a, 0, HSL_RANGE[3]) : HSL_RANGE[3];
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
	if (isNum(a)) a = map(a, 0, HEX_RANGE, 0, RGB_RANGE[3], true);
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
	colorStr: string
): ['HSL' | 'RGB' | null, CA | null] {
	const type = colorTest(colorStr);
	switch (type) {
		case 'RGB':
			return [type, parseRGB(colorStr)];
		case 'HSL':
			return [type, parseHSL(colorStr)];
		case 'HEX':
			return ['RGB', parseHEX(colorStr)];
		default:
			return [null, null];
	}
}
//#endregion
//#region manipulation
//#region round
export function roundRGB(...values: number[]) {
	let [r, g, b, a] = RGBArray(...values);
	[r, g, b] = [r, g, b].map((v) => Math.round(v));
	a = roundFloat(a, PRECISION_ALPHA);
	return colorArray(r, g, b, a);
}
export function roundHSL(...values: number[]) {
	let [h, s, l, a] = HSLArray(...values);
	[h, s, l] = [h, s, l].map((v) => Math.round(v));
	a = roundFloat(a, PRECISION_ALPHA);
	return colorArray(h, s, l, a);
}
//#endregion
//#region map
export function mapRGB(rgba: number[], low = 0, high = 1) {
	if (!isArr(rgba)) return RGBArray(low, low, low, RGB_RANGE[3]);
	let [r, g, b, a] = RGBArray(...rgba);
	[r, g, b] = [r, g, b].map((v, i) => map(v, 0, RGB_RANGE[i], low, high));
	return colorArray(r, g, b, a);
}

export function mapHSL(hsla: number[], low = 0, high = 1) {
	if (!isArr(hsla)) return HSLArray(low, low, low, HSL_RANGE[3]);
	let [h, s, l, a] = HSLArray(...hsla);
	h = map(h, 0, HSL_RANGE[0], low, high);
	s = map(s, 0, HSL_RANGE[1], low, high);
	l = map(l, 0, HSL_RANGE[2], low, high);
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
	c1: CA,
	c2: CA,
	operator: ColorCombineOperator,
	colorType: ColorArrayType
) {
	const arrFn = colorType === 'HSL' ? HSLArray : RGBArray;
	if (!isArr(c1)) return isArr(c2) ? c2 : arrFn();
	if (!isArr(c2) || !['+', '-', '*', '/'].includes(operator)) return c1;
	const combined = arrFn(...c1).map((a, i) => {
		if (!isNum(c2[i])) return a;
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
		return (c1: CA, c2: CA) => combineCA(c1, c2, op, type);
	}) as ColorArrayCombiner<T>[];
}
const [addRGB, subRGB, multRGB, divRGB] = createCombiners('RGB');
const [addHSL, subHSL, multHSL, divHSL] = createCombiners('HSL');
export { addRGB, subRGB, multRGB, divRGB, addHSL, subHSL, multHSL, divHSL };
//#endregion
//#endregion
//#region conversion
export function RGBToHSL(...rgba: number[]) {
	if (!rgba.length) return DEFAULT_COLORS.HSL;
	const [r, g, b, alpha] = mapRGB(rgba, 0, 1);
	const cmin = Math.min(r, g, b),
		cmax = Math.max(r, g, b),
		delta = cmax - cmin;
	let [h, s, l, a] = HSLArray();
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
	s = map(divSafe(cmax + cmin, 2), 0, 1, 0, HSL_RANGE[1]);
	l = map(divSafe(delta, 1 - Math.abs(2 * l - 1)), 0, 1, 0, HSL_RANGE[2]);
	a =
		RGB_RANGE[3] === HSL_RANGE[3]
			? alpha
			: map(alpha, 0, RGB_RANGE[3], 0, HSL_RANGE[3]);
	return HSLArray(h, s, l, a);
}

export function RGBToHEX(...rgba: number[]) {
	if (!rgba.length) return DEFAULT_COLORS.HEX;
	let [r, g, b, a] = roundRGB(...rgba);
	const hexValues = [
		r,
		g,
		b,
		a !== RGB_RANGE[3]
			? Math.round(map(a, 0, RGB_RANGE[3], 0, HEX_RANGE, true))
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
	l = normalize(s, 0, HSL_RANGE[2]);
	// chroma / color intensity / strongest color
	const c = s * (1 - Math.abs(2 * l - 1));
	// second strongest color
	const x = !c
		? 0
		: c * (1 - Math.abs((divSafe(h, HSL_RANGE[0] / 6) % 2) - 1));
	// add to each channel to match lightness
	const m = divSafe(l - c, 2);

	let [r, g, b, a] = RGBArray();
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
		// hue between 300 and 360
		case 5:
			r = c;
			g = 0;
			b = x;
			break;
	}
	[r, g, b] = [r, g, b].map((v, i) => map(v + m, 0, 1, 0, RGB_RANGE[i]));
	a =
		RGB_RANGE[3] === HSL_RANGE[3]
			? alpha
			: map(alpha, 0, HSL_RANGE[3], 0, RGB_RANGE[3]);
	return RGBArray(r, g, b, a);
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
	return a !== RGB_RANGE[3]
		? `rgba(${[r, g, b, a].join(',')})`
		: `rgb(${[r, g, b].join(',')})`;
}

export function HSLToString(...values: number[]) {
	const [h, s, l, a] = roundHSL(...values);
	return a !== HSL_RANGE[3]
		? `hsla(${[h, s, l, a].join(',')})`
		: `hsl(${[h, s, l].join(',')})`;
}
//#endregion
//#endregion

//#region Color

export function Color(colorStr: string) {
	let [rgba, hsla] = (() => {
		const [type, parsed] = parseColor(colorStr);
		return !type || !parsed
			? [RGBArray(), HSLArray()]
			: type === 'HSL'
			? [HSLToRGB(...parsed), parsed]
			: [parsed, RGBToHSL(...parsed)];
	})();
	let onChange: ((rgba?: CA, hsla?: CA) => unknown) | null = null;

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
	function setCurve(...strength: [number, number, number]) {
		const str = Array(3)
			.fill(0)
			.map((v, i) => (isNum(strength[i]) ? strength[i] : v));
		if (str.reduce((sum, v) => sum + v) === 0) return;
		let [r, g, b, a] = rgba;
		[r, g, b] = [r, g, b].map((v, i) => {
			if (!str[i]) return v;
			return parabola(v, 0, RGB_RANGE[i]) * str[i];
		});
		setRGB([r, g, b, a]);
	}
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
			hue: {
				get: () => hsla[0],
				set: (hue: number) => {
					setHSL([hue, hsla[1], hsla[2], hsla[3]]);
				},
			},
			saturation: {
				get: () => hsla[1],
				set: (saturation: number) => {
					setHSL([hsla[0], hsla[1], hsla[2], hsla[3]]);
				},
			},
			hex: {
				get: () => RGBToHEX(...rgba),
				set: (hexStr: string) => setHEX(hexStr),
			},
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
	) as {
		rgb: CA;
		HSL: CA;
		hex: string;
		onChange?: (rgba?: CA, hsla?: CA) => unknown;
		add: (color: CA, type?: ColorArrayType) => void;
		sub: (color: CA, type?: ColorArrayType) => void;
		mult: (color: CA, type?: ColorArrayType) => void;
		div: (color: CA, type?: ColorArrayType) => void;
		toString: (outputMode?: ColorStringType) => string;
	};
}
//#endregion
