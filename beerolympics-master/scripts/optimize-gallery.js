const fs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');

const root = path.resolve(__dirname, '..');
const sourceDir = path.join(root, 'media', 'gallery');
const outputDir = path.join(root, process.env.OUTPUT_DIR || path.join('media', 'gallery-optimized-test'));

const imageExtensions = new Set(['.jpg', '.jpeg', '.png']);
const maxWidth = Number(process.env.MAX_WIDTH || 1600);
const quality = Number(process.env.QUALITY || 80);
const limit = process.env.LIMIT === 'all' ? Infinity : Number(process.env.LIMIT || 10);

function toWebpName(fileName) {
	return `${path.parse(fileName).name}.webp`;
}

function formatMb(bytes) {
	return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

async function getLargestImages() {
	const entries = await fs.readdir(sourceDir, { withFileTypes: true });
	const files = [];

	for (const entry of entries) {
		if (!entry.isFile()) continue;
		if (!imageExtensions.has(path.extname(entry.name).toLowerCase())) continue;

		const fullPath = path.join(sourceDir, entry.name);
		const stat = await fs.stat(fullPath);
		files.push({
			name: entry.name,
			fullPath,
			size: stat.size
		});
	}

	const sorted = files.sort((a, b) => b.size - a.size);
	return Number.isFinite(limit) ? sorted.slice(0, limit) : sorted;
}

async function optimizeImage(file) {
	const outputPath = path.join(outputDir, toWebpName(file.name));

	await sharp(file.fullPath)
		.rotate()
		.resize({
			width: maxWidth,
			withoutEnlargement: true
		})
		.webp({
			quality,
			effort: 4
		})
		.toFile(outputPath);

	const outputStat = await fs.stat(outputPath);

	return {
		name: file.name,
		inputSize: file.size,
		outputSize: outputStat.size,
		savedPct: 100 - (outputStat.size / file.size) * 100
	};
}

async function main() {
	await fs.mkdir(outputDir, { recursive: true });

	const files = await getLargestImages();
	const results = [];

	for (const file of files) {
		const result = await optimizeImage(file);
		results.push(result);
		console.log(
			`${result.name}: ${formatMb(result.inputSize)} -> ${formatMb(result.outputSize)} (${result.savedPct.toFixed(1)}% smaller)`
		);
	}

	const inputTotal = results.reduce((sum, item) => sum + item.inputSize, 0);
	const outputTotal = results.reduce((sum, item) => sum + item.outputSize, 0);
	const ratio = outputTotal / inputTotal;
	const fullGalleryBytes = (await Promise.all(
		(await fs.readdir(sourceDir, { withFileTypes: true }))
			.filter(entry => entry.isFile() && imageExtensions.has(path.extname(entry.name).toLowerCase()))
			.map(async entry => (await fs.stat(path.join(sourceDir, entry.name))).size)
	)).reduce((sum, size) => sum + size, 0);

	console.log('');
	console.log(`Test files: ${results.length}`);
	console.log(`Test total: ${formatMb(inputTotal)} -> ${formatMb(outputTotal)}`);
	console.log(`Average output ratio: ${(ratio * 100).toFixed(1)}% of original`);
	console.log(`Estimated full gallery size with same ratio: ${formatMb(fullGalleryBytes * ratio)}`);
	console.log(`Output folder: ${outputDir}`);
}

main().catch(err => {
	console.error(err);
	process.exit(1);
});
