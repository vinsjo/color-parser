import fs from 'node:fs';
import path from 'node:path';

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
	const colors = Object.keys(colorNames).map((key) => {
		const parsed = parseHEX(colorNames[key]);
		return `\t${key}: [${parsed.join(', ')}]`;
	});
	// const colors = Object.keys(colorNames).reduce((colors, key) => {
	// 	const parsed = parseHEX(colorNames[key]);
	// 	return !parsed
	// 		? colors
	// 		: { ...colors, [key]: parsed };
	// }, {});
	const output = `/** 
	* Converted to rgb from css-color-names: 
	* @see {@link https://www.npmjs.com/package/css-color-names} 
	*/
   const cssColors = {\n${colors.join(',\n')}};
   export default cssColors;
   `;
	if (fs.existsSync(target)) {
		const existing = fs.readFileSync(target, { encoding: 'utf-8' });
		if (existing === output) return;
	}
	fs.writeFileSync(target, output, { encoding: 'utf-8' });
})();
