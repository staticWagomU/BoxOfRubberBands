#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");
const DIST_DIR = join(ROOT_DIR, "dist");
const GENERATED_DIR = join(ROOT_DIR, "generated");

async function loadR2Manager() {
	try {
		const { createR2Manager } = await import("../src/utils/r2-ogp.js");
		return createR2Manager();
	} catch (error) {
		console.error("Failed to load R2 manager:", error);
		return null;
	}
}

async function ensureDirectories() {
	if (!existsSync(GENERATED_DIR)) {
		mkdirSync(GENERATED_DIR, { recursive: true });
	}
}

async function syncOGPMetadata(r2Manager) {
	console.log("Syncing OGP metadata with R2...");

	const localMetadataPath = join(GENERATED_DIR, "ogp.json");
	let localMetadata = {};

	if (existsSync(localMetadataPath)) {
		try {
			localMetadata = JSON.parse(readFileSync(localMetadataPath, "utf8"));
		} catch (error) {
			console.error("Failed to read local OGP metadata:", error);
		}
	}

	const r2Metadata = await r2Manager.getOGPMetadata();

	if (r2Metadata) {
		const mergedMetadata = { ...r2Metadata, ...localMetadata };
		writeFileSync(localMetadataPath, JSON.stringify(mergedMetadata, null, 2));
		console.log("OGP metadata synced from R2");
		return mergedMetadata;
	} else {
		if (Object.keys(localMetadata).length > 0) {
			await r2Manager.updateOGPMetadata(localMetadata);
			console.log("OGP metadata uploaded to R2");
		}
		return localMetadata;
	}
}

async function downloadExistingImages(r2Manager) {
	console.log("Checking for existing OGP images in R2...");

	const existingImages = await r2Manager.listDailyImages();
	let downloadedCount = 0;

	for (const imagePath of existingImages) {
		const localPath = join(DIST_DIR, imagePath);
		const localDir = dirname(localPath);

		if (!existsSync(localPath)) {
			if (!existsSync(localDir)) {
				mkdirSync(localDir, { recursive: true });
			}

			const imageData = await r2Manager.downloadImage(imagePath);
			if (imageData) {
				writeFileSync(localPath, Buffer.from(imageData));
				downloadedCount++;
				console.log(`Downloaded: ${imagePath}`);
			}
		}
	}

	console.log(`Downloaded ${downloadedCount} images from R2`);
	return existingImages;
}

async function uploadNewImages(r2Manager, existingImages) {
	console.log("Uploading new OGP images to R2...");

	const dailyImagesDir = join(DIST_DIR, "daily");
	if (!existsSync(dailyImagesDir)) {
		console.log("No daily images directory found");
		return;
	}

	const uploadImage = async (year, month, filename) => {
		const imagePath = `daily/${year}/${month}/${filename}`;
		const fullPath = join(DIST_DIR, imagePath);

		if (existsSync(fullPath) && !existingImages.includes(imagePath)) {
			const imageData = readFileSync(fullPath);
			const success = await r2Manager.uploadImage(imagePath, imageData);
			if (success) {
				console.log(`Uploaded: ${imagePath}`);
				return true;
			}
		}
		return false;
	};

	let uploadedCount = 0;

	const years = (await readdirSync(dailyImagesDir)).filter((year) => /^\d{4}$/.test(year));
	for (const year of years) {
		const yearDir = join(dailyImagesDir, year);
		const months = (await readdirSync(yearDir)).filter((month) => /^\d{2}$/.test(month));

		for (const month of months) {
			const monthDir = join(yearDir, month);
			const images = (await readdirSync(monthDir)).filter((file) => file.endsWith(".png"));

			for (const image of images) {
				if (await uploadImage(year, month, image)) {
					uploadedCount++;
				}
			}
		}
	}

	console.log(`Uploaded ${uploadedCount} new images to R2`);
}

async function readdirSync(dir) {
	try {
		const { readdirSync: fsReaddirSync } = await import("node:fs");
		return fsReaddirSync(dir);
	} catch {
		return [];
	}
}

export async function main() {
	console.log("Starting OGP R2 cache sync...");

	const r2Manager = await loadR2Manager();
	if (!r2Manager) {
		console.log("R2 manager not available. Skipping R2 sync.");
		return;
	}

	await ensureDirectories();

	if (process.env.SYNC_METADATA !== "false") {
		await syncOGPMetadata(r2Manager);
	}

	if (process.env.DOWNLOAD_IMAGES !== "false") {
		const existingImages = await downloadExistingImages(r2Manager);

		if (process.env.UPLOAD_IMAGES !== "false") {
			await uploadNewImages(r2Manager, existingImages);
		}
	}

	const finalMetadata = await r2Manager.getOGPMetadata();
	if (finalMetadata && process.env.SYNC_METADATA !== "false") {
		writeFileSync(join(GENERATED_DIR, "ogp.json"), JSON.stringify(finalMetadata, null, 2));
	}

	console.log("OGP R2 cache sync completed!");
}

if (import.meta.url === `file://${process.argv[1]}`) {
	main().catch(console.error);
}
