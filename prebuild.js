import fs from 'node:fs';
import path from 'node:path';

function divSafe(dividend, divisor) {
	return !dividend || !divisor ? 0 : dividend / divisor;
}

function clamp(n, low, high) {
	return Math.max(Math.min(n, high), low);
}

function map(value, start1, end1, start2, end2) {
	const result =
		divSafe(value - start1, end1 - start1) * (end2 - start2) + start2;
	return clamp(result, Math.min(start2, end2), Math.max(start2, end2));
}
function RGBToHSL(...rgb) {
	if (!rgb.length) return [0, 100, 0, 1];
	let [r, g, b] = rgb;
	[r, g, b] = [r, g, b].map((v) => map(v, 0, 255, 0, 1));
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
	h = Math.round(map(h, 0, 6, 0, 360));
	l = divSafe(cmax + cmin, 2);
	s = divSafe(delta, 1 - Math.abs(2 * l - 1));
	return [
		h,
		Math.round(map(s, 0, 1, 0, 100)),
		Math.round(map(l, 0, 1, 0, 100)),
		1,
	];
}

function parseHEX(hexStr) {
	if (typeof hexStr !== 'string') return null;
	const matches = hexStr.match(/^\s*#?([\da-f]{3}){1,2}([\da-f]{2})?\s*$/i);
	if (!matches) return null;
	const hex = matches[0].replace('#', '');
	const values = [];
	const hexValLength = hex.length % 2 === 0 ? 2 : 1;
	for (let i = 0; i < hex.length; i += hexValLength) {
		const v = hex.substring(i, i + hexValLength);
		values.push(parseInt(hexValLength === 2 ? v : v + v, 16));
	}
	const [r, g, b] = values.map((v) => Math.round(v));
	return [r, g, b, 1];
}

const src = path.join(
	process.cwd(),
	'node_modules/css-color-names/css-color-names.json'
);
const target = path.join(process.cwd(), 'src/css-colors.ts');

(() => {
	if (!fs.existsSync(src)) return;
	const json = fs.readFileSync(src, { encoding: 'utf-8' });
	const colorNames = JSON.parse(json);
	const colors = Object.keys(colorNames).reduce((colors, key) => {
		const parsed = parseHEX(colorNames[key]);
		return !parsed
			? colors
			: { ...colors, [key]: [parsed, RGBToHSL(...parsed)] };
	}, {});
	const output = `/** 
	* Converted from css-color-names: 
	* @see {@link https://www.npmjs.com/package/css-color-names} 
	*/
   const cssColors = ${JSON.stringify(colors)};
   export default cssColors;
   `;
	if (fs.existsSync(target)) {
		const existing = fs.readFileSync(target, { encoding: 'utf-8' });
		if (existing === output) return;
	}
	fs.writeFileSync(target, output, { encoding: 'utf-8' });
})();
