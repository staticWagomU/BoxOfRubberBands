#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, "..");
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

async function ensureDirectories() {
	if (!existsSync(GENERATED_DIR)) {
		mkdirSync(GENERATED_DIR, { recursive: true });
	}
}

async function downloadOGPMetadata() {
	if (process.env.USE_R2_CACHE !== "true") {
		console.log("R2 cache disabled. Skipping metadata download.");
		return;
	}

	console.log("Downloading OGP metadata from R2...");

	const r2Manager = await loadR2Manager();
	if (!r2Manager) {
		console.log("R2 manager not available. Using local metadata.");
		return;
	}

	await ensureDirectories();

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
		const mergedMetadata = { ...localMetadata, ...r2Metadata };
		writeFileSync(localMetadataPath, JSON.stringify(mergedMetadata, null, 2));
		console.log("OGP metadata downloaded from R2");
	} else {
		if (!existsSync(localMetadataPath)) {
			writeFileSync(localMetadataPath, JSON.stringify({}, null, 2));
		}
		console.log("Using local OGP metadata");
	}
}

async function createCachedImagesList() {
	if (process.env.USE_R2_CACHE !== "true" || process.env.SKIP_OG === "true") {
		return;
	}

	console.log("Creating cached images list...");

	const r2Manager = await loadR2Manager();
	if (!r2Manager) {
		return;
	}

	const existingImages = await r2Manager.listDailyImages();
	const cachedImagesPath = join(GENERATED_DIR, "cached-ogp-images.json");

	writeFileSync(cachedImagesPath, JSON.stringify(existingImages, null, 2));
	console.log(`Found ${existingImages.length} cached images in R2`);
}

async function main() {
	console.log("Running pre-build OGP setup...");

	await downloadOGPMetadata();
	await createCachedImagesList();

	console.log("Pre-build OGP setup completed!");
}

main().catch(console.error);
