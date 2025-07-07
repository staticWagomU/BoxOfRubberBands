#!/usr/bin/env node

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");
const DIST_DIR = join(ROOT_DIR, "dist");
const GENERATED_DIR = join(ROOT_DIR, "generated");

async function loadR2Manager() {
	try {
		const { createR2Manager } = await import("../src/utils/r2-ogp.ts");
		return createR2Manager();
	} catch (error) {
		console.error("Failed to load R2 manager:", error);
		return null;
	}
}

async function uploadNewImages() {
	if (process.env.USE_R2_CACHE !== "true" || process.env.SKIP_OG === "true") {
		console.log("R2 cache or OGP generation disabled. Skipping upload.");
		return;
	}

	console.log("Uploading new OGP images to R2...");

	const r2Manager = await loadR2Manager();
	if (!r2Manager) {
		console.log("R2 manager not available. Skipping upload.");
		return;
	}

	const cachedImagesPath = join(GENERATED_DIR, "cached-ogp-images.json");
	let cachedImages = [];

	if (existsSync(cachedImagesPath)) {
		try {
			cachedImages = JSON.parse(readFileSync(cachedImagesPath, "utf8"));
		} catch (error) {
			console.error("Failed to read cached images list:", error);
		}
	}

	const dailyImagesDir = join(DIST_DIR, "daily");
	if (!existsSync(dailyImagesDir)) {
		console.log("No daily images directory found");
		return;
	}

	let uploadedCount = 0;

	const uploadImage = async (year, month, filename) => {
		const imagePath = `daily/${year}/${month}/${filename}`;
		const fullPath = join(DIST_DIR, imagePath);

		if (existsSync(fullPath) && !cachedImages.includes(imagePath)) {
			const imageData = readFileSync(fullPath);
			const success = await r2Manager.uploadImage(imagePath, imageData);
			if (success) {
				console.log(`Uploaded: ${imagePath}`);
				uploadedCount++;
			} else {
				console.error(`Failed to upload: ${imagePath}`);
			}
		}
	};

	const years = readdirSync(dailyImagesDir).filter((year) => /^\d{4}$/.test(year));
	for (const year of years) {
		const yearDir = join(dailyImagesDir, year);
		if (!existsSync(yearDir)) continue;

		const months = readdirSync(yearDir).filter((month) => /^\d{2}$/.test(month));

		for (const month of months) {
			const monthDir = join(yearDir, month);
			if (!existsSync(monthDir)) continue;

			const images = readdirSync(monthDir).filter((file) => file.endsWith(".png"));

			for (const image of images) {
				await uploadImage(year, month, image);
			}
		}
	}

	console.log(`Uploaded ${uploadedCount} new images to R2`);
}

async function uploadOGPMetadata() {
	if (process.env.USE_R2_CACHE !== "true") {
		return;
	}

	console.log("Uploading OGP metadata to R2...");

	const r2Manager = await loadR2Manager();
	if (!r2Manager) {
		return;
	}

	const localMetadataPath = join(GENERATED_DIR, "ogp.json");
	if (existsSync(localMetadataPath)) {
		try {
			const metadata = JSON.parse(readFileSync(localMetadataPath, "utf8"));
			const success = await r2Manager.updateOGPMetadata(metadata);
			if (success) {
				console.log("OGP metadata uploaded to R2");
			} else {
				console.error("Failed to upload OGP metadata");
			}
		} catch (error) {
			console.error("Failed to read OGP metadata:", error);
		}
	}
}

async function main() {
	console.log("Running post-build OGP upload...");

	await uploadNewImages();
	await uploadOGPMetadata();

	console.log("Post-build OGP upload completed!");
}

main().catch(console.error);
